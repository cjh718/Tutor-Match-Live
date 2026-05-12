import { db, reviewsTable, usersTable, sessionsTable } from "@workspace/db";
import { avg, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/reviews", authMiddleware, async (req, res): Promise<void> => {
  const { tutorId } = req.query as { tutorId?: string };
  if (!tutorId) {
    res.status(400).json({ error: "tutorId is required" });
    return;
  }

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.tutorId, parseInt(tutorId, 10)))
    .orderBy(reviewsTable.createdDate);

  const enriched = await Promise.all(
    reviews.map(async (r) => {
      const [student] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.userId, r.studentId));
      const { password: _, ...studentWithoutPassword } = student;
      return { ...r, student: studentWithoutPassword };
    })
  );

  res.json(enriched);
});

router.post("/reviews", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "student") {
    res.status(403).json({ error: "Only students can submit reviews" });
    return;
  }

  const { sessionId, tutorId, rating, reviewText } = req.body as {
    sessionId?: number;
    tutorId?: number;
    rating?: number;
    reviewText?: string;
  };

  if (!sessionId || !tutorId || !rating) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be between 1 and 5" });
    return;
  }

  const [review] = await db
    .insert(reviewsTable)
    .values({
      sessionId,
      studentId: req.user!.userId,
      tutorId,
      rating,
      reviewText: reviewText ?? null,
    })
    .returning();

  const [{ value: avgRating }] = await db
    .select({ value: avg(reviewsTable.rating) })
    .from(reviewsTable)
    .where(eq(reviewsTable.tutorId, tutorId));

  if (avgRating) {
    await db
      .update(usersTable)
      .set({ rating: parseFloat(avgRating) })
      .where(eq(usersTable.userId, tutorId));
  }

  const [student] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, req.user!.userId));
  const { password: _, ...studentWithoutPassword } = student;

  res.status(201).json({ ...review, student: studentWithoutPassword });
});

export default router;
