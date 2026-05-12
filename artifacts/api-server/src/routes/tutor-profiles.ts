import { db, tutorProfilesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

router.get("/tutor-profiles/:tutorId", authMiddleware, async (req, res): Promise<void> => {
  const tutorId = parseId(req.params["tutorId"]);
  if (isNaN(tutorId)) {
    res.status(400).json({ error: "Invalid tutor ID" });
    return;
  }

  const [profile] = await db
    .select()
    .from(tutorProfilesTable)
    .where(eq(tutorProfilesTable.tutorId, tutorId));

  if (!profile) {
    res.status(404).json({ error: "Tutor profile not found" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, tutorId));
  const { password: _, ...userWithoutPassword } = user;

  res.json({ ...profile, user: userWithoutPassword });
});

router.put("/tutor-profiles/:tutorId", authMiddleware, async (req, res): Promise<void> => {
  const tutorId = parseId(req.params["tutorId"]);
  if (isNaN(tutorId)) {
    res.status(400).json({ error: "Invalid tutor ID" });
    return;
  }
  if (req.user!.userId !== tutorId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { subjects, education, experience, hourlyRate, bio } = req.body as {
    subjects?: string[];
    education?: string;
    experience?: string;
    hourlyRate?: number;
    bio?: string;
  };

  const updates: Partial<typeof tutorProfilesTable.$inferInsert> = {};
  if (subjects !== undefined) updates.subjects = subjects;
  if (education !== undefined) updates.education = education;
  if (experience !== undefined) updates.experience = experience;
  if (hourlyRate !== undefined) updates.hourlyRate = hourlyRate;
  if (bio !== undefined) updates.bio = bio;

  const [profile] = await db
    .update(tutorProfilesTable)
    .set(updates)
    .where(eq(tutorProfilesTable.tutorId, tutorId))
    .returning();

  if (!profile) {
    res.status(404).json({ error: "Tutor profile not found" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, tutorId));
  const { password: _, ...userWithoutPassword } = user;

  res.json({ ...profile, user: userWithoutPassword });
});

export default router;
