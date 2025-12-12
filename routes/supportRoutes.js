import express from "express";
import {
    createSupportRequest,
    getAllSupportRequests,
    getMySupportRequests,
    getSupportRequestById,
    addReply,
    updateSupportStatus
} from "../controllers/supportController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Create ticket (with attachments)
router.post("/", protect, upload.array("attachments", 3), createSupportRequest);

// Get all tickets (Super Admin & Admin)
router.get("/", protect, authorize("super-admin", "admin"), getAllSupportRequests);

// Get current user's tickets
router.get("/my-tickets", protect, getMySupportRequests);

// Get single ticket
router.get("/:id", protect, getSupportRequestById);

// Reply to ticket (with attachments)
router.post("/:id/reply", protect, upload.array("attachments", 3), addReply);

// Update ticket status (Admin/Super Admin)
router.put("/:id/status", protect, authorize("super-admin", "admin"), updateSupportStatus);

export default router;
