# Smart RFID Attendance Management (MERN)

This project is a MERN-based dashboard for your ESP32 + MFRC522 RFID attendance system.

## Project Structure

- `backend`: Express + MongoDB API for users and attendance scans
- `frontend`: React + Vite dashboard for stats, recent scans, and user enrollment

## 1) Backend Setup

```bash
cd backend
npm install
copy .env.example .env
```

Update `.env` values:

- `MONGO_URI`: your MongoDB connection string
- `PORT`: backend port (default 5000)

Run backend:

```bash
npm run dev
```

## 2) Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Dashboard runs on `http://localhost:5173` by default.

## API Overview

- `GET /api/health`
- `POST /api/attendance/scan` -> create attendance from RFID UID
- `GET /api/attendance/recent?limit=20`
- `GET /api/attendance/stats/today`
- `POST /api/users`
- `GET /api/users`

## ESP32 Integration

When card is scanned, send UID to backend endpoint:

`POST http://<YOUR_SERVER_IP>:5000/api/attendance/scan`

Body:

```json
{
  "uid": "FE 7E E5 0",
  "deviceId": "gate-1"
}
```

If UID exists in users table, attendance status is `present`, otherwise `unknown`.

## 3) ESP32 Configuration

Use the ready sketch at:

- `esp32/rfid_attendance_esp32.ino`

Before uploading, update these constants in the sketch:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `API_BASE_URL` (example: `http://192.168.1.10:5000`)
- `DEVICE_ID` (example: `gate-1`)

Important:

- ESP32 and your backend server must be on the same WiFi network.
- Keep backend running on port `5000`.
- Enroll card UID from dashboard exactly as ESP32 prints it on Serial Monitor.

Expected behavior:

- Server returns `present` -> green LED + long beep
- Server returns `unknown` -> red LED + two short beeps
