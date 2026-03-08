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
        });
        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessages controller", error.message);
        res.status(500).json({ error: "Internal Server error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { text, image } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        let imageUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
        });

        await newMessage.save();

        const receiverSocketIds = userSocketMap[receiverId];
        if (receiverSocketIds && receiverSocketIds.length > 0) {
            receiverSocketIds.forEach((socketId) => {
                io.to(socketId).emit("newMessage", newMessage);
            });
        }

        const senderSocketIds = userSocketMap[senderId];
        if (senderSocketIds && senderSocketIds.length > 0) {
            senderSocketIds.forEach((socketId) => {
                io.to(socketId).emit("newMessage", newMessage);
            });
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
                                    ${text ? `
                                    <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 10px 0;">
                                        <p style="margin: 0;">${text}</p>
                                    </div>` : ""}
                                    ${imageUrl ? `<p>📷 <em>An image was also sent.</em></p>` : ""}
                                    <br/>
                                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" 
                                       style="background: #4F46E5; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">
                                       Open Chatty
                                    </a>
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

// --- NEW ---
export const deleteMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "You can only delete your own messages" });
        }

        if (message.image) {
            try {
                const publicId = message.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.log("Cloudinary image delete failed (non-critical):", err.message);
            }
        }

        await Message.findByIdAndDelete(messageId);

        const participantIds = [message.senderId.toString(), message.receiverId.toString()];
        participantIds.forEach((participantId) => {
            const socketIds = userSocketMap[participantId];
            if (socketIds && socketIds.length > 0) {
                socketIds.forEach((socketId) => {
                    io.to(socketId).emit("messageDeleted", { messageId });
                });
            }
        });

        res.status(200).json({ message: "Message deleted successfully" });

    } catch (error) {
        console.log("Error in deleteMessage controller", error.message);
        res.status(500).json({ error: "Internal Server error" });
    }
};