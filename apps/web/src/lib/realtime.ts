import { io } from "socket.io-client";
import { API_URL } from "./api";

export const WS_URL = import.meta.env.VITE_WS_URL || API_URL;

export function createRealtimeSocket(token: string) {
  return io(`${WS_URL}/realtime`, {
    auth: { token },
    // Prefer websocket, but fall back to long-polling on mobile networks/proxies that block upgrades.
    transports: ["websocket", "polling"],
    tryAllTransports: true,
  });
}
