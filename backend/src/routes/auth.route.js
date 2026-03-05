import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
const router = express.Router();
import  {checkAuth,signup,login,logout,updateProfile,} from  "../controller/auth.controller.js";
router.post('/signup',signup);
router.post('/login',login);
router.post('/logout',logout);
router.put('/update-profile',protectRoute,updateProfile);
router.get('/check',protectRoute,checkAuth)
export default router;