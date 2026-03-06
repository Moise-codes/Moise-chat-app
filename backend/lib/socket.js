import {Server} from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["https://moise-chat-frontend2.onrender.com", "http://localhost:5173"], // ✅ hardcoded to fix CORS
    },
});

// store online users { userId: [socketId1, socketId2, ...] }
const userSocketMap = {};

io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    console.log("A user connected", socket.id, "userId:", userId);

    if (userId) {
        // store multiple socket IDs per user
        if (!userSocketMap[userId]) {
            userSocketMap[userId] = [];
        }
        userSocketMap[userId].push(socket.id);
    }

    // emit online users to all connected clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("disconnect", () => {
        console.log("A user disconnected", socket.id);

        if (userId) {
            // remove only this specific socket ID
            userSocketMap[userId] = userSocketMap[userId].filter(
                (id) => id !== socket.id
            );
            // if user has no more active sockets, remove them entirely
            if (userSocketMap[userId].length === 0) {
                delete userSocketMap[userId];
            }
        }

        // update online users for all clients
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

export { io, app, server, userSocketMap };