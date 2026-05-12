import {
  db,
  questionsTable,
  sessionsTable,
  bidsTable,
  reviewsTable,
  usersTable,
} from "@workspace/db";
import { and, avg, count, eq, ne, sum } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

router.get("/dashboard/student/:studentId", authMiddleware, async (req, res): Promise<void> => {
  const studentId = parseId(req.params["studentId"]);
  if (isNaN(studentId)) {
    res.status(400).json({ error: "Invalid student ID" });
    return;
  }

  const [openCount] = await db
    .select({ value: count() })
    .from(questionsTable)
    .where(and(eq(questionsTable.studentId, studentId), eq(questionsTable.status, "Open")));

  const [matchedCount] = await db
    .select({ value: count() })
    .from(questionsTable)
    .where(and(eq(questionsTable.studentId, studentId), eq(questionsTable.status, "Matched")));

  const [scheduledCount] = await db
    .select({ value: count() })
    .from(sessionsTable)
    .where(
      and(eq(sessionsTable.studentId, studentId), eq(sessionsTable.status, "Confirmed"))
    );

  const [completedCount] = await db
    .select({ value: count() })
    .from(sessionsTable)
    .where(
      and(eq(sessionsTable.studentId, studentId), eq(sessionsTable.status, "Completed"))
    );

  const pendingBidsQuery = await db
    .select({ value: count() })
    .from(bidsTable)
    .innerJoin(questionsTable, eq(bidsTable.questionId, questionsTable.questionId))
    .where(
      and(eq(questionsTable.studentId, studentId), eq(bidsTable.status, "Pending"))
    );
  const [pendingBids] = pendingBidsQuery;

  const recentQuestions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.studentId, studentId))
    .orderBy(questionsTable.createdDate)
    .limit(5);

  const recentWithStudents = await Promise.all(
    recentQuestions.reverse().map(async (q) => {
      const [{ value: bidCount }] = await db
        .select({ value: count() })
        .from(bidsTable)
        .where(eq(bidsTable.questionId, q.questionId));
      const [student] = await db.select().from(usersTable).where(eq(usersTable.userId, q.studentId));
      const { password: _, ...studentWithoutPassword } = student;
      return { ...q, student: studentWithoutPassword, bidCount: Number(bidCount) };
    })
  );

  const upcomingSessions = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.studentId, studentId), eq(sessionsTable.status, "Confirmed")))
    .limit(5);

  const upcomingEnriched = await Promise.all(
    upcomingSessions.map(async (s) => {
      const [student] = await db.select().from(usersTable).where(eq(usersTable.userId, s.studentId));
      const [tutor] = await db.select().from(usersTable).where(eq(usersTable.userId, s.tutorId));
      const [question] = await db.select().from(questionsTable).where(eq(questionsTable.questionId, s.questionId));
      const { password: _s, ...studentWithoutPassword } = student;
      const { password: _t, ...tutorWithoutPassword } = tutor;
      return { ...s, student: studentWithoutPassword, tutor: tutorWithoutPassword, question };
    })
  );

  res.json({
    openQuestions: Number(openCount.value),
    matchedQuestions: Number(matchedCount.value),
    scheduledSessions: Number(scheduledCount.value),
    completedSessions: Number(completedCount.value),
    totalSpent: 0,
    pendingBids: Number(pendingBids.value),
    recentQuestions: recentWithStudents,
    upcomingSessions: upcomingEnriched,
  });
});

router.get("/dashboard/tutor/:tutorId", authMiddleware, async (req, res): Promise<void> => {
  const tutorId = parseId(req.params["tutorId"]);
  if (isNaN(tutorId)) {
    res.status(400).json({ error: "Invalid tutor ID" });
    return;
  }

  const [openBids] = await db
    .select({ value: count() })
    .from(bidsTable)
    .where(and(eq(bidsTable.tutorId, tutorId), eq(bidsTable.status, "Pending")));

  const [acceptedBids] = await db
    .select({ value: count() })
    .from(bidsTable)
    .where(and(eq(bidsTable.tutorId, tutorId), eq(bidsTable.status, "Accepted")));

  const [scheduledSessions] = await db
    .select({ value: count() })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.tutorId, tutorId), eq(sessionsTable.status, "Confirmed")));

  const [completedSessions] = await db
    .select({ value: count() })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.tutorId, tutorId), eq(sessionsTable.status, "Completed")));

  const [avgRating] = await db
    .select({ value: avg(reviewsTable.rating) })
    .from(reviewsTable)
    .where(eq(reviewsTable.tutorId, tutorId));

  const recentBids = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.tutorId, tutorId))
    .orderBy(bidsTable.createdDate)
    .limit(5);

  const recentBidsEnriched = await Promise.all(
    recentBids.reverse().map(async (b) => {
      const [tutor] = await db.select().from(usersTable).where(eq(usersTable.userId, b.tutorId));
      const { password: _, ...tutorWithoutPassword } = tutor;
      return { ...b, tutor: tutorWithoutPassword, tutorProfile: null };
    })
  );

  const upcomingSessions = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.tutorId, tutorId), eq(sessionsTable.status, "Confirmed")))
    .limit(5);

  const upcomingEnriched = await Promise.all(
    upcomingSessions.map(async (s) => {
      const [student] = await db.select().from(usersTable).where(eq(usersTable.userId, s.studentId));
      const [tutor] = await db.select().from(usersTable).where(eq(usersTable.userId, s.tutorId));
      const [question] = await db.select().from(questionsTable).where(eq(questionsTable.questionId, s.questionId));
      const { password: _s, ...studentWithoutPassword } = student;
      const { password: _t, ...tutorWithoutPassword } = tutor;
      return { ...s, student: studentWithoutPassword, tutor: tutorWithoutPassword, question };
    })
  );

  res.json({
    openBids: Number(openBids.value),
    acceptedBids: Number(acceptedBids.value),
    scheduledSessions: Number(scheduledSessions.value),
    completedSessions: Number(completedSessions.value),
    totalEarned: 0,
    averageRating: avgRating.value ? parseFloat(avgRating.value) : 0,
    recentBids: recentBidsEnriched,
    upcomingSessions: upcomingEnriched,
  });
});

export default router;
