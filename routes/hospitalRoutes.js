// routes/hospitalRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  createHospital,
  listHospitals,
  getHospital,
  patchHospital,
  addBranch,
  listBranches
} from "../controllers/hospitalController.js";

const router = express.Router();

router.post("/", protect, authorizeRoles("admin", "super-admin"), createHospital);
router.get("/", listHospitals);
router.get("/:id", getHospital);
router.patch("/:id", protect, authorizeRoles("admin", "super-admin"), patchHospital);

router.post("/:id/branches", protect, authorizeRoles("admin", "super-admin"), addBranch);
router.get("/:id/branches", listBranches);

export default router;
