import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bidsTable } from "./bids";
import { usersTable } from "./users";

export const paymentsTable = pgTable("payments", {
  paymentId: serial("payment_id").primaryKey(),
  bidId: integer("bid_id")
    .notNull()
    .references(() => bidsTable.bidId),
  studentId: integer("student_id")
    .notNull()
    .references(() => usersTable.userId),
  tutorId: integer("tutor_id")
    .notNull()
    .references(() => usersTable.userId),
  amount: real("amount").notNull(),
  platformFee: real("platform_fee").notNull(),
  tutorAmount: real("tutor_amount").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status", {
    enum: ["Pending", "Processing", "Succeeded", "Failed", "Refunded"],
  })
    .notNull()
    .default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  paymentId: true,
  createdAt: true,
  status: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
