
// controllers/authController.js
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs";
import * as path from "path";
import { validationResult } from "express-validator";
import { fileURLToPath } from "url";

import User from "../models/User.js";
import PatientProfile from "../models/PatientProfile.js";
import DoctorProfile from "../models/DoctorProfile.js";
import OTP from "../models/OTP.js";
import HelpDesk from "../models/HelpDesk.js";
import sendEmail from "../utils/sendEmail.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: sign access token
const signAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // short-lived access token
  );
};

// Helper: create & store refresh token (simple hash storage)
const createRefreshToken = async (user) => {
  const token = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({ tokenHash, createdAt: new Date(), expiresAt });
  await user.save();
  return token;
};

export const register = async (req, res) => {
  const { name, mobile, email, password, otp, consentGiven } = req.body;

  // Validate fields
  if (!name || !mobile || !email || !password || !otp)
    return res.status(400).json({ message: "All fields required" });

  if (!consentGiven) {
    return res.status(400).json({ message: "Terms and Conditions consent is required" });
  }

  try {
    // Check existing user
    const existing = await User.findOne({ mobile });
    if (existing)
      return res.status(400).json({ message: "Mobile already registered" });

    const existingEmail = await User.findOne({ email });
    if (existingEmail)
      return res.status(400).json({ message: "Email already registered" });


    // Verify OTP
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const otpDoc = await OTP.findOne({
      mobile,
      otpHash,
      expiresAt: { $gt: Date.now() }
    });

    if (!otpDoc) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Delete used OTP
    await OTP.deleteOne({ _id: otpDoc._id });

    // Create user
    const hashedPwd = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      mobile,
      email,
      password: hashedPwd,
      role: "patient",
      consentGiven: true,
      consentTimestamp: new Date()
    });

    await PatientProfile.create({
      user: user._id,
    });

    // Generate tokens
    const accessToken = signAccessToken(user);
    const refreshToken = await createRefreshToken(user);

    res.status(201).json({
      message: "Registration successful",
      tokens: { accessToken, refreshToken },
      user: { id: user._id, name, mobile, email }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Generate & send OTP (email-based) — public endpoint that sends OTP to user's email
export const sendOtp = async (req, res) => {
  const { mobile, email } = req.body;

  if (!mobile || !email)
    return res.status(400).json({ message: "mobile and email required" });

  try {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email }, { mobile: mobile }]
    });

    if (existingUser) {
      if (existingUser.email === email) return res.status(400).json({ message: "Email already registered" });
      if (existingUser.mobile === mobile) return res.status(400).json({ message: "Mobile already registered" });
    }

    const otpPlain = (Math.floor(100000 + Math.random() * 900000)).toString();
    const otpHash = crypto.createHash("sha256").update(otpPlain).digest("hex");

    await OTP.create({
      mobile,
      otpHash,
      expiresAt: new Date(Date.now() + 10 * 60000) // 10 min
    });

    const filePath = path.join(__dirname, "../templates/otp.html");
    let html = fs.readFileSync(filePath, "utf8");
    html = html.replace(/{{OTP}}/g, otpPlain);

    await sendEmail(email, "Your OTP", html);

    res.json({ message: "OTP sent successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const checkExistence = async (req, res) => {
  const { field, value } = req.body;
  if (!field || !value) return res.status(400).json({ message: "Field and value required" });

  try {
    const query = {};
    query[field] = value;
    const exists = await User.findOne(query);

    if (exists) {
      return res.status(400).json({ message: `${field} already exists` });
    }
    return res.status(200).json({ message: "Available" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


// Verify OTP endpoint — accepts { mobile, otp }
export const verifyOtp = async (req, res) => {
  const { mobile, otp } = req.body;
  if (!mobile || !otp) return res.status(400).json({ message: "mobile and otp required" });

  try {
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const doc = await OTP.findOne({ mobile, otpHash, expiresAt: { $gt: new Date() } });
    if (!doc) return res.status(400).json({ message: "Invalid or expired OTP" });

    // remove used OTP
    await OTP.deleteOne({ _id: doc._id });

    // success — return 200; client may now call register (if new) or proceed to password set/login flow
    res.json({ message: "OTP verified" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: "Identifier and password are required" });
  }

  try {
    let user;
    // Check if identifier looks like a Doctor ID (Starts with DOC, case insensitive)
    const isDoctorId = /^DOC/i.test(identifier);

    if (isDoctorId) {
      // 1. Doctor ID Login Path
      user = await User.findOne({ doctorId: identifier });

      if (!user) {
        return res.status(401).json({ message: "Doctor ID is wrong" });
      }

      // Optional: Ensure the found user is actually a doctor
      if (user.role !== 'doctor') {
        return res.status(401).json({ message: "Invalid Doctor ID access" });
      }

    } else {
      // 2. Mobile Number Login Path (Default)
      user = await User.findOne({ mobile: identifier });

      if (!user) {
        // If not found in Users, check HelpDesk (Only supports mobile)
        const helpdesk = await HelpDesk.findOne({ mobile: identifier });

        if (helpdesk) {
          // Verify HelpDesk password
          const matchHd = await bcrypt.compare(password, helpdesk.password);
          if (!matchHd) return res.status(401).json({ message: "Password is wrong" });

          // Generate HelpDesk tokens
          const accessToken = jwt.sign(
            { id: helpdesk._id, role: "helpdesk", hospital: helpdesk.hospital },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
          );
          const refreshToken = await createRefreshToken(helpdesk);

          return res.json({
            tokens: { accessToken, refreshToken },
            user: { id: helpdesk._id, name: helpdesk.name, role: "helpdesk", hospital: helpdesk.hospital }
          });
        }

        // If neither User nor HelpDesk found
        return res.status(401).json({ message: "Mobile number is wrong" });
      }
    }

    // 3. User Found (Doctor or Patient) - Verify Password
    // Check constraint: "apart from the doctor all other roles must... login with phone number only"
    // If we found them via DoctorID, they are a Doctor (enforced above).
    // If we found them via Mobile, both Patients and Doctors are allowed to use Mobile.

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Password is wrong" });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await createRefreshToken(user);

    return res.json({
      tokens: { accessToken, refreshToken },
      user: { id: user._id, name: user.name, role: user.role }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Rotate access token using refresh token
export const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: "refreshToken required" });

  try {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    // Try User first
    let account = await User.findOne({ "refreshTokens.tokenHash": tokenHash });
    let isHelpDesk = false;

    // If not a User, try HelpDesk
    if (!account) {
      account = await HelpDesk.findOne({ "refreshTokens.tokenHash": tokenHash });
      isHelpDesk = !!account;
    }

    if (!account) return res.status(401).json({ message: "Invalid refresh token" });

    // check expiry
    const tokenObj = account.refreshTokens.find(t => t.tokenHash === tokenHash);
    if (!tokenObj || new Date(tokenObj.expiresAt) < new Date()) {
      // remove expired token
      account.refreshTokens = account.refreshTokens.filter(t => t.tokenHash !== tokenHash);
      await account.save();
      return res.status(401).json({ message: "Refresh token expired" });
    }

    // rotate: remove old and issue new refresh token
    account.refreshTokens = account.refreshTokens.filter(t => t.tokenHash !== tokenHash);
    await account.save();

    let accessToken, newRefreshToken;
    if (isHelpDesk) {
      // INCLUDE HOSPITAL IN REFRESH TOKEN
      accessToken = jwt.sign({ id: account._id, role: "helpdesk", hospital: account.hospital }, process.env.JWT_SECRET, { expiresIn: "7d" });
      const token = crypto.randomBytes(40).toString("hex");
      const newTokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      account.refreshTokens.push({ tokenHash: newTokenHash, createdAt: new Date(), expiresAt });
      await account.save();
      newRefreshToken = token;
    } else {
      accessToken = signAccessToken(account);
      newRefreshToken = await createRefreshToken(account);
    }

    res.json({ tokens: { accessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Logout: invalidate refresh token (client sends refresh token)
export const logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: "refreshToken required" });
  try {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const user = await User.findOne({ "refreshTokens.tokenHash": tokenHash });
    if (!user) return res.status(204).send();

    user.refreshTokens = user.refreshTokens.filter(t => t.tokenHash !== tokenHash);
    await user.save();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Forgot password (by email) — keep your flow
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "email required" });
  try {
    // Try regular users first
    let account = await User.findOne({ email });
    let accountType = "user";

    // If not a User, try HelpDesk
    if (!account) {
      account = await HelpDesk.findOne({ email });
      accountType = account ? "helpdesk" : accountType;
    }

    if (!account) return res.status(400).json({ message: "Email not registered" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    account.resetPasswordToken = hashedToken;
    account.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 mins
    await account.save();

    const allowedFrontends = process.env.FRONTEND_URL.split(",");
    const origin = req.headers.origin;

    const frontend = allowedFrontends.includes(origin)
      ? origin
      : allowedFrontends[0];

    const resetURL = `${frontend}/reset-password/${resetToken}`;

    const filePath = path.join(__dirname, "../templates/reset.html");
    let htmlMessage = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : `< p > Reset: ${resetURL}</p > `;
    htmlMessage = htmlMessage.replace(/{{resetURL}}/g, resetURL).replace(/{{year}}/g, new Date().getFullYear());

    await sendEmail(account.email, "Password Reset Request", htmlMessage);

    res.json({ message: "Reset link has been sent to your email.", accountType });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Complete reset (PATCH /auth/reset-password)
export const resetPassword = async (req, res) => {
  const { token, newPwd } = req.body;
  if (!token || !newPwd) return res.status(400).json({ message: "token and newPwd required" });

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Try User first
    let account = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpire: { $gt: Date.now() } });
    let accountType = "user";

    // If not found, try HelpDesk
    if (!account) {
      account = await HelpDesk.findOne({ resetPasswordToken: hashedToken, resetPasswordExpire: { $gt: Date.now() } });
      accountType = account ? "helpdesk" : accountType;
    }

    if (!account) return res.status(400).json({ message: "Invalid or expired token" });

    const salt = await bcrypt.genSalt(10);
    account.password = await bcrypt.hash(newPwd, salt);
    account.resetPasswordToken = undefined;
    account.resetPasswordExpire = undefined;
    await account.save();

    res.json({ message: "Password reset successful. Please login again.", accountType });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Who-am-i
export const me = async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  res.json(req.user);
};
