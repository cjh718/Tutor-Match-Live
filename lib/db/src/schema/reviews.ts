import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";
import { usersTable } from "./users";

export const reviewsTable = pgTable("reviews", {
  reviewId: serial("review_id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessionsTable.sessionId),
  studentId: integer("student_id")
    .notNull()
    .references(() => usersTable.userId),
  tutorId: integer("tutor_id")
    .notNull()
    .references(() => usersTable.userId),
  rating: integer("rating").notNull(),
  reviewText: text("review_text"),
  createdDate: timestamp("created_date", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  reviewId: true,
  createdDate: true,
});
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
