import {
  db,
  sessionsTable,
  usersTable,
  questionsTable,
  bidsTable,
  tutorProfilesTable,
  reviewsTable,
} from "@workspace/db";
import { and, avg, count, eq, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

router.get(
  "/dashboard/student/:studentId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const studentId = parseId(req.params["studentId"]);
    if (isNaN(studentId)) {
      res.status(400).json({ error: "Invalid student ID" });
      return;
    }

    // Open Questions = "Open"
    const [openCount] = await db
      .select({ value: count() })
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.studentId, studentId),
          eq(questionsTable.status, "Open"),
        ),
      );

    // Bids Received = "BidReceived"
    const [bidReceivedCount] = await db
      .select({ value: count() })
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.studentId, studentId),
          eq(questionsTable.status, "BidReceived"),
        ),
      );

    // Upcoming Sessions = "Matched" + "Scheduled"
    const [upcomingCount] = await db
      .select({ value: count() })
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.studentId, studentId),
          or(
            eq(questionsTable.status, "Matched"),
            eq(questionsTable.status, "Scheduled")
          )
        )
      );

    // Pending Tutors = "PendingConfirmation" (from sessions)
    const [pendingConfirmation] = await db
      .select({ value: count() })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.studentId, studentId),
          eq(sessionsTable.status, "Pending Confirmation"),
        ),
      );

    const [completedCount] = await db
      .select({ value: count() })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.studentId, studentId),
          eq(sessionsTable.status, "Completed"),
        ),
      );

    const pendingBidsQuery = await db
      .select({ value: count() })
      .from(bidsTable)
      .innerJoin(
        questionsTable,
        eq(bidsTable.questionId, questionsTable.questionId),
      )
      .where(
        and(
          eq(questionsTable.studentId, studentId),
          eq(bidsTable.status, "Pending"),
        ),
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

    const upcomingSessions = await db
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
      upcomingSessions.map(async (s) => {
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
      openQuestions: Number(openCount.value),
      pendingBids: Number(bidReceivedCount.value),  // Bids Received
      scheduledSessions: Number(upcomingCount.value),  // Upcoming Sessions (Matched + Scheduled)
      pendingConfirmation: Number(pendingConfirmation.value),  // Pending Tutors
      completedSessions: Number(completedCount.value),
      totalSpent: 0,
      recentQuestions: recentWithStudents,
      upcomingSessions: upcomingEnriched,
    });
  },
);

router.get(
  "/dashboard/tutor/:tutorId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const tutorId = parseId(req.params["tutorId"]);
    if (isNaN(tutorId)) {
      res.status(400).json({ error: "Invalid tutor ID" });
      return;
    }

    // Open Bids = my Pending bids on Open questions
    const [openBidsCount] = await db
      .select({ value: count() })
      .from(bidsTable)
      .innerJoin(
        questionsTable,
        eq(bidsTable.questionId, questionsTable.questionId),
      )
      .where(
        and(
          eq(bidsTable.tutorId, tutorId),
          eq(bidsTable.status, "Pending"),
          eq(questionsTable.status, "Open"),
        ),
      );

    // Accepted Bids = my Accepted bids on questions that haven't been completed/cancelled
    // This includes Matched (student hasn't proposed time) AND PendingConfirmation/Scheduled (student proposed, session in progress)
    const [acceptedBidsCount] = await db
      .select({ value: count() })
      .from(bidsTable)
      .innerJoin(
        questionsTable,
        eq(bidsTable.questionId, questionsTable.questionId),
      )
      .where(
        and(
          eq(bidsTable.tutorId, tutorId),
          eq(bidsTable.status, "Accepted"),
          or(
            eq(questionsTable.status, "Matched"),
          ),
        ),
      );

    // Upcoming Sessions = sessions with "Pending Confirmation" or "Scheduled"
    const [upcomingCount] = await db
      .select({ value: count() })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.tutorId, tutorId),
          or(
            eq(sessionsTable.status, "Pending Confirmation"),
            eq(sessionsTable.status, "Scheduled"),
          ),
        ),
      );

    // Completed Sessions
    const [completedCount] = await db
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

    // Recent bids
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

    // Upcoming sessions (Pending Confirmation or Scheduled)
    const upcomingSessionsData = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.tutorId, tutorId),
          or(
            eq(sessionsTable.status, "Pending Confirmation"),
            eq(sessionsTable.status, "Scheduled"),
          ),
        ),
      )
      .limit(5);

    const upcomingEnriched = await Promise.all(
      upcomingSessionsData.map(async (s) => {
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
      openBids: Number(openBidsCount.value),
      acceptedBids: Number(acceptedBidsCount.value),
      scheduledSessions: Number(upcomingCount.value),
      completedSessions: Number(completedCount.value),
      totalEarned,
      averageRating: avgRating ? parseFloat(parseFloat(avgRating).toFixed(2)) : 0,
      recentBids: recentBidsEnriched,
      upcomingSessions: upcomingEnriched,
    });
  },
);

export default router;