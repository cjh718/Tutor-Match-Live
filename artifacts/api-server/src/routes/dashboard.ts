import {
  db,
  sessionsTable,
  usersTable,
  questionsTable,
  bidsTable,
  tutorProfilesTable,
  reviewsTable,
} from "@workspace/db";
import { and, avg, count, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

// ========== STUDENT DASHBOARD ==========
router.get(
  "/dashboard/student/:studentId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const studentId = parseId(req.params["studentId"]);
    if (isNaN(studentId)) {
      res.status(400).json({ error: "Invalid student ID" });
      return;
    }

    // 1. Open Questions
    const [openQuestionsCount] = await db
      .select({ value: count() })
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.studentId, studentId),
          eq(questionsTable.status, "Open"),
        ),
      );

    // 2. Bids Received = questions with status "BidReceived"
    const [bidsReceivedCount] = await db
      .select({ value: count() })
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.studentId, studentId),
          eq(questionsTable.status, "BidReceived"),
        ),
      );

    // 3. Upcoming Sessions = Confirmed sessions
    const [studentUpcomingSessionsCount] = await db
      .select({ value: count() })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.studentId, studentId),
          eq(sessionsTable.status, "Confirmed"),
        ),
      );

    // 4. Completed Sessions
    const [studentCompletedSessionsCount] = await db
      .select({ value: count() })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.studentId, studentId),
          eq(sessionsTable.status, "Completed"),
        ),
      );

    // Recent Questions (for display)
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
        const [student] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.userId, q.studentId));
        const { password: _, ...studentWithoutPassword } = student;
        return {
          ...q,
          student: studentWithoutPassword,
          bidCount: Number(bidCount),
        };
      }),
    );

    // Upcoming Sessions List (for display)
    const upcomingSessionsList = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.studentId, studentId),
          eq(sessionsTable.status, "Confirmed"),
        ),
      )
      .limit(5);

    const upcomingEnriched = await Promise.all(
      upcomingSessionsList.map(async (s) => {
        const [student] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.userId, s.studentId));
        const [tutor] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.userId, s.tutorId));
        const [question] = await db
          .select()
          .from(questionsTable)
          .where(eq(questionsTable.questionId, s.questionId));
        const { password: _s, ...studentWithoutPassword } = student;
        const { password: _t, ...tutorWithoutPassword } = tutor;
        return {
          ...s,
          student: studentWithoutPassword,
          tutor: tutorWithoutPassword,
          question,
        };
      }),
    );

    res.json({
      openQuestions: Number(openQuestionsCount.value),
      bidsReceived: Number(bidsReceivedCount.value),
      pendingTutors: 0,
      upcomingSessions: Number(studentUpcomingSessionsCount.value),
      completedSessions: Number(studentCompletedSessionsCount.value),
      totalSpent: 0,
      recentQuestions: recentWithStudents,
      upcomingSessionsList: upcomingEnriched,
    });
  },
);

// ========== TUTOR DASHBOARD ==========
router.get(
  "/dashboard/tutor/:tutorId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const tutorId = parseId(req.params["tutorId"]);
    if (isNaN(tutorId)) {
      res.status(400).json({ error: "Invalid tutor ID" });
      return;
    }

    // 1. Open Bids = Pending bids on Open or BidReceived questions
    const [tutorOpenBidsCount] = await db
      .select({ value: count() })
      .from(bidsTable)
      .innerJoin(questionsTable, eq(bidsTable.questionId, questionsTable.questionId))
      .where(
        and(
          eq(bidsTable.tutorId, tutorId),
          eq(bidsTable.status, "Pending"),
        ),
      );

    // 2. Accepted Bids = bids with Accepted status (session confirmed)
    const [tutorAcceptedBidsCount] = await db
      .select({ value: count() })
      .from(bidsTable)
      .where(
        and(
          eq(bidsTable.tutorId, tutorId),
          eq(bidsTable.status, "Accepted"),
        ),
      );

    // 3. Upcoming Sessions = Confirmed sessions
    const [tutorUpcomingSessionsCount] = await db
      .select({ value: count() })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.tutorId, tutorId),
          eq(sessionsTable.status, "Confirmed"),
        ),
      );

    // 4. Completed Sessions
    const [tutorCompletedSessionsCount] = await db
      .select({ value: count() })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.tutorId, tutorId),
          eq(sessionsTable.status, "Completed"),
        ),
      );

    // Total earned from completed sessions
    const completedSessionsData = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.tutorId, tutorId),
          eq(sessionsTable.status, "Completed"),
        ),
      );

    let totalEarned = 0;
    for (const session of completedSessionsData) {
      const [bid] = await db
        .select()
        .from(bidsTable)
        .where(
          and(
            eq(bidsTable.questionId, session.questionId),
            eq(bidsTable.tutorId, tutorId),
          ),
        );
      if (bid) totalEarned += bid.price;
    }

    // Average rating
    const [{ value: avgRating }] = await db
      .select({ value: avg(reviewsTable.rating) })
      .from(reviewsTable)
      .where(eq(reviewsTable.tutorId, tutorId));

    // Recent bids (for display)
    const recentBidsData = await db
      .select()
      .from(bidsTable)
      .where(eq(bidsTable.tutorId, tutorId))
      .orderBy(bidsTable.createdDate)
      .limit(5);

    const recentBidsEnriched = await Promise.all(
      recentBidsData.reverse().map(async (bid) => {
        const [question] = await db
          .select()
          .from(questionsTable)
          .where(eq(questionsTable.questionId, bid.questionId));
        return { ...bid, question };
      }),
    );

    // Upcoming sessions list (for display)
    const upcomingSessionsList = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.tutorId, tutorId),
          eq(sessionsTable.status, "Confirmed"),
        ),
      )
      .limit(5);

    const upcomingEnriched = await Promise.all(
      upcomingSessionsList.map(async (s) => {
        const [student] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.userId, s.studentId));
        const [tutor] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.userId, s.tutorId));
        const [question] = await db
          .select()
          .from(questionsTable)
          .where(eq(questionsTable.questionId, s.questionId));
        const { password: _s, ...studentWithoutPassword } = student;
        const { password: _t, ...tutorWithoutPassword } = tutor;
        return {
          ...s,
          student: studentWithoutPassword,
          tutor: tutorWithoutPassword,
          question,
        };
      }),
    );

    res.json({
      openBids: Number(tutorOpenBidsCount.value),
      acceptedBids: Number(tutorAcceptedBidsCount.value),
      upcomingSessions: Number(tutorUpcomingSessionsCount.value),
      completedSessions: Number(tutorCompletedSessionsCount.value),
      totalEarned,
      averageRating: avgRating
        ? parseFloat(parseFloat(avgRating).toFixed(2))
        : 0,
      recentBids: recentBidsEnriched,
      upcomingSessionsList: upcomingEnriched,
    });
  },
);

export default router;
