import { db, questionsTable, usersTable, bidsTable, sessionsTable } from "@workspace/db";
import { and, count, eq, SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

router.get("/questions", authMiddleware, async (req, res): Promise<void> => {
  const { status, subject, studentId } = req.query as {
    status?: string;
    subject?: string;
    studentId?: string;
  };

  const conditions: SQL[] = [];
  if (status)
    conditions.push(
      eq(
        questionsTable.status,
        status as
          | "Open"
          | "BidReceived"
          | "Scheduled"
          | "Completed"
          | "Cancelled",
      ),
    );
  if (subject) conditions.push(eq(questionsTable.subject, subject));
  if (studentId)
    conditions.push(eq(questionsTable.studentId, parseInt(studentId, 10)));

  const questions = await db
    .select()
    .from(questionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(questionsTable.createdDate);

  const result = await Promise.all(
    questions.map(async (q) => {
      const [student] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.userId, q.studentId));
      const { password: _, ...studentWithoutPassword } = student;
      const [{ value: bidCount }] = await db
        .select({ value: count() })
        .from(bidsTable)
        .where(eq(bidsTable.questionId, q.questionId));
      return {
        ...q,
        student: studentWithoutPassword,
        bidCount: Number(bidCount),
      };
    }),
  );

  res.json(result);
});

router.post("/questions", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "student") {
    res.status(403).json({ error: "Only students can post questions" });
    return;
  }

  const {
    title,
    description,
    subject,
    attachmentUrl,
    optionalBudget,
  } = req.body as {
    title?: string;
    description?: string;
    subject?: string;
    attachmentUrl?: string;
    optionalBudget?: number;
  };

  if (!title || !description || !subject ) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [question] = await db
    .insert(questionsTable)
    .values({
      studentId: req.user!.userId,
      title,
      description,
      subject,
      attachmentUrl: attachmentUrl ?? null,
      optionalBudget: optionalBudget ?? null,
    })
    .returning();

  const [student] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, req.user!.userId));
  const { password: _, ...studentWithoutPassword } = student;

  res
    .status(201)
    .json({ ...question, student: studentWithoutPassword, bidCount: 0 });
});

router.get(
  "/questions/:questionId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const questionId = parseId(req.params["questionId"]);
    if (isNaN(questionId)) {
      res.status(400).json({ error: "Invalid question ID" });
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

    const [student] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.userId, question.studentId));
    const { password: _, ...studentWithoutPassword } = student;
    const [{ value: bidCount }] = await db
      .select({ value: count() })
      .from(bidsTable)
      .where(eq(bidsTable.questionId, questionId));

    res.json({
      ...question,
      student: studentWithoutPassword,
      bidCount: Number(bidCount),
    });
  },
);

router.put(
  "/questions/:questionId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const questionId = parseId(req.params["questionId"]);
    if (isNaN(questionId)) {
      res.status(400).json({ error: "Invalid question ID" });
      return;
    }

    const [existing] = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.questionId, questionId));

    if (!existing) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    if (existing.studentId !== req.user!.userId && req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const {
      status,
      title,
      description,
      subject,
      preferredDuration,
      optionalBudget,
    } = req.body as {
      status?: string;
      title?: string;
      description?: string;
      subject?: string;
      preferredDuration?: number;
      optionalBudget?: number | null;
    };

    // Build update payload — only allow content edits when still Open
    const updateData: Partial<typeof questionsTable.$inferInsert> = {};

    if (status) {
      updateData.status = status as
        | "Open"
        | "BidReceived"
        | "Scheduled"
        | "Completed"
        | "Cancelled";
    }

    if (existing.status === "Open") {
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (subject !== undefined) updateData.subject = subject;
      if (optionalBudget !== undefined)
        updateData.optionalBudget = optionalBudget;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    const [question] = await db
      .update(questionsTable)
      .set(updateData)
      .where(eq(questionsTable.questionId, questionId))
      .returning();

    const [student] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.userId, question.studentId));
    const { password: _, ...studentWithoutPassword } = student;
    const [{ value: bidCount }] = await db
      .select({ value: count() })
      .from(bidsTable)
      .where(eq(bidsTable.questionId, questionId));

    res.json({
      ...question,
      student: studentWithoutPassword,
      bidCount: Number(bidCount),
    });
  },
);

// ========== ADD THIS DELETE ENDPOINT ==========
router.delete(
  "/questions/:questionId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const questionId = parseId(req.params["questionId"]);
    if (isNaN(questionId)) {
      res.status(400).json({ error: "Invalid question ID" });
      return;
    }

    const [existing] = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.questionId, questionId));

    if (!existing) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    // Check if user is authorized (owner or admin)
    if (existing.studentId !== req.user!.userId && req.user!.role !== "admin") {
      res
        .status(403)
        .json({ error: "Forbidden - You can only delete your own questions" });
      return;
    }

    // Only prevent deletion for certain statuses
    if (
      existing.status === "Scheduled" ||
      existing.status === "Completed"
    ) {
      res.status(400).json({
        error:
          "Cannot delete question that is already in progress or completed",
      });
      return;
    }

    // ✅ DELETE RELATED BIDS FIRST
    await db
      .delete(bidsTable)
      .where(eq(bidsTable.questionId, questionId));

    // ✅ DELETE ANY RELATED SESSIONS
    await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.questionId, questionId));

    // Then delete the question
    await db
      .delete(questionsTable)
      .where(eq(questionsTable.questionId, questionId));

    res.status(204).send();
  },
);
// ========== END OF ADDED DELETE ENDPOINT ==========

export default router;
