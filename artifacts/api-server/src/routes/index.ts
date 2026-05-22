import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import tutorProfilesRouter from "./tutor-profiles";
import questionsRouter from "./questions";
import bidsRouter from "./bids";
import sessionsRouter from "./sessions";
import reviewsRouter from "./reviews";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(tutorProfilesRouter);
router.use(questionsRouter);
router.use(bidsRouter);
router.use(sessionsRouter);
router.use(reviewsRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);
router.use(adminRouter);
router.use(uploadRouter);

export default router;