import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const withdrawalsTable = pgTable("withdrawals", {
  withdrawalId: serial("withdrawal_id").primaryKey(),
  tutorId: integer("tutor_id")
    .notNull()
    .references(() => usersTable.userId),
  amount: real("amount").notNull(),
  method: text("method", { enum: ["Manual", "StripeConnect"] })
    .notNull()
    .default("Manual"),
  status: text("status", { enum: ["Pending", "Approved", "Rejected", "Processed"] })
    .notNull()
    .default("Pending"),
  bankDetails: text("bank_details"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  processedBy: integer("processed_by").references(() => usersTable.userId),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawalsTable).omit({
  withdrawalId: true,
  status: true,
  processedAt: true,
  processedBy: true,
  requestedAt: true,
});
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
