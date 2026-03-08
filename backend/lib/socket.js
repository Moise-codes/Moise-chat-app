import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [process.env.FRONTEND_URL || "http://localhost:5173"],
        credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
});

const userSocketMap = {};

io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    console.log("A user connected", socket.id, "userId:", userId);

    if (userId) {
        if (!userSocketMap[userId]) userSocketMap[userId] = [];
        userSocketMap[userId].push(socket.id);
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    socket.emit("connected", { socketId: socket.id, userId });

    // Typing indicator
    socket.on("typing", ({ senderId, receiverId, isTyping }) => {
        const receiverSocketIds = userSocketMap[receiverId];
        if (receiverSocketIds && receiverSocketIds.length > 0) {
            receiverSocketIds.forEach((socketId) => {
                io.to(socketId).emit("typing", { senderId, isTyping });
            });
        }
    });

    socket.on("disconnect", (reason) => {
        console.log("A user disconnected", socket.id, "reason:", reason);
        if (userId && userSocketMap[userId]) {
            userSocketMap[userId] = userSocketMap[userId].filter((id) => id !== socket.id);
            if (userSocketMap[userId].length === 0) delete userSocketMap[userId];
        }
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

export { io, app, server, userSocketMap };