import { boolean, integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { questionsTable } from "./questions";
import { usersTable } from "./users";

export const bidsTable = pgTable("bids", {
  bidId: serial("bid_id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => questionsTable.questionId),
  tutorId: integer("tutor_id")
    .notNull()
    .references(() => usersTable.userId),
  price: real("price").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["Pending", "Accepted", "Rejected", "Withdrawn"] })
    .notNull()
    .default("Pending"),
  offerNow: boolean("offer_now").notNull().default(false),
  windowExpiresAt: timestamp("window_expires_at", { withTimezone: true }),
  specificTime: timestamp("specific_time", { withTimezone: true }),
  createdDate: timestamp("created_date", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBidSchema = createInsertSchema(bidsTable).omit({
  bidId: true,
  createdDate: true,
  status: true,
  windowExpiresAt: true,
});
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bidsTable.$inferSelect;
