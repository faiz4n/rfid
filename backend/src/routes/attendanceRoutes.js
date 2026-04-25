import { Router } from "express";
import {
  getLatestEnrollmentCapture,
  getRecentAttendance,
  getTodayStats,
  registerScan,
  startEnrollmentCapture,
  stopEnrollmentCapture,
} from "../controllers/attendanceController.js";

const router = Router();

router.post("/scan", registerScan);
router.post("/capture/start", startEnrollmentCapture);
router.post("/capture/stop", stopEnrollmentCapture);
router.get("/capture/latest", getLatestEnrollmentCapture);
router.get("/recent", getRecentAttendance);
router.get("/stats/today", getTodayStats);

export default router;
