import express from "express";
import { createPrescription, getPrescriptions, getPrescriptionById, deletePrescription, deletePrescriptions } from "../controllers/prescriptionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createPrescription);
router.get("/", protect, getPrescriptions);
router.get("/:id", protect, getPrescriptionById);
router.post("/delete-batch", protect, deletePrescriptions);
router.delete("/:id", protect, deletePrescription);

export default router;
