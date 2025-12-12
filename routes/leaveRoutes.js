import express from "express";
import { requestLeave, getLeaves, updateLeaveStatus } from "../controllers/leaveController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/request", protect, authorize("doctor"), requestLeave);
router.get("/", protect, getLeaves);
router.patch("/:id/status", protect, authorize("admin", "helpdesk", "super-admin"), updateLeaveStatus);

export default router;