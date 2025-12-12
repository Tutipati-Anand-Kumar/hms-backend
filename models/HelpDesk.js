// models/HelpDesk.js
import mongoose from "mongoose";

const helpDeskSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" }, 
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
  },

  { timestamps: true }
);

const HelpDesk = mongoose.model("HelpDesk", helpDeskSchema);
export default HelpDesk;