import express from "express";
import upload from "../middleware/upload.js";
import { protect } from "../middleware/authMiddleware.js";
import {
    uploadFile,
    saveReport,
    getPatientReports,
    deleteReport,
    proxyPDF
} from "../controllers/reportController.js";

const router = express.Router();

// @route   POST /api/reports/upload
// @desc    Upload file to Cloudinary
// @access  Private
router.post("/upload", protect, upload.single("report"), uploadFile);

// @route   POST /api/reports/save
// @desc    Save report metadata to database
// @access  Private
router.post("/save", protect, saveReport);

// @route   GET /api/reports/patient/:patientId
// @desc    Get all reports for a specific patient
// @access  Private
router.get("/patient/:patientId", protect, getPatientReports);

// @route   DELETE /api/reports/:id
// @desc    Delete a report
// @access  Private
router.delete("/:id", protect, deleteReport);

// @route   GET /api/reports/proxy/:reportId
// @desc    Proxy PDF from Cloudinary to bypass CORS/auth issues
// @access  Private
router.get("/proxy/:reportId", protect, proxyPDF);

export default router;