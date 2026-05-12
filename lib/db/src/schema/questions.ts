import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const questionsTable = pgTable("questions", {
  questionId: serial("question_id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => usersTable.userId),
  title: text("title").notNull(),
  description: text("description").notNull(),
  subject: text("subject").notNull(),
  attachmentUrl: text("attachment_url"),
  preferredDuration: integer("preferred_duration").notNull(),
  optionalBudget: real("optional_budget"),
  status: text("status", {
    enum: ["Open", "Matched", "Scheduled", "Completed", "Cancelled"],
  })
    .notNull()
    .default("Open"),
  createdDate: timestamp("created_date", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({
  questionId: true,
  createdDate: true,
  status: true,
});
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
