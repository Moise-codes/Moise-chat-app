import axios from "axios";

export const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL || "http://localhost:5001/api", // ✅ added env variable
    withCredentials: true
});