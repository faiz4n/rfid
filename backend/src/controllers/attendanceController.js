import { Attendance } from "../models/Attendance.js";
import { User } from "../models/User.js";
import { normalizeUID } from "../utils/uid.js";
import { io } from "../server.js";

const enrollmentCaptureState = {
  active: false,
  expiresAt: 0,
  latest: null,
};

function isEnrollmentCaptureActive() {
  if (!enrollmentCaptureState.active) return false;
  if (Date.now() > enrollmentCaptureState.expiresAt) {
    enrollmentCaptureState.active = false;
    enrollmentCaptureState.expiresAt = 0;
    return false;
  }
  return true;
}

export async function startEnrollmentCapture(req, res) {
  const timeoutMsRaw = Number(req.body?.timeoutMs);
  const timeoutMs = Number.isFinite(timeoutMsRaw)
    ? Math.min(Math.max(timeoutMsRaw, 5000), 120000)
    : 45000;

  enrollmentCaptureState.active = true;
  enrollmentCaptureState.expiresAt = Date.now() + timeoutMs;
  enrollmentCaptureState.latest = null;

  return res.json({
    active: true,
    expiresAt: new Date(enrollmentCaptureState.expiresAt).toISOString(),
    timeoutMs,
  });
}

export async function stopEnrollmentCapture(_req, res) {
  enrollmentCaptureState.active = false;
  enrollmentCaptureState.expiresAt = 0;

  return res.json({ active: false });
}

export async function getLatestEnrollmentCapture(_req, res) {
  return res.json({
    active: isEnrollmentCaptureActive(),
    expiresAt: enrollmentCaptureState.expiresAt
      ? new Date(enrollmentCaptureState.expiresAt).toISOString()
      : null,
    latest: enrollmentCaptureState.latest,
  });
}

export async function registerScan(req, res) {
  try {
    const { uid, deviceId, scannedAt } = req.body;

    if (!uid) {
      return res.status(400).json({ message: "uid is required" });
    }

    const normalizedUID = normalizeUID(uid);

    if (isEnrollmentCaptureActive()) {
      const capturedAt = scannedAt ? new Date(scannedAt) : new Date();

      enrollmentCaptureState.latest = {
        uid: normalizedUID,
        deviceId: deviceId || "rfid-reader",
        scannedAt: capturedAt.toISOString(),
      };

      enrollmentCaptureState.active = false;
      enrollmentCaptureState.expiresAt = 0;

      const payload = {
        message: "UID captured for enrollment",
        status: "capture",
        uid: normalizedUID,
        scannedAt: enrollmentCaptureState.latest.scannedAt,
      };

      io.emit("scan_captured", payload);

      return res.status(200).json(payload);
    }

    const user = await User.findOne({ uid: normalizedUID });
    const isBlocked = user?.cardStatus === "blocked";

    let currentStatus = isBlocked ? "blocked" : user ? "entered" : "unknown";
    const scanDate = scannedAt ? new Date(scannedAt) : new Date();

    if (user && !isBlocked) {
      const startOfDay = new Date(scanDate);
      startOfDay.setHours(0, 0, 0, 0);
      const lastScan = await Attendance.findOne({
        uid: normalizedUID,
        status: { $in: ["entered", "exited"] },
        scannedAt: { $gte: startOfDay }
      }).sort({ scannedAt: -1 });

      if (lastScan) {
        const secondsSinceLast = (scanDate.getTime() - new Date(lastScan.scannedAt).getTime()) / 1000;
        if (secondsSinceLast < 2) {
          return res.status(200).json({
            message: "Scan ignored (debounced)",
            status: lastScan.status,
            attendanceId: lastScan._id,
            user: {
              id: user._id,
              name: user.name,
              uid: user.uid,
              department: user.department,
              role: user.role,
              cardStatus: user.cardStatus,
            }
          });
        }

        if (lastScan.status === "entered") {
          currentStatus = "exited";
        }
      }
    }

    const attendance = await Attendance.create({
      user: user?._id ?? null,
      uid: normalizedUID,
      status: currentStatus,
      deviceId: deviceId || "rfid-reader",
      scannedAt: scanDate,
    });

    const payload = {
      message: isBlocked
        ? "Card Blocked"
        : user
          ? currentStatus === "entered" ? "Entered Successfully" : "Exited Successfully"
          : "Access Denied",
      status: attendance.status,
      attendanceId: attendance._id,
      user: user
        ? {
            id: user._id,
            name: user.name,
            uid: user.uid,
            department: user.department,
            role: user.role,
            cardStatus: user.cardStatus,
          }
        : null,
      uid: normalizedUID,
      scannedAt: scanDate.toISOString(),
      deviceId: deviceId || "rfid-reader",
      _id: attendance._id
    };

    io.emit("new_scan", payload);

    return res.status(201).json(payload);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to register scan", error: error.message });
  }
}

export async function getRecentAttendance(req, res) {
  try {
    const limitParams = Number(req.query.limit);
    const { date, status } = req.query;

    const filter = {};
    if (status) {
      if (status === "valid") {
        filter.status = { $in: ["entered", "exited"] };
      } else {
        filter.status = status;
      }
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.scannedAt = { $gte: start, $lte: end };
    }

    const finalLimit = date ? 1000 : Math.min(limitParams || 20, 100);

    const records = await Attendance.find(filter)
      .populate("user", "name uid department role")
      .sort({ scannedAt: -1 })
      .limit(finalLimit);

    return res.json(records);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch attendance", error: error.message });
  }
}

export async function getTodayStats(req, res) {
  try {
    const start = req.query.date ? new Date(req.query.date) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime());
    end.setHours(23, 59, 59, 999);

    const [totalScans, validScans, unknownScans, blockedScans, uniqueUIDs] =
      await Promise.all([
        Attendance.countDocuments({ scannedAt: { $gte: start, $lte: end } }),
        Attendance.countDocuments({
          status: { $in: ["entered", "exited"] },
          scannedAt: { $gte: start, $lte: end },
        }),
        Attendance.countDocuments({
          status: "unknown",
          scannedAt: { $gte: start, $lte: end },
        }),
        Attendance.countDocuments({
          status: "blocked",
          scannedAt: { $gte: start, $lte: end },
        }),
        Attendance.distinct("uid", { scannedAt: { $gte: start, $lte: end } }),
      ]);

    return res.json({
      totalScans,
      validScans,
      unknownScans,
      blockedScans,
      uniquePeopleToday: uniqueUIDs.length,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch stats", error: error.message });
  }
}
