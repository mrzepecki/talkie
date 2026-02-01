import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import crypto from "crypto";

const PORT = process.env.PORT || 3001;

// === KISS config ===
const ALLOWED_ORIGINS = [
	"http://localhost:5173", // Vite dev
	// dodasz potem domenę hostingu frontu, np. "https://twoj-front.netlify.app"
];

const app = express();
app.use(express.json());

// API CORS (na teraz liberalnie w dev; na produkcji zawęź)
app.use(
	cors({
		origin: (origin, cb) => {
			if (!origin) return cb(null, true);
			if (ALLOWED_ORIGINS.length === 0) return cb(null, true);
			if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
			return cb(new Error("CORS blocked"), false);
		},
		credentials: true,
	})
);

app.get("/health", (req, res) => res.json({ ok: true }));

const server = http.createServer(app);

const io = new Server(server, {
	transports: ["websocket"],
	cors: {
		origin: (origin, cb) => {
			if (!origin) return cb(null, true);
			if (ALLOWED_ORIGINS.length === 0) return cb(null, true);
			if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
			return cb(new Error("Origin blocked"), false);
		},
		credentials: true,
	},
});

// ===== In-memory state (MVP) =====
const queue = []; // userIds waiting
const userSocket = new Map(); // userId -> socket.id
const userRoom = new Map(); // userId -> roomId
const roomUsers = new Map(); // roomId -> [a,b]

// super proste limity (na start)
const lastNextAt = new Map();
const lastMsgAt = new Map();

function now() {
	return Date.now();
}
function makeRoomId() {
	return `room_${crypto.randomBytes(6).toString("hex")}`;
}
function removeFromQueue(userId) {
	const i = queue.indexOf(userId);
	if (i !== -1) queue.splice(i, 1);
}
function otherUser(roomId, me) {
	const users = roomUsers.get(roomId) || [];
	return users.find((u) => u !== me);
}
function cleanupRoom(roomId) {
	const users = roomUsers.get(roomId) || [];
	roomUsers.delete(roomId);
	users.forEach((u) => userRoom.delete(u));
}

function tryMatch() {
	while (queue.length >= 2) {
		const a = queue.shift();
		const b = queue.shift();
		if (!a || !b) return;
		
		// jeśli ktoś się rozłączył
		if (!userSocket.has(a) || !userSocket.has(b)) continue;
		
		const roomId = makeRoomId();
		roomUsers.set(roomId, [a, b]);
		userRoom.set(a, roomId);
		userRoom.set(b, roomId);
		
		io.to(userSocket.get(a)).emit("chat:matched", { roomId });
		io.to(userSocket.get(b)).emit("chat:matched", { roomId });
	}
}

io.on("connection", (socket) => {
	// === NO AUTH: sessionId z klienta ===
	const sessionId = String(socket.handshake.auth?.sessionId || "").trim();
	if (!sessionId || sessionId.length > 128) {
		socket.disconnect();
		return;
	}
	
	const userId = sessionId;
	userSocket.set(userId, socket.id);
	
	socket.emit("queue:status", { status: "idle" });
	
	socket.on("queue:join", () => {
		if (userRoom.has(userId)) return;
		removeFromQueue(userId);
		queue.push(userId);
		socket.emit("queue:status", { status: "queued" });
		tryMatch();
	});
	
	socket.on("queue:leave", () => {
		removeFromQueue(userId);
		socket.emit("queue:status", { status: "idle" });
	});
	
	socket.on("chat:message", ({ text }) => {
		const t = String(text ?? "").trim();
		if (!t) return;
		
		// rate limit ~3 msg/s
		const last = lastMsgAt.get(userId) || 0;
		if (now() - last < 300) return;
		lastMsgAt.set(userId, now());
		
		const roomId = userRoom.get(userId);
		if (!roomId) return;
		
		const other = otherUser(roomId, userId);
		if (!other) return;
		
		const otherSid = userSocket.get(other);
		if (!otherSid) return;
		
		io.to(otherSid).emit("chat:message", {
			from: "stranger",
			text: t,
			ts: now(),
		});
	});
	
	socket.on("chat:next", () => {
		// limit next 1/2s
		const last = lastNextAt.get(userId) || 0;
		if (now() - last < 2000) return;
		lastNextAt.set(userId, now());
		
		// zakończ obecny room
		const roomId = userRoom.get(userId);
		if (roomId) {
			const other = otherUser(roomId, userId);
			cleanupRoom(roomId);
			if (other) {
				const otherSid = userSocket.get(other);
				if (otherSid) io.to(otherSid).emit("chat:partner_left");
				// wrzuć drugiego też do kolejki (omegle-like)
				removeFromQueue(other);
				if (userSocket.has(other)) queue.push(other);
				io.to(otherSid).emit("queue:status", { status: "queued" });
			}
		}
		
		// wrzuć siebie do kolejki
		removeFromQueue(userId);
		queue.push(userId);
		socket.emit("queue:status", { status: "queued" });
		tryMatch();
	});
	
	socket.on("disconnect", () => {
		removeFromQueue(userId);
		const roomId = userRoom.get(userId);
		if (roomId) {
			const other = otherUser(roomId, userId);
			cleanupRoom(roomId);
			if (other) {
				const otherSid = userSocket.get(other);
				if (otherSid) io.to(otherSid).emit("chat:partner_left");
			}
		}
		userSocket.delete(userId);
	});
});

server.listen(PORT, () => console.log(`✅ server on http://localhost:${PORT}`));
