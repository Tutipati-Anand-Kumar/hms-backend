import express from "express";
import {
  getDoctorProfile,
  updateDoctorProfile,
  searchDoctors,
  getDoctorById,
  getPatientDetails,
  uploadPhoto,
  startNextAppointment,
  getDoctorCalendarStats,
  getDoctorAppointmentsByDate,
  addQuickNote,
  getQuickNotes,
  getDoctorPatients,
  deleteQuickNote
} from "../controllers/doctorController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.get("/", searchDoctors);
router.get("/me", protect, authorizeRoles("doctor", "admin"), getDoctorProfile);
router.get("/profile/me", protect, authorizeRoles("doctor", "admin"), getDoctorProfile);
router.put("/me", protect, authorizeRoles("doctor", "admin"), updateDoctorProfile);
router.post("/start-next", protect, authorizeRoles("doctor", "admin"), startNextAppointment);
router.post("/upload-photo", protect, authorizeRoles("doctor", "admin", "super-admin", "helpdesk"), upload.single("photo"), uploadPhoto);
router.get("/my-patients", protect, authorizeRoles("doctor", "admin"), getDoctorPatients);
router.get("/patient/:patientId", protect, authorizeRoles("doctor", "admin"), getPatientDetails);
router.get("/calendar/stats", protect, authorizeRoles("doctor", "admin", "helpdesk"), getDoctorCalendarStats);
router.get("/calendar/appointments", protect, authorizeRoles("doctor", "admin"), getDoctorAppointmentsByDate);

// Quick Notes Routes
router.post("/quick-notes", protect, authorizeRoles("doctor", "admin"), addQuickNote);
router.get("/quick-notes", protect, authorizeRoles("doctor", "admin"), getQuickNotes);
router.delete("/quick-notes/:id", protect, authorizeRoles("doctor", "admin"), deleteQuickNote);

router.get("/:id", getDoctorById);

export default router;