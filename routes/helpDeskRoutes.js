import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  helpDeskDashboard,
  helpdeskLogin,
  helpdeskRefresh,
  helpdeskLogout,
  helpdeskMe,
  updateHelpdeskProfile,
  helpdeskCreateDoctor,
  getHelpDeskById,
  getHelpDeskByHospitalId,
  getHelpDeskDoctors
} from "../controllers/helpDeskController.js";
import { deleteHospital } from "../controllers/hospitalController.js";

const router = express.Router();

router.post("/login", helpdeskLogin);
router.post("/refresh", helpdeskRefresh);
router.post("/logout", helpdeskLogout);

router.get("/me", protect, helpdeskMe);
router.get("/profile/me", protect, helpdeskMe);

router.put("/me", protect, authorizeRoles("helpdesk"), updateHelpdeskProfile);
router.get("/dashboard", protect, authorizeRoles("helpdesk"), helpDeskDashboard);
router.get("/hospital/:hospitalId", protect, getHelpDeskByHospitalId);
router.post("/doctor", protect, authorizeRoles("helpdesk"), helpdeskCreateDoctor);
router.get("/doctors", protect, authorizeRoles("helpdesk"), getHelpDeskDoctors);
router.get("/:id", protect, getHelpDeskById);

router.delete("/:id", protect, authorizeRoles("admin", "super-admin"), deleteHospital);

export default router;
