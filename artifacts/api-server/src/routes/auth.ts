import { db, tutorProfilesTable, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

function stripPassword(user: typeof usersTable.$inferSelect) {
  const { password: _, ...rest } = user;
  return rest;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const message = firstIssue ? firstIssue.message : "Invalid request";
    res.status(400).json({ error: message });
    return;
  }
  const { name, email, password, role } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ name, email, password: hashedPassword, role })
    .returning();

  if (role === "tutor") {
    await db.insert(tutorProfilesTable).values({ tutorId: user.userId, subjects: [] });
  }

  const secret = process.env["JWT_SECRET"]!;
  const token = jwt.sign({ userId: user.userId, email: user.email, role: user.role }, secret, {
    expiresIn: "30d",
  });

  res.status(201).json({ token, user: stripPassword(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const message = firstIssue ? firstIssue.message : "Invalid request";
    res.status(400).json({ error: message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.suspended) {
    res.status(401).json({ error: "Account suspended" });
    return;
  }

  const secret = process.env["JWT_SECRET"]!;
  const token = jwt.sign({ userId: user.userId, email: user.email, role: user.role }, secret, {
    expiresIn: "30d",
  });

  res.json({ token, user: stripPassword(user) });
});

router.get("/auth/me", authMiddleware, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(stripPassword(user));
});

export default router;
