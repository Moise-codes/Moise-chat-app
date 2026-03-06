import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cors from "cors";
import connectDB from "./lib/db.js";
import authRoutes from './src/routes/auth.route.js';
import messageRoutes from "./src/routes/message.route.js"
import { app,server } from './lib/socket.js';
dotenv.config();

app.use(express.json({limit:"10mb"}));
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // ✅ fixed
    credentials: true
}
));
const PORT = process.env.PORT || 3000;
app.use('/api/auth',authRoutes);
app.use('/api/messages',messageRoutes);
server.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
    connectDB();
})