import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  typingUsers: [],

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const authUser = useAuthStore.getState().authUser;

    const tempMessage = {
      _id: `temp_${Date.now()}`,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image || null,
      video: messageData.video || null,
      fileUrl: messageData.file || null,
      fileName: messageData.fileName || null,
      audio: messageData.audio || null,
      replyTo: messageData.replyTo || null,
      createdAt: new Date().toISOString(),
      isTemp: true,
    };

    set({ messages: [...messages, tempMessage] });

    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: get().messages.map((m) => m._id === tempMessage._id ? res.data : m) });
    } catch (error) {
      set({ messages: get().messages.filter((m) => m._id !== tempMessage._id) });
      toast.error("Failed to send message");
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/messages/${messageId}`);
      set({ messages: get().messages.filter((m) => m._id !== messageId) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
  },

  addReaction: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/react`, { emoji });
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? { ...m, reactions: res.data.reactions } : m
        ),
      });
    } catch (error) {
      toast.error("Failed to add reaction");
    }
  },

  setTyping: (isTyping) => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    if (!socket || !selectedUser) return;
    socket.emit("typing", { senderId: authUser._id, receiverId: selectedUser._id, isTyping });
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    socket.off("messageDeleted");
    socket.off("messageReaction");
    socket.off("typing");

    socket.on("newMessage", (newMessage) => {
      const isFromSelectedUser = newMessage.senderId === selectedUser._id;
      const isFromMe = newMessage.senderId === useAuthStore.getState().authUser._id;
      if (!isFromSelectedUser && !isFromMe) return;

      const messages = get().messages;
      const tempExists = messages.find(
        (m) => m.isTemp && m.text === newMessage.text && m.senderId === newMessage.senderId
      );

      if (tempExists) {
        set({ messages: messages.map((m) => m._id === tempExists._id ? newMessage : m) });
      } else {
        const exists = messages.find((m) => m._id === newMessage._id);
        if (exists) return;
        set({ messages: [...messages, newMessage] });
      }
    });

    socket.on("messageDeleted", ({ messageId }) => {
      set({ messages: get().messages.filter((m) => m._id !== messageId) });
    });

    socket.on("messageReaction", ({ messageId, reactions }) => {
      set({ messages: get().messages.map((m) => m._id === messageId ? { ...m, reactions } : m) });
    });

    socket.on("typing", ({ senderId, isTyping }) => {
      if (senderId !== selectedUser._id) return;
      set((state) => ({
        typingUsers: isTyping
          ? [...new Set([...state.typingUsers, senderId])]
          : state.typingUsers.filter((id) => id !== senderId),
      }));
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
    socket.off("messageDeleted");
    socket.off("messageReaction");
    socket.off("typing");
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser });
  },
}));