import {
  db,
  bidsTable,
  tutorProfilesTable,
  usersTable,
  questionsTable,
} from "@workspace/db";
import { and, eq, SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";
import { notify } from "../lib/notify";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

async function enrichBid(bid: typeof bidsTable.$inferSelect) {
  const [tutor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, bid.tutorId));
  const { password: _, ...tutorWithoutPassword } = tutor;
  const [tutorProfile] = await db
    .select()
    .from(tutorProfilesTable)
    .where(eq(tutorProfilesTable.tutorId, bid.tutorId));
  return {
    ...bid,
    tutor: tutorWithoutPassword,
    tutorProfile: tutorProfile ?? null,
  };
}

router.get("/bids", authMiddleware, async (req, res): Promise<void> => {
  const { questionId, tutorId, status } = req.query as {
    questionId?: string;
    tutorId?: string;
    status?: string;
  };

  const conditions: SQL[] = [];
  if (questionId)
    conditions.push(eq(bidsTable.questionId, parseInt(questionId, 10)));
  if (tutorId) conditions.push(eq(bidsTable.tutorId, parseInt(tutorId, 10)));
  if (status)
    conditions.push(
      eq(bidsTable.status, status as "Pending" | "Accepted" | "Rejected"),
    );

  const bids = await db
    .select()
    .from(bidsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(bidsTable.createdDate);

  const result = await Promise.all(bids.map(enrichBid));
  res.json(result);
});

router.post("/bids", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "tutor") {
    res.status(403).json({ error: "Only tutors can submit bids" });
    return;
  }

  const { questionId, price, message } = req.body as {
    questionId?: number;
    price?: number;
    message?: string;
  };

  if (!questionId || !price || !message) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [question] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionId, questionId));

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  // Allow bids on "Open" or "BidReceived"
  if (question.status !== "Open" && question.status !== "BidReceived") {
    res.status(400).json({ error: "Question is no longer open for bids" });
    return;
  }

  const [bid] = await db
    .insert(bidsTable)
    .values({
      questionId,
      tutorId: req.user!.userId,
      price,
      message,
    })
    .returning();

  // If status was "Open", change to "BidReceived"
  if (question.status === "Open") {
    await db
      .update(questionsTable)
      .set({ status: "BidReceived" })
      .where(eq(questionsTable.questionId, questionId));
  }

  const [tutor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, req.user!.userId));

  await notify({
    userId: question.studentId,
    type: "new_bid",
    title: "New bid on your question",
    message: `${tutor.name} submitted a bid of SGD ${price} on "${question.title}"`,
    relatedId: bid.bidId,
  });

  const enriched = await enrichBid(bid);
  res.status(201).json(enriched);
});

router.get("/bids/:bidId", authMiddleware, async (req, res): Promise<void> => {
  const bidId = parseId(req.params["bidId"]);
  if (isNaN(bidId)) {
    res.status(400).json({ error: "Invalid bid ID" });
    return;
  }

  const [bid] = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.bidId, bidId));
  if (!bid) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }

  const enriched = await enrichBid(bid);
  res.json(enriched);
});

router.put("/bids/:bidId", authMiddleware, async (req, res): Promise<void> => {
  const bidId = parseId(req.params["bidId"]);
  if (isNaN(bidId)) {
    res.status(400).json({ error: "Invalid bid ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.bidId, bidId));
  if (!existing) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }

  const { status } = req.body as { status?: string };
  if (!status || !["Pending", "Accepted", "Rejected", "Withdrawn"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const [question] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionId, existing.questionId));

  if (status === "Accepted") {
    if (question.studentId !== req.user!.userId) {
      res
        .status(403)
        .json({ error: "Only the student who posted can accept bids" });
      return;
    }

    // Reject all other pending bids for this question
    await db
      .update(bidsTable)
      .set({ status: "Rejected" })
      .where(
        and(
          eq(bidsTable.questionId, existing.questionId),
          eq(bidsTable.status, "Pending"),
        ),
      );

    // Update question status to "Matched"
    await db
      .update(questionsTable)
      .set({ status: "Matched" })
      .where(eq(questionsTable.questionId, existing.questionId));

    const [student] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.userId, question.studentId));

    await notify({
      userId: existing.tutorId,
      type: "bid_accepted",
      title: "Your bid was accepted",
      message: `${student.name} accepted your bid on "${question.title}"`,
      relatedId: bidId,
    });
  }

  const [bid] = await db
    .update(bidsTable)
    .set({ status: status as "Pending" | "Accepted" | "Rejected" })
    .where(eq(bidsTable.bidId, bidId))
    .returning();

  const enriched = await enrichBid(bid);
  res.json(enriched);
});

export default router;
