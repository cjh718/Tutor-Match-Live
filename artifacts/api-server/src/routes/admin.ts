import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

router.get(
  "/admin/users",
  authMiddleware,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const users = await db.select().from(usersTable);
    const sanitized = users.map(({ password: _, ...u }) => u);
    res.json(sanitized);
  }
);

router.put(
  "/admin/users/:userId/suspend",
  authMiddleware,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const userId = parseId(req.params["userId"]);
    if (isNaN(userId)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const { suspended } = req.body as { suspended?: boolean };
    if (typeof suspended !== "boolean") {
      res.status(400).json({ error: "suspended must be a boolean" });
      return;
    }

    const [user] = await db
      .update(usersTable)
      .set({ suspended })
      .where(eq(usersTable.userId, userId))
      .returning();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  }
);

export default router;
