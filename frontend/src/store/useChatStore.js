import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: JSON.parse(localStorage.getItem("selectedUser")) || null,
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
    const { selectedUser } = get();
    try {
      // ✅ just send — don't add to state here
      // socket will deliver it back to sender via newMessage event
      await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // ✅ remove old listener first to avoid duplicates
    socket.off("newMessage");

    socket.on("newMessage", (newMessage) => {
      // ✅ accept messages from selected user OR from yourself
      const isFromSelectedUser = newMessage.senderId === selectedUser._id;
      const isFromMe = newMessage.senderId === useAuthStore.getState().authUser._id;
      if (!isFromSelectedUser && !isFromMe) return;

      // ✅ prevent duplicate messages
      const exists = get().messages.find((m) => m._id === newMessage._id);
      if (exists) return;

      set({ messages: [...get().messages, newMessage] });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
  },

  setSelectedUser: (selectedUser) => {
    if (selectedUser) {
      localStorage.setItem("selectedUser", JSON.stringify(selectedUser));
    } else {
      localStorage.removeItem("selectedUser");
    }
    set({ selectedUser });
  },
}));