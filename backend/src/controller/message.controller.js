import cloudinary from "../../lib/cloudinary.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { io, userSocketMap } from "../../lib/socket.js";
import { transporter } from "../../lib/nodemailer.js";

export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");
        res.status(200).json(filteredUsers);
    } catch (error) {
        console.error("Error in getUsersForSidebar", error.message);
        res.status(500).json({ error: "Internal Server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const senderId = req.user._id;
        const messages = await Message.find({
            $or: [
                { senderId: senderId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: senderId }
            ]
        }).populate("replyTo", "text image video fileUrl fileName senderId");
        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessages controller", error.message);
        res.status(500).json({ error: "Internal Server error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { text, image, video, file, fileName, fileType, audio, replyTo } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        let imageUrl, videoUrl, fileUrl, audioUrl;

        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }
        if (video) {
            const uploadResponse = await cloudinary.uploader.upload(video, {
                resource_type: "video",
                chunk_size: 6000000,
            });
            videoUrl = uploadResponse.secure_url;
        }
        if (file) {
            const uploadResponse = await cloudinary.uploader.upload(file, {
                resource_type: "raw",
                public_id: `files/${Date.now()}_${fileName || "file"}`,
            });
            fileUrl = uploadResponse.secure_url;
        }
        if (audio) {
            const uploadResponse = await cloudinary.uploader.upload(audio, {
                resource_type: "raw",
                public_id: `audio/${Date.now()}_voice.webm`,
            });
            audioUrl = uploadResponse.secure_url;
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            video: videoUrl,
            fileUrl: fileUrl,
            fileName: fileName || null,
            audio: audioUrl,
            replyTo: replyTo || null,
        });

        await newMessage.save();
        await newMessage.populate("replyTo", "text image video fileUrl fileName senderId");

        const receiverSocketIds = userSocketMap[receiverId];
        if (receiverSocketIds && receiverSocketIds.length > 0) {
            receiverSocketIds.forEach((socketId) => io.to(socketId).emit("newMessage", newMessage));
        }

        const senderSocketIds = userSocketMap[senderId];
        if (senderSocketIds && senderSocketIds.length > 0) {
            senderSocketIds.forEach((socketId) => io.to(socketId).emit("newMessage", newMessage));
        }

        res.status(201).json(newMessage);

        const isReceiverOnline = receiverSocketIds && receiverSocketIds.length > 0;
        if (!isReceiverOnline) {
            Promise.resolve().then(async () => {
                try {
                    const receiver = await User.findById(receiverId);
                    const sender = await User.findById(senderId);
                    if (receiver && receiver.email) {
                        await transporter.sendMail({
                            from: `"Chatty App" <${process.env.EMAIL_USER}>`,
                            to: receiver.email,
                            subject: `New message from ${sender.fullName} 💬`,
                            html: `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                    <h2 style="color: #4F46E5;">New Message on Chatty 💬</h2>
                                    <p>Hi <strong>${receiver.fullName}</strong>,</p>
                                    <p><strong>${sender.fullName}</strong> sent you a message:</p>
                                    ${text ? `<div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 10px 0;"><p style="margin: 0;">${text}</p></div>` : ""}
                                    ${imageUrl ? `<p>📷 <em>An image was also sent.</em></p>` : ""}
                                    ${videoUrl ? `<p>🎥 <em>A video was also sent.</em></p>` : ""}
                                    ${fileUrl ? `<p>📎 <em>A file was also sent: ${fileName || ""}</em></p>` : ""}
                                    <br/>
                                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background: #4F46E5; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">Open Chatty</a>
                                    <br/><br/>
                                    <p style="color: #6B7280; font-size: 12px;">You received this because someone messaged you on Chatty.</p>
                                </div>
                            `,
                        });
                    }
                } catch (emailError) {
                    console.log("Email notification failed (non-critical):", emailError.message);
                }
            });
        }

    } catch (error) {
        console.log("Error in sendMessage controller", error.message);
        res.status(500).json({ error: "Internal Server error" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: "Message not found" });
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "You can only delete your own messages" });
        }

        for (const field of ["image", "video", "fileUrl", "audio"]) {
            if (message[field]) {
                try {
                    const publicId = message[field].split("/").pop().split(".")[0];
                    const resourceType = field === "image" ? "image" : field === "video" ? "video" : "raw";
                    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
                } catch (err) {
                    console.log(`Cloudinary delete failed for ${field} (non-critical):`, err.message);
                }
            }
        }

        await Message.findByIdAndDelete(messageId);

        const participantIds = [message.senderId.toString(), message.receiverId.toString()];
        participantIds.forEach((participantId) => {
            const socketIds = userSocketMap[participantId];
            if (socketIds && socketIds.length > 0) {
                socketIds.forEach((socketId) => io.to(socketId).emit("messageDeleted", { messageId }));
            }
        });

        res.status(200).json({ message: "Message deleted successfully" });
    } catch (error) {
        console.log("Error in deleteMessage controller", error.message);
        res.status(500).json({ error: "Internal Server error" });
    }
};

export const reactToMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: "Message not found" });

        const existingIndex = message.reactions.findIndex(
            (r) => r.userId.toString() === userId.toString() && r.emoji === emoji
        );

        if (existingIndex !== -1) {
            message.reactions.splice(existingIndex, 1);
        } else {
            message.reactions = message.reactions.filter(
                (r) => r.userId.toString() !== userId.toString()
            );
            message.reactions.push({ userId, emoji });
        }

        await message.save();

        const participantIds = [message.senderId.toString(), message.receiverId.toString()];
        participantIds.forEach((participantId) => {
            const socketIds = userSocketMap[participantId];
            if (socketIds && socketIds.length > 0) {
                socketIds.forEach((socketId) => io.to(socketId).emit("messageReaction", { messageId, reactions: message.reactions }));
            }
        });

        res.status(200).json({ reactions: message.reactions });
    } catch (error) {
        console.log("Error in reactToMessage controller", error.message);
        res.status(500).json({ error: "Internal Server error" });
    }
};