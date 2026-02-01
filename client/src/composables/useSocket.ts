import { io, Socket } from "socket.io-client";

function getSessionId() {
 let sid = sessionStorage.getItem("sid"); // 👈 zamiast localStorage
 if (!sid) {
  sid = crypto.randomUUID();
  sessionStorage.setItem("sid", sid);
 }
 return sid;
}

// @ts-ignore
const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;

export function createSocket(): Socket {
 const sid = getSessionId();
 return io(baseUrl, {
  transports: ["websocket"],
  auth: { sessionId: sid },
 });
}
