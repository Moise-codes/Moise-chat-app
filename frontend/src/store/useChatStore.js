import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null, // ✅ no localStorage — prevents cross-user data leaking
  isUsersLoading: false,
  isMessagesLoading: false,

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

    // ✅ show message instantly on sender's screen
    const tempMessage = {
      _id: `temp_${Date.now()}`,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image || null,
      createdAt: new Date().toISOString(),
      isTemp: true,
    };

    set({ messages: [...messages, tempMessage] });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );

      // ✅ replace temp message with real server message
      set({
        messages: get().messages.map((m) =>
          m._id === tempMessage._id ? res.data : m
        ),
      });
    } catch (error) {
      // ✅ remove temp message if failed
      set({
        messages: get().messages.filter((m) => m._id !== tempMessage._id),
      });
      toast.error("Failed to send message");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");

    socket.on("newMessage", (newMessage) => {
      const isFromSelectedUser = newMessage.senderId === selectedUser._id;
      const isFromMe = newMessage.senderId === useAuthStore.getState().authUser._id;
      if (!isFromSelectedUser && !isFromMe) return;

      const messages = get().messages;

      // ✅ replace temp message with real one from socket
      const tempExists = messages.find(
        (m) => m.isTemp && 
        m.text === newMessage.text && 
        m.senderId === newMessage.senderId
      );

      if (tempExists) {
        set({
          messages: messages.map((m) =>
            m._id === tempExists._id ? newMessage : m
          ),
        });
      } else {
        // ✅ prevent duplicates
        const exists = messages.find((m) => m._id === newMessage._id);
        if (exists) return;
        set({ messages: [...messages, newMessage] });
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
  },

  setSelectedUser: (selectedUser) => {
    // ✅ removed localStorage — no more cross-user data leaking
    set({ selectedUser });
  },
}));