import {
  db,
  tutorEarningsTable,
  withdrawalsTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";

const WITHDRAWAL_MIN_AMOUNT = 50;
const WITHDRAWAL_COOLDOWN_DAYS = 7;

const router: IRouter = Router();

// GET /api/wallet - Get tutor's wallet balance and stats
router.get("/wallet", authMiddleware, async (req, res): Promise<void> => {
  const tutorId = req.user!.userId;
  if (req.user!.role !== "tutor") {
    res.status(403).json({ error: "Only tutors have a wallet" });
    return;
  }

  const [earnings] = await db
    .select()
    .from(tutorEarningsTable)
    .where(eq(tutorEarningsTable.tutorId, tutorId));

  if (!earnings) {
    res.json({
      tutorId,
      totalEarned: 0,
      totalWithdrawn: 0,
      balance: 0,
      lastWithdrawalAt: null,
      canWithdraw: false,
      minWithdrawal: WITHDRAWAL_MIN_AMOUNT,
      cooldownDays: WITHDRAWAL_COOLDOWN_DAYS,
    });
    return;
  }

  const canWithdraw =
    earnings.balance >= WITHDRAWAL_MIN_AMOUNT &&
    (!earnings.lastWithdrawalAt ||
      new Date().getTime() - new Date(earnings.lastWithdrawalAt).getTime() >=
        WITHDRAWAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  res.json({
    ...earnings,
    canWithdraw,
    minWithdrawal: WITHDRAWAL_MIN_AMOUNT,
    cooldownDays: WITHDRAWAL_COOLDOWN_DAYS,
  });
});

// POST /api/withdrawals - Request a withdrawal
router.post("/withdrawals", authMiddleware, async (req, res): Promise<void> => {
  const tutorId = req.user!.userId;
  if (req.user!.role !== "tutor") {
    res.status(403).json({ error: "Only tutors can request withdrawals" });
    return;
  }

  const { amount, method, bankDetails } = req.body as {
    amount?: number;
    method?: "Manual" | "StripeConnect";
    bankDetails?: string;
  };

  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  if (amount < WITHDRAWAL_MIN_AMOUNT) {
    res.status(400).json({ error: `Minimum withdrawal is SGD ${WITHDRAWAL_MIN_AMOUNT}` });
    return;
  }

  const [earnings] = await db
    .select()
    .from(tutorEarningsTable)
    .where(eq(tutorEarningsTable.tutorId, tutorId));

  if (!earnings || earnings.balance < amount) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  // Check cooldown
  if (
    earnings.lastWithdrawalAt &&
    new Date().getTime() - new Date(earnings.lastWithdrawalAt).getTime() <
      WITHDRAWAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  ) {
    const nextDate = new Date(new Date(earnings.lastWithdrawalAt).getTime() + WITHDRAWAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    res.status(400).json({
      error: `You can withdraw again after ${nextDate.toLocaleDateString("en-SG")}`,
    });
    return;
  }

  // Deduct balance immediately (Pending)
  await db
    .update(tutorEarningsTable)
    .set({
      balance: earnings.balance - amount,
      totalWithdrawn: earnings.totalWithdrawn + amount,
      lastWithdrawalAt: new Date(),
    })
    .where(eq(tutorEarningsTable.tutorId, tutorId));

  const [withdrawal] = await db
    .insert(withdrawalsTable)
    .values({
      tutorId,
      amount,
      method: method ?? "Manual",
      status: "Pending",
      bankDetails: bankDetails ?? null,
    })
    .returning();

  res.status(201).json(withdrawal);
});

// GET /api/withdrawals - List tutor's withdrawals
router.get("/withdrawals", authMiddleware, async (req, res): Promise<void> => {
  const tutorId = req.user!.userId;
  const { status } = req.query as { status?: string };

  const conditions = [eq(withdrawalsTable.tutorId, tutorId)];
  if (status) conditions.push(eq(withdrawalsTable.status, status as any));

  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .orderBy(desc(withdrawalsTable.requestedAt));

  res.json(withdrawals);
});

// PUT /api/withdrawals/:id/approve - Admin approves a manual withdrawal
router.put("/withdrawals/:withdrawalId/approve", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Only admins can approve withdrawals" });
    return;
  }

  const withdrawalId = parseInt(
    Array.isArray(req.params["withdrawalId"]) ? req.params["withdrawalId"][0] : req.params["withdrawalId"],
    10
  );

  const [withdrawal] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.withdrawalId, withdrawalId));

  if (!withdrawal) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  if (withdrawal.status !== "Pending") {
    res.status(400).json({ error: "Withdrawal is not pending" });
    return;
  }

  const [updated] = await db
    .update(withdrawalsTable)
    .set({
      status: "Processed",
      processedAt: new Date(),
      processedBy: req.user!.userId,
    })
    .where(eq(withdrawalsTable.withdrawalId, withdrawalId))
    .returning();

  res.json(updated);
});

// PUT /api/withdrawals/:id/reject - Admin rejects a withdrawal (refunds balance)
router.put("/withdrawals/:withdrawalId/reject", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Only admins can reject withdrawals" });
    return;
  }

  const withdrawalId = parseInt(
    Array.isArray(req.params["withdrawalId"]) ? req.params["withdrawalId"][0] : req.params["withdrawalId"],
    10
  );

  const [withdrawal] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.withdrawalId, withdrawalId));

  if (!withdrawal) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  if (withdrawal.status !== "Pending") {
    res.status(400).json({ error: "Withdrawal is not pending" });
    return;
  }

  // Refund balance to tutor
  const [earnings] = await db
    .select()
    .from(tutorEarningsTable)
    .where(eq(tutorEarningsTable.tutorId, withdrawal.tutorId));

  if (earnings) {
    await db
      .update(tutorEarningsTable)
      .set({
        balance: earnings.balance + withdrawal.amount,
        totalWithdrawn: earnings.totalWithdrawn - withdrawal.amount,
      })
      .where(eq(tutorEarningsTable.tutorId, withdrawal.tutorId));
  }

  const [updated] = await db
    .update(withdrawalsTable)
    .set({
      status: "Rejected",
      processedAt: new Date(),
      processedBy: req.user!.userId,
    })
    .where(eq(withdrawalsTable.withdrawalId, withdrawalId))
    .returning();

  res.json(updated);
});

// GET /api/admin/withdrawals - Admin lists all pending withdrawals
router.get("/admin/withdrawals", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  const { status } = req.query as { status?: string };

  const conditions = [];
  if (status) conditions.push(eq(withdrawalsTable.status, status as any));

  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(withdrawalsTable.requestedAt));

  res.json(withdrawals);
});

export default router;
