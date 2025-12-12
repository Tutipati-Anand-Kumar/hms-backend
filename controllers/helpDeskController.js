// controllers/helpDeskController.js
import HelpDesk from "../models/HelpDesk.js";
import DoctorProfile from "../models/DoctorProfile.js";
import User from "../models/User.js";
import bcrypt from "bcrypt";
import asyncHandler from "../middleware/errorMiddleware.js";
import ApiError from "../utils/ApiError.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Hospital from "../models/Hospital.js";
import mongoose from "mongoose";

const signAccessTokenForHelpDesk = (helpdesk) => {
  return jwt.sign({ id: helpdesk._id, role: "helpdesk" }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const createRefreshTokenForHelpDesk = async (helpdesk) => {
  const token = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  helpdesk.refreshTokens = helpdesk.refreshTokens || [];
  helpdesk.refreshTokens.push({ tokenHash, createdAt: new Date(), expiresAt });
  await helpdesk.save();
  return token;
};

export const helpdeskLogin = asyncHandler(async (req, res) => {
  const { mobile, password } = req.body;
  if (!mobile || !password) throw new ApiError(400, "mobile and password required");

  const helpdesk = await HelpDesk.findOne({ mobile });
  if (!helpdesk) throw new ApiError(401, "Invalid credentials");

  const match = await bcrypt.compare(password, helpdesk.password);
  if (!match) throw new ApiError(401, "Invalid credentials");

  const accessToken = signAccessTokenForHelpDesk(helpdesk);
  const refreshToken = await createRefreshTokenForHelpDesk(helpdesk);

  res.json({ tokens: { accessToken, refreshToken }, user: { id: helpdesk._id, name: helpdesk.name, role: "helpdesk" } });
});

export const helpdeskRefresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, "refreshToken required");

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const helpdesk = await HelpDesk.findOne({ "refreshTokens.tokenHash": tokenHash });
  if (!helpdesk) throw new ApiError(401, "Invalid refresh token");

  const tokenObj = helpdesk.refreshTokens.find((t) => t.tokenHash === tokenHash);
  if (!tokenObj || new Date(tokenObj.expiresAt) < new Date()) {
    helpdesk.refreshTokens = helpdesk.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
    await helpdesk.save();
    throw new ApiError(401, "Refresh token expired");
  }

  helpdesk.refreshTokens = helpdesk.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
  await helpdesk.save();

  const accessToken = signAccessTokenForHelpDesk(helpdesk);
  const newRefreshToken = await createRefreshTokenForHelpDesk(helpdesk);
  res.json({ tokens: { accessToken, refreshToken: newRefreshToken } });
});

export const helpdeskLogout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(204).send();

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const helpdesk = await HelpDesk.findOne({ "refreshTokens.tokenHash": tokenHash });
  if (!helpdesk) return res.status(204).send();

  helpdesk.refreshTokens = helpdesk.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
  await helpdesk.save();
  res.status(204).send();
});

export const helpdeskMe = asyncHandler(async (req, res) => {
  if (!req.helpDesk) throw new ApiError(401, "Not authenticated as helpdesk");
  const hd = await HelpDesk.findById(req.helpDesk._id).populate("hospital", "name _id");
  res.json({ id: hd._id, name: hd.name, email: hd.email, mobile: hd.mobile, hospital: hd.hospital });
});

export const updateHelpdeskProfile = asyncHandler(async (req, res) => {
  if (!req.helpDesk) throw new ApiError(401, "Not authenticated as helpdesk");
  const helpdesk = await HelpDesk.findById(req.helpDesk._id);
  if (!helpdesk) throw new ApiError(404, "HelpDesk not found");

  const { name, email, mobile } = req.body;
  if (name) helpdesk.name = name;
  if (email) helpdesk.email = email;
  if (mobile) helpdesk.mobile = mobile;

  try {
    await helpdesk.save();
    res.json({ id: helpdesk._id, name: helpdesk.name, email: helpdesk.email, mobile: helpdesk.mobile });
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern && err.keyPattern.mobile) {
        throw new ApiError(400, "This phone number is already registered with another user. Please select another phone number.");
      }
      throw new ApiError(400, "Duplicate field value entered");
    }
    throw err;
  }
});

export const helpDeskDashboard = asyncHandler(async (req, res) => {
  const helpDesk = req.helpDesk;
  const totalDoctors = await User.countDocuments({ role: "doctor" });
  const totalPatients = await User.countDocuments({ role: "patient" });

  res.json({
    totalDoctors,
    totalPatients,
  });
});

export const helpdeskCreateDoctor = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const helpdesk = req.helpDesk || req.user;
    if (!helpdesk || !helpdesk.hospital) {
      return res.status(403).json({ message: "Helpdesk not assigned to any hospital" });
    }

    const {
      name, email, mobile, password,
      specialties = [], consultationFee, availability = [],
      qualifications, experienceStart, bio, profilePic
    } = req.body;

    console.log("helpdeskCreateDoctor req.body:", JSON.stringify(req.body, null, 2));

    if (!mobile || !name || !password) return res.status(400).json({ message: "name, mobile, password required" });

    // start transaction
    session.startTransaction();

    const existing = await User.findOne({ $or: [{ email }, { mobile }] }).session(session);
    if (existing) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Email or mobile already in use" });
    }

    const doctorId = "DOC" + Math.floor(100000 + Math.random() * 900000);
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const doctorUser = new User({
      name,
      email,
      mobile,
      password: hashed,
      role: "doctor",
      doctorId,
      avatar: profilePic // Save profile pic to User model
    });
    await doctorUser.save({ session });

    const docProfile = new DoctorProfile({
      user: doctorUser._id,
      specialties,
      qualifications: qualifications || [],
      experienceStart: experienceStart || null,
      bio: bio || "",
      profilePic: profilePic || "",
      hospitals: [{ hospital: helpdesk.hospital, specialties, consultationFee, availability }]
    });
    await docProfile.save({ session });

    const hospital = await Hospital.findById(helpdesk.hospital).session(session);
    if (!hospital) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Assigned hospital not found" });
    }

    hospital.doctors.push({ doctor: docProfile._id, specialties, consultationFee });
    hospital.numberOfDoctors = hospital.doctors.length;
    await hospital.save({ session });

    await session.commitTransaction();
    session.endSession();

    // populate response
    const populatedProfile = await DoctorProfile.findById(docProfile._id)
      .populate({ path: "user", select: "name email mobile doctorId" })
      .populate({ path: "hospitals.hospital", select: "name address hospitalId" });

    res.status(201).json({ message: "Doctor created and assigned to helpdesk hospital", doctor: populatedProfile });
  } catch (err) {
    await session.abortTransaction().catch(() => { });
    session.endSession();
    console.error("helpdeskCreateDoctor error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getHelpDeskById = asyncHandler(async (req, res) => {
  const helpdesk = await HelpDesk.findById(req.params.id).select("-password -refreshTokens");
  if (!helpdesk) throw new ApiError(404, "HelpDesk not found");
  res.json(helpdesk);
});

export const getHelpDeskByHospitalId = asyncHandler(async (req, res) => {
  const { hospitalId } = req.params;
  const helpdesk = await HelpDesk.findOne({ hospital: hospitalId }).select("-password -refreshTokens");
  if (!helpdesk) throw new ApiError(404, "HelpDesk not found for this hospital");
  res.json(helpdesk);
});