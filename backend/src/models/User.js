import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    uid: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      default: null,
    },
    department: {
      type: String,
      default: "General",
    },
    role: {
      type: String,
      enum: ["student", "staff", "admin"],
      default: "student",
    },
    cardStatus: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },
    blockedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
