import {
  db,
  usersTable,
  paymentsTable,
  bidsTable,
  questionsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
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

// Toggle this to enable/disable Stripe payments
// When false: payments are auto-confirmed (manual mode for testing)
// When true: Stripe PaymentIntents are created (real payments)
const USE_STRIPE = false;

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

  // Get student info
  const [student] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, req.user!.userId));

  const amount = bid.price;
  const platformFee = Math.round(amount * PLATFORM_COMMISSION_PCT * 100) / 100;
  const tutorAmount = Math.round((amount - platformFee) * 100) / 100;

  let stripePaymentIntentId: string | null = null;
  let clientSecret: string | null = null;

  if (USE_STRIPE) {
    // Create Stripe customer if needed
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

    let stripe;
    try { stripe = await safeStripeClient(); } catch (e: any) {
      res.status(503).json({ error: e.message });
      return;
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
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
    stripePaymentIntentId = paymentIntent.id;
    clientSecret = paymentIntent.client_secret;
  }

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
      stripePaymentIntentId,
      status: USE_STRIPE ? "Pending" : "Processing",
    })
    .returning();

  res.json({
    paymentId: payment.paymentId,
    clientSecret,
    amount,
    platformFee,
    tutorAmount,
  });
});

// POST /api/payments/:id/paid - Student marks payment as paid (PayNow transfer done)
router.post("/payments/:paymentId/paid", authMiddleware, async (req, res): Promise<void> => {
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

  // Mark payment as "Paid" awaiting admin verification
  await db
    .update(paymentsTable)
    .set({ status: "Paid" })
    .where(eq(paymentsTable.paymentId, paymentId));

  // Notify admin(s)
  const [bid] = await db.select().from(bidsTable).where(eq(bidsTable.bidId, payment.bidId));
  const [question] = await db.select().from(questionsTable).where(eq(questionsTable.questionId, bid.questionId));

  const { notify } = await import("../lib/notify");
  const admins = await db
    .select({ userId: usersTable.userId })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
  for (const admin of admins) {
    await notify({
      userId: admin.userId,
      type: "payment_pending_verification",
      title: "Payment needs verification",
      message: `Student paid SGD ${payment.amount} for "${question.title}" via PayNow. Ref: TM-${paymentId}`,
      relatedId: paymentId,
    });
  }

  res.json({ status: "Paid", paymentId, paynowRef: `TM-${paymentId}` });
});

// Admin endpoints for payment verification
// GET /api/admin/payments - List all payments for admin review
router.get("/admin/payments", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  const { status } = req.query as { status?: string };

  const conditions = [];
  if (status) conditions.push(eq(paymentsTable.status, status as any));

  const payments = await db
    .select()
    .from(paymentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(paymentsTable.createdAt));

  // Enrich with student/tutor/question info
  const enriched = await Promise.all(
    payments.map(async (p) => {
      const [bid] = await db.select().from(bidsTable).where(eq(bidsTable.bidId, p.bidId));
      const [question] = bid
        ? await db.select().from(questionsTable).where(eq(questionsTable.questionId, bid.questionId))
        : [null];
      const [student] = await db.select().from(usersTable).where(eq(usersTable.userId, p.studentId));
      const [tutor] = await db.select().from(usersTable).where(eq(usersTable.userId, p.tutorId));
      const { password: _s, ...s } = student || {};
      const { password: _t, ...t } = tutor || {};
      return { ...p, question: question || null, student: s, tutor: t, paynowRef: `TM-${p.paymentId}` };
    })
  );

  res.json(enriched);
});

// PUT /api/admin/payments/:id/verify - Admin verifies PayNow payment
router.put("/admin/payments/:paymentId/verify", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

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

  if (payment.status !== "Paid" && payment.status !== "Processing") {
    res.status(400).json({ error: "Payment is not awaiting verification" });
    return;
  }

  await db
    .update(paymentsTable)
    .set({ status: "Succeeded" })
    .where(eq(paymentsTable.paymentId, paymentId));

  res.json({ status: "Succeeded", paymentId });
});

// PUT /api/admin/payments/:id/reject - Admin rejects payment (refunds not needed since no real charge)
router.put("/admin/payments/:paymentId/reject", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

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

  if (payment.status !== "Paid" && payment.status !== "Processing") {
    res.status(400).json({ error: "Payment is not awaiting verification" });
    return;
  }

  await db
    .update(paymentsTable)
    .set({ status: "Failed" })
    .where(eq(paymentsTable.paymentId, paymentId));

  res.json({ status: "Failed", paymentId });
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
