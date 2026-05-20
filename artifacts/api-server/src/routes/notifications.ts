import { db, notificationsTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

router.get("/notifications", authMiddleware, async (req, res): Promise<void> => {
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.user!.userId))
    .orderBy(notificationsTable.createdDate);

  res.json(notifications.reverse());
});

router.put("/notifications/:notificationId/read", authMiddleware, async (req, res): Promise<void> => {
  const notificationId = parseId(req.params["notificationId"]);
  if (isNaN(notificationId)) {
    res.status(400).json({ error: "Invalid notification ID" });
    return;
  }

  const [notification] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(
      and(
        eq(notificationsTable.notificationId, notificationId),
        eq(notificationsTable.userId, req.user!.userId)
      )
    )
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(notification);
});

router.put("/notifications/read-all", authMiddleware, async (req, res): Promise<void> => {
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, req.user!.userId));

  res.json({ success: true });
});

router.post("/notifications/push-token", authMiddleware, async (req, res): Promise<void> => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token is required" });
    return;
  }

  await db
    .update(usersTable)
    .set({ pushToken: token })
    .where(eq(usersTable.userId, req.user!.userId));

  res.json({ success: true });
});

export default router;
