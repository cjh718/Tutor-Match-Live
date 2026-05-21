import {
  db,
  sessionsTable,
  usersTable,
  questionsTable,
  bidsTable,
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

async function enrichSession(session: typeof sessionsTable.$inferSelect) {
  const [student] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, session.studentId));
  const [tutor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, session.tutorId));
  const [question] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionId, session.questionId));

  const { password: _s, ...studentWithoutPassword } = student;
  const { password: _t, ...tutorWithoutPassword } = tutor;

  return {
    ...session,
    student: studentWithoutPassword,
    tutor: tutorWithoutPassword,
    question,
  };
}

router.get("/sessions", authMiddleware, async (req, res): Promise<void> => {
  const { studentId, tutorId, questionId, status } = req.query as {
    studentId?: string;
    tutorId?: string;
    questionId?: string;
    status?: string;
  };

  const conditions: SQL[] = [];
  if (studentId)
    conditions.push(eq(sessionsTable.studentId, parseInt(studentId, 10)));
  if (tutorId)
    conditions.push(eq(sessionsTable.tutorId, parseInt(tutorId, 10)));
  if (questionId)
    conditions.push(eq(sessionsTable.questionId, parseInt(questionId, 10)));
  if (status) {
    conditions.push(
      eq(sessionsTable.status, status as "Matched" | "Confirmed" | "Completed" | "Cancelled"),
    );
  }

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const result = await Promise.all(sessions.map(enrichSession));
  res.json(result);
});

router.get(
  "/sessions/:sessionId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const sessionId = parseId(req.params["sessionId"]);
    if (isNaN(sessionId)) {
      res.status(400).json({ error: "Invalid session ID" });
      return;
    }

    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.sessionId, sessionId));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const enriched = await enrichSession(session);
    res.json(enriched);
  },
);

router.put(
  "/sessions/:sessionId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const sessionId = parseId(req.params["sessionId"]);
    if (isNaN(sessionId)) {
      res.status(400).json({ error: "Invalid session ID" });
      return;
    }

    const [existing] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.sessionId, sessionId));

    if (!existing) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const { meetingLink, status } = req.body as {
      meetingLink?: string;
      status?: string;
    };

    // Role guards
    if (meetingLink !== undefined && req.user!.role !== "tutor") {
      res.status(403).json({ error: "Only tutors can add a meeting link" });
      return;
    }
    if (status === "Completed" && req.user!.role !== "tutor") {
      res.status(403).json({ error: "Only tutors can mark sessions as completed" });
      return;
    }

    const updates: Partial<typeof sessionsTable.$inferInsert> = {};
    if (meetingLink !== undefined) updates.meetingLink = meetingLink;
    if (status !== undefined) {
      updates.status = status as "Matched" | "Confirmed" | "Completed" | "Cancelled";
    }

    const [session] = await db
      .update(sessionsTable)
      .set(updates)
      .where(eq(sessionsTable.sessionId, sessionId))
      .returning();

    const [student] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.userId, session.studentId));
    const [tutor] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.userId, session.tutorId));
    const [question] = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.questionId, session.questionId));

    // When tutor adds a meeting link, update session to "Confirmed" and question to "Scheduled"
    if (meetingLink) {
      // Update session status to "Confirmed"
      await db
        .update(sessionsTable)
        .set({ status: "Confirmed" })
        .where(eq(sessionsTable.sessionId, sessionId));

      // Update question status to "Scheduled"
      await db
        .update(questionsTable)
        .set({ status: "Scheduled" })
        .where(eq(questionsTable.questionId, session.questionId));

      await notify({
        userId: session.studentId,
        type: "meeting_link_added",
        title: "Meeting link added",
        message: `${tutor.name} added a meeting link for your session on "${question.title}"`,
        relatedId: sessionId,
      });
    }

    if (status === "Completed") {
      await db
        .update(questionsTable)
        .set({ status: "Completed" })
        .where(eq(questionsTable.questionId, session.questionId));

      await notify({
        userId: session.studentId,
        type: "session_completed",
        title: "Session completed",
        message: `${tutor.name} marked the session for "${question.title}" as completed`,
        relatedId: sessionId,
      });
    }

    if (status === "Cancelled") {
      await db
        .update(questionsTable)
        .set({ status: "Cancelled" })
        .where(eq(questionsTable.questionId, session.questionId));
    }

    // Get the updated session with new status
    const [updatedSession] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.sessionId, sessionId));

    const enriched = await enrichSession(updatedSession);
    res.json(enriched);
  },
);

export default router;