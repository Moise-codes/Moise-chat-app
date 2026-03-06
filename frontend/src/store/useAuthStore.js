import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL = (import.meta.env && import.meta.env.VITE_BASE_URL)
  ? import.meta.env.VITE_BASE_URL.replace("/api", "")
  : "http://localhost:5001";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data, isCheckingAuth: false });
      get().connectSocket(); // ✅ connect socket immediately after auth check
    } catch (error) {
      console.log("Error in checkAuth", error);
      set({ authUser: null, isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectSocket(); // ✅ connect socket immediately after login
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      get().disconnectSocket();
      set({ authUser: null, onlineUsers: [], socket: null }); // ✅ clear everything
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("Error in update profile", error);
      toast.error(error.response?.data?.message || "Profile update failed");
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser) return; // ✅ no user, no socket

    // ✅ if already connected, don't create a new one
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;

    // ✅ clean up old socket if it exists but disconnected
    if (existingSocket) {
      existingSocket.disconnect();
      set({ socket: null });
    }

    const socket = io(BASE_URL, {
      query: { userId: authUser._id },
      reconnection: true,               // ✅ auto reconnect
      reconnectionAttempts: 10,         // ✅ try 10 times
      reconnectionDelay: 500,           // ✅ start retrying after 0.5s
      reconnectionDelayMax: 3000,       // ✅ max 3s between retries
      timeout: 10000,                   // ✅ fail fast if no connection in 10s
      transports: ["websocket", "polling"], // ✅ websocket first
    });

    set({ socket }); // ✅ set socket in state immediately

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds }); // ✅ update online users instantly
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.log("❌ Socket error:", error.message);
    });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket?.connected) {
      socket.disconnect();
      set({ socket: null }); // ✅ clear socket from state
    }
  },
}));