import express from "express";
import { getDoctorNotes, createNote, deleteNote, deleteAllNotes } from "../controllers/noteController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:doctorId", protect, getDoctorNotes);
router.post("/", protect, createNote);
router.delete("/:id", protect, deleteNote);
router.delete("/all/:doctorId", protect, deleteAllNotes);

export default router;
