import { integer, pgTable, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tutorEarningsTable = pgTable("tutor_earnings", {
  tutorId: integer("tutor_id")
    .primaryKey()
    .references(() => usersTable.userId),
  totalEarned: real("total_earned").notNull().default(0),
  totalWithdrawn: real("total_withdrawn").notNull().default(0),
  balance: real("balance").notNull().default(0),
  lastWithdrawalAt: timestamp("last_withdrawal_at", { withTimezone: true }),
});

export const insertTutorEarningsSchema = createInsertSchema(tutorEarningsTable).omit({
  totalEarned: true,
  totalWithdrawn: true,
  balance: true,
  lastWithdrawalAt: true,
});
export type InsertTutorEarnings = z.infer<typeof insertTutorEarningsSchema>;
export type TutorEarnings = typeof tutorEarningsTable.$inferSelect;
