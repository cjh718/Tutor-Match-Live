import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface NotifyParams {
  userId: number;
  type: string;
  title: string;
  message: string;
  relatedId?: number;
}

async function sendExpoPush(pushToken: string, title: string, body: string): Promise<void> {
  if (!pushToken.startsWith("ExponentPushToken[")) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: "default",
        priority: "high",
      }),
    });
  } catch (err) {
    // Non-fatal — in-app polling is the fallback
    console.error("Failed to send Expo push notification:", err);
  }
}

export async function notify(params: NotifyParams): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    relatedId: params.relatedId ?? null,
  });

  // Fire-and-forget push notification
  const [user] = await db
    .select({ pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(eq(usersTable.userId, params.userId));

  if (user?.pushToken) {
    void sendExpoPush(user.pushToken, params.title, params.message);
  }
}
