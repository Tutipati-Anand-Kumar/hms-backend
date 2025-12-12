// routes/patientRoutes.js
import express from "express";
import { getProfile, updateProfile, getPatientProfileById } from "../controllers/patientController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/profile", protect, authorizeRoles("patient", "admin"), getProfile);
router.get("/profile/:id", protect, authorizeRoles("doctor", "admin"), getPatientProfileById);
router.patch("/profile", protect, authorizeRoles("patient", "admin"), updateProfile);

export default router;