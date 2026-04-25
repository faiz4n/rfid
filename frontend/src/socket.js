import { io } from "socket.io-client";

// Extract base URL without /api path
const apiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;
const baseUrl = apiUrl.replace(/\/api\/?$/, ""); // Remove /api suffix

export const socket = io(baseUrl, {
  autoConnect: true,
  reconnection: true,
});
