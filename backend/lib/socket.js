import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [process.env.FRONTEND_URL || "http://localhost:5173"],
        credentials: true, // ✅ allow cookies/auth headers
    },
    pingTimeout: 60000,   // ✅ wait 60s before closing idle connection
    pingInterval: 25000,  // ✅ ping every 25s to keep connection alive
    transports: ["websocket", "polling"], // ✅ websocket first, fallback to polling
});

// store online users { userId: [socketId1, socketId2, ...] }
const userSocketMap = {};

io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    console.log("A user connected", socket.id, "userId:", userId);

    if (userId) {
        if (!userSocketMap[userId]) {
            userSocketMap[userId] = [];
        }
        userSocketMap[userId].push(socket.id);
    }

    // ✅ emit to ALL clients including the one who just joined
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // ✅ confirm to the joining user they are connected
    socket.emit("connected", { socketId: socket.id, userId });

    socket.on("disconnect", (reason) => {
        console.log("A user disconnected", socket.id, "reason:", reason);

        if (userId && userSocketMap[userId]) {
            userSocketMap[userId] = userSocketMap[userId].filter(
                (id) => id !== socket.id
            );
            if (userSocketMap[userId].length === 0) {
                delete userSocketMap[userId];
            }
        }

        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

export { io, app, server, userSocketMap };