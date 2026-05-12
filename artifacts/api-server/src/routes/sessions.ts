import { db, sessionsTable, usersTable, questionsTable, bidsTable } from "@workspace/db";
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
  const { studentId, tutorId, status } = req.query as {
    studentId?: string;
    tutorId?: string;
    status?: string;
  };

  const conditions: SQL[] = [];
  if (studentId) conditions.push(eq(sessionsTable.studentId, parseInt(studentId, 10)));
  if (tutorId) conditions.push(eq(sessionsTable.tutorId, parseInt(tutorId, 10)));
  if (status) {
    conditions.push(
      eq(
        sessionsTable.status,
        status as "Pending Confirmation" | "Confirmed" | "Completed" | "Cancelled"
      )
    );
  }

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const result = await Promise.all(sessions.map(enrichSession));
  res.json(result);
});

router.post("/sessions", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "student") {
    res.status(403).json({ error: "Only students can propose sessions" });
    return;
  }

  const { questionId, tutorId, proposedTime } = req.body as {
    questionId?: number;
    tutorId?: number;
    proposedTime?: string;
  };

  if (!questionId || !tutorId || !proposedTime) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({
      questionId,
      studentId: req.user!.userId,
      tutorId,
      proposedTime: new Date(proposedTime),
    })
    .returning();

  await db
    .update(questionsTable)
    .set({ status: "Scheduled" })
    .where(eq(questionsTable.questionId, questionId));

  const [student] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, req.user!.userId));
  const [question] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionId, questionId));

  await notify({
    userId: tutorId,
    type: "session_proposed",
    title: "Session time proposed",
    message: `${student.name} proposed a session time for "${question.title}"`,
    relatedId: session.sessionId,
  });

  const enriched = await enrichSession(session);
  res.status(201).json(enriched);
});

router.get("/sessions/:sessionId", authMiddleware, async (req, res): Promise<void> => {
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
});

router.put("/sessions/:sessionId", authMiddleware, async (req, res): Promise<void> => {
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

  const { proposedTime, tutorCounterTime, finalTime, meetingLink, status } = req.body as {
    proposedTime?: string;
    tutorCounterTime?: string;
    finalTime?: string;
    meetingLink?: string;
    status?: string;
  };

  const updates: Partial<typeof sessionsTable.$inferInsert> = {};
  if (proposedTime !== undefined) updates.proposedTime = new Date(proposedTime);
  if (tutorCounterTime !== undefined) updates.tutorCounterTime = new Date(tutorCounterTime);
  if (finalTime !== undefined) updates.finalTime = new Date(finalTime);
  if (meetingLink !== undefined) updates.meetingLink = meetingLink;
  if (status !== undefined) {
    updates.status = status as "Pending Confirmation" | "Confirmed" | "Completed" | "Cancelled";
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

  if (tutorCounterTime) {
    await notify({
      userId: session.studentId,
      type: "time_countered",
      title: "Tutor proposed a different time",
      message: `${tutor.name} countered the session time for "${question.title}"`,
      relatedId: sessionId,
    });
  }

  if (status === "Confirmed") {
    const notifyUserId =
      req.user!.userId === session.studentId ? session.tutorId : session.studentId;
    const confirmerName =
      req.user!.userId === session.studentId ? student.name : tutor.name;
    await notify({
      userId: notifyUserId,
      type: "session_confirmed",
      title: "Session confirmed",
      message: `${confirmerName} confirmed the session for "${question.title}"`,
      relatedId: sessionId,
    });
  }

  if (meetingLink) {
    await notify({
      userId: session.studentId,
      type: "meeting_link_added",
      title: "Meeting link added",
      message: `${tutor.name} added a meeting link for your session`,
      relatedId: sessionId,
    });
  }

  if (status === "Completed") {
    await db
      .update(questionsTable)
      .set({ status: "Completed" })
      .where(eq(questionsTable.questionId, session.questionId));
  }

  const enriched = await enrichSession(session);
  res.json(enriched);
});

export default router;
