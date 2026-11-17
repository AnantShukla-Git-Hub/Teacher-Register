import { io } from "socket.io-client";

// Connect to the backend Socket.IO server via proxy or direct URL
export const socket = io(window.location.origin, {
  path: "/socket.io",
  autoConnect: true,
  transports: ["websocket", "polling"],
});
