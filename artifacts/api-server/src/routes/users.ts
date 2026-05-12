import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

function stripPassword(user: typeof usersTable.$inferSelect) {
  const { password: _, ...rest } = user;
  return rest;
}

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

router.get("/users/:userId", authMiddleware, async (req, res): Promise<void> => {
  const userId = parseId(req.params["userId"]);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(stripPassword(user));
});

router.put("/users/:userId", authMiddleware, async (req, res): Promise<void> => {
  const userId = parseId(req.params["userId"]);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  if (req.user!.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ name })
    .where(eq(usersTable.userId, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(stripPassword(user));
});

export default router;
