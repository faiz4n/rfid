import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./config/db.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const corsOptions = {
  origin: true, // Allow all origins
};

app.use(cors(corsOptions));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "rfid-attendance-api" });
});

app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);

import { createServer } from "http";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI is missing in environment variables.");
  process.exit(1);
}

const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: corsOptions,
});

io.on("connection", (socket) => {
  console.log("Client connected via WebSocket:", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

connectDB(MONGO_URI).then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server & WebSocket socket.io running on port ${PORT}`);
  });
});
