import { db, notificationsTable } from "@workspace/db";

interface NotifyParams {
  userId: number;
  type: string;
  title: string;
  message: string;
  relatedId?: number;
}

export async function notify(params: NotifyParams): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    relatedId: params.relatedId ?? null,
  });
}
