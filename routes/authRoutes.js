// routes/authRoutes.js
import express from "express";
import {
  register,
  login,
  sendOtp,
  verifyOtp,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  me,
  checkExistence
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { registerValidator, loginValidator, otpSendValidator, otpVerifyValidator, refreshValidator, resetPwdValidator } from "../utils/validators.js";

const router = express.Router();

router.post("/send-otp", otpSendValidator, sendOtp);
router.post("/verify-otp", otpVerifyValidator, verifyOtp);
router.post("/check-existence", checkExistence);
router.post("/register", registerValidator, register);
router.post("/login", loginValidator, login);
router.post("/refresh", refreshValidator, refresh);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.patch("/reset-password", resetPwdValidator, resetPassword);

router.get("/me", protect, me);

export default router;