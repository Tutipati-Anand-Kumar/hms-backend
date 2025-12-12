// models/OTP.js
import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  mobile: { type: String, required: true },
  otpHash: { type: String, required: true }, // store hashed otp
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

// TTL index to auto-delete expired OTPS (optional)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OTP = mongoose.model("OTP", otpSchema);
export default OTP;
