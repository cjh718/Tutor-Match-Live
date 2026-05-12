import { integer, pgTable, real, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tutorProfilesTable = pgTable("tutor_profiles", {
  tutorId: integer("tutor_id").primaryKey().references(() => usersTable.userId),
  subjects: text("subjects").array().notNull().default([]),
  education: text("education"),
  experience: text("experience"),
  hourlyRate: real("hourly_rate"),
  bio: text("bio"),
});

export const insertTutorProfileSchema = createInsertSchema(tutorProfilesTable);
export type InsertTutorProfile = z.infer<typeof insertTutorProfileSchema>;
export type TutorProfile = typeof tutorProfilesTable.$inferSelect;
