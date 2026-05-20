import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { questionsTable } from "./questions";
import { usersTable } from "./users";

export const sessionsTable = pgTable("sessions", {
  sessionId: serial("session_id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => questionsTable.questionId),
  studentId: integer("student_id")
    .notNull()
    .references(() => usersTable.userId),
  tutorId: integer("tutor_id")
    .notNull()
    .references(() => usersTable.userId),
  finalTime: timestamp("final_time", { withTimezone: true }),
  meetingLink: text("meeting_link"),
  status: text("status", {
    enum: ["Confirmed", "Completed", "Cancelled"],
  })
    .notNull()
    .default("Confirmed"),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  sessionId: true,
  status: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
