import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    uid: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["entered", "exited", "unknown", "blocked"],
      required: true,
    },
    deviceId: {
      type: String,
      default: "rfid-reader",
    },
    scannedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export const Attendance = mongoose.model("Attendance", attendanceSchema);
