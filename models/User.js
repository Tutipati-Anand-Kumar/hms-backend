// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true, sparse: true }, // NEW: primary login
    email: { type: String, lowercase: true, sparse: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["patient", "doctor", "admin", "super-admin"],
      required: true,
    },
    doctorId: { type: String, unique: true, sparse: true },
    refreshTokens: [
      {
        tokenHash: String,
        createdAt: { type: Date, default: Date.now },
        expiresAt: Date,
      },
    ],
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    avatar: { type: String }, // Profile picture URL
    consentGiven: { type: Boolean, default: false },
    consentTimestamp: { type: Date }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
