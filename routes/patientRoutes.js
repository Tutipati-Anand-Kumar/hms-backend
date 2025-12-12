// routes/patientRoutes.js
import express from "express";
import { getProfile, updateProfile } from "../controllers/patientController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/profile", protect, authorizeRoles("patient","admin"), getProfile);
router.patch("/profile", protect, authorizeRoles("patient","admin"), updateProfile);

export default router;