import express from "express";
import { bookAppointment, checkAvailability, updateAppointmentStatus, getAppointments, getHospitalAppointmentStats } from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/book", protect, bookAppointment);
router.get("/availability", protect, checkAvailability);
router.get("/hospital-stats", protect, getHospitalAppointmentStats);
router.put("/status/:id", protect, updateAppointmentStatus); // Matches frontend PUT /bookings/status/:id
router.get("/my-appointments", protect, getAppointments);

export default router;