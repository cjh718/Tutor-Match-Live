import {
  db,
  bidsTable,
  questionsTable,
  usersTable,
  paymentsTable,
  tutorEarningsTable,
  sessionsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";
import { getUncachableStripeClient } from "../stripeClient";

async function safeStripeClient() {
  try {
    return await getUncachableStripeClient();
  } catch (e: any) {
    if (e.message?.includes("not connected") || e.message?.includes("401")) {
      throw new Error("Stripe is not connected. Please connect Stripe in the Integrations tab first.");
    }
    throw e;
  }
}
import { notify } from "../lib/notify";

const PLATFORM_COMMISSION_PCT = 0.10;
const CURRENCY = "sgd";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

// POST /api/payments - Student initiates payment for an accepted bid
router.post("/payments", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "student") {
    res.status(403).json({ error: "Only students can make payments" });
    return;
  }

  const { bidId } = req.body as { bidId?: number };
  if (!bidId) {
    res.status(400).json({ error: "Missing bidId" });
    return;
  }

  const [bid] = await db.select().from(bidsTable).where(eq(bidsTable.bidId, bidId));
  if (!bid) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }
  if (bid.status !== "Accepted") {
    res.status(400).json({ error: "Bid must be accepted before payment" });
    return;
  }

  const [question] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionId, bid.questionId));
  if (!question || question.studentId !== req.user!.userId) {
    res.status(403).json({ error: "You can only pay for your own questions" });
    return;
  }

  // Check if payment already exists
  const [existingPayment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.bidId, bidId));
  if (existingPayment && existingPayment.status === "Succeeded") {
    res.status(400).json({ error: "Payment already completed" });
    return;
  }
  if (existingPayment && existingPayment.stripePaymentIntentId) {
    // Return existing payment intent
    res.json({
      paymentId: existingPayment.paymentId,
      clientSecret: null, // We need to get it from Stripe
      amount: existingPayment.amount,
      platformFee: existingPayment.platformFee,
      tutorAmount: existingPayment.tutorAmount,
    });
    return;
  }

  // Get or create Stripe customer for student
  const [student] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, req.user!.userId));

  let customerId = student.stripeCustomerId;
  if (!customerId) {
    let stripe;
    try { stripe = await safeStripeClient(); } catch (e: any) {
      res.status(503).json({ error: e.message });
      return;
    }
    const customer = await stripe.customers.create({
      email: student.email,
      name: student.name,
      metadata: { userId: String(student.userId) },
    });
    customerId = customer.id;
    await db
      .update(usersTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(usersTable.userId, student.userId));
  }

  const amount = bid.price;
  const platformFee = Math.round(amount * PLATFORM_COMMISSION_PCT * 100) / 100;
  const tutorAmount = Math.round((amount - platformFee) * 100) / 100;

  // Create PaymentIntent
  let stripe;
  try { stripe = await safeStripeClient(); } catch (e: any) {
    res.status(503).json({ error: e.message });
    return;
  }
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // cents
    currency: CURRENCY,
    customer: customerId,
    metadata: {
      bidId: String(bidId),
      studentId: String(student.userId),
      tutorId: String(bid.tutorId),
      questionId: String(question.questionId),
      platformFee: String(platformFee),
      tutorAmount: String(tutorAmount),
    },
    automatic_payment_methods: { enabled: true },
  });

  // Create payment record
  const [payment] = await db
    .insert(paymentsTable)
    .values({
      bidId,
      studentId: student.userId,
      tutorId: bid.tutorId,
      amount,
      platformFee,
      tutorAmount,
      stripePaymentIntentId: paymentIntent.id,
      status: "Pending",
    })
    .returning();

  res.json({
    paymentId: payment.paymentId,
    clientSecret: paymentIntent.client_secret,
    amount,
    platformFee,
    tutorAmount,
  });
});

// POST /api/payments/:id/confirm - Called after client confirms payment
router.post("/payments/:paymentId/confirm", authMiddleware, async (req, res): Promise<void> => {
  const paymentId = parseId(req.params["paymentId"]);
  if (isNaN(paymentId)) {
    res.status(400).json({ error: "Invalid payment ID" });
    return;
  }

  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.paymentId, paymentId));
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  if (payment.studentId !== req.user!.userId) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  if (payment.status !== "Pending" && payment.status !== "Processing") {
    res.status(400).json({ error: "Payment already finalized" });
    return;
  }

  // Verify with Stripe
  let stripe;
  try { stripe = await safeStripeClient(); } catch (e: any) {
    res.status(503).json({ error: e.message });
    return;
  }
  const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId!);

  if (intent.status === "succeeded") {
    // Update payment status
    await db
      .update(paymentsTable)
      .set({ status: "Succeeded" })
      .where(eq(paymentsTable.paymentId, paymentId));

    // Credit tutor wallet
    const [earnings] = await db
      .select()
      .from(tutorEarningsTable)
      .where(eq(tutorEarningsTable.tutorId, payment.tutorId));
    if (earnings) {
      await db
        .update(tutorEarningsTable)
        .set({
          totalEarned: earnings.totalEarned + payment.tutorAmount,
          balance: earnings.balance + payment.tutorAmount,
        })
        .where(eq(tutorEarningsTable.tutorId, payment.tutorId));
    } else {
      await db.insert(tutorEarningsTable).values({
        tutorId: payment.tutorId,
        totalEarned: payment.tutorAmount,
        totalWithdrawn: 0,
        balance: payment.tutorAmount,
      });
    }

    // Create session
    const [bid] = await db
      .select()
      .from(bidsTable)
      .where(eq(bidsTable.bidId, payment.bidId));
    const [question] = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.questionId, bid.questionId));

    let finalTime = new Date();
    if (bid.specificTime) {
      finalTime = new Date(bid.specificTime);
    }

    await db.insert(sessionsTable).values({
      questionId: bid.questionId,
      studentId: question.studentId,
      tutorId: bid.tutorId,
      finalTime,
      status: "Confirmed",
    });

    await db
      .update(questionsTable)
      .set({ status: "Scheduled" })
      .where(eq(questionsTable.questionId, bid.questionId));

    // Notify tutor
    await notify({
      userId: payment.tutorId,
      type: "payment_received",
      title: "Payment received!",
      message: `You earned SGD ${payment.tutorAmount.toFixed(2)} for "${question.title}". Check your wallet.`,
      relatedId: paymentId,
    });

    res.json({ status: "Succeeded", paymentId });
  } else if (intent.status === "requires_payment_method" || intent.status === "canceled") {
    await db
      .update(paymentsTable)
      .set({ status: "Failed" })
      .where(eq(paymentsTable.paymentId, paymentId));
    res.status(400).json({ status: "Failed", message: "Payment failed or was cancelled" });
  } else {
    await db
      .update(paymentsTable)
      .set({ status: "Processing" })
      .where(eq(paymentsTable.paymentId, paymentId));
    res.json({ status: "Processing", paymentId });
  }
});

// GET /api/payments - List student's payments
router.get("/payments", authMiddleware, async (req, res): Promise<void> => {
  const { studentId, tutorId, status } = req.query as {
    studentId?: string;
    tutorId?: string;
    status?: string;
  };

  const conditions = [];
  if (studentId) conditions.push(eq(paymentsTable.studentId, parseInt(studentId, 10)));
  if (tutorId) conditions.push(eq(paymentsTable.tutorId, parseInt(tutorId, 10)));
  if (status) conditions.push(eq(paymentsTable.status, status as any));

  const payments = await db
    .select()
    .from(paymentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(paymentsTable.createdAt);

  res.json(payments);
});

export default router;
