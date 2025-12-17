// routes/adminRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  getAllUsers,
  deleteUser,
  updateUser,
  createDoctor,
  createHelpDesk,
  createAdmin,
  adminBulkHospitals,
  adminListHospitals,
  adminPatchHospitalStatus,
  adminDashboard,
  adminGetAudits,
  adminBroadcast,
  getAdminProfile,
  updateAdminProfile,
  assignDoctorToHospital,
  removeDoctorFromHospital,
  listDoctorsByHospital,
  getHospitalWithDoctors,
  assignHelpdeskToHospital,
  createHospital
} from "../controllers/adminController.js";

const router = express.Router();

router.post("/hospitals/bulk", protect, authorizeRoles("super-admin", "admin"), adminBulkHospitals);
router.get("/hospitals", protect, authorizeRoles("super-admin", "admin"), adminListHospitals);
router.patch("/hospitals/:id/status", protect, authorizeRoles("super-admin", "admin"), adminPatchHospitalStatus);

router.post("/hospitals/assign-doctor", protect, authorizeRoles("super-admin", "admin"), assignDoctorToHospital);
router.post("/hospitals/:hospitalId/remove-doctor", protect, authorizeRoles("super-admin", "admin"), removeDoctorFromHospital);
router.get("/hospitals/:id/doctors", protect, authorizeRoles("super-admin", "admin"), listDoctorsByHospital);
router.get("/hospitals/:id/details", protect, authorizeRoles("super-admin", "admin"), getHospitalWithDoctors);

router.get("/users", protect, authorizeRoles("super-admin", "admin"), getAllUsers);
router.put("/users/:id", protect, authorizeRoles("super-admin", "admin"), updateUser);
router.delete("/users/:id", protect, authorizeRoles("super-admin", "admin", "patient", "doctor", "helpdesk"), deleteUser);

router.get("/me", protect, authorizeRoles("super-admin", "admin"), getAdminProfile);
router.put("/me", protect, authorizeRoles("super-admin", "admin"), updateAdminProfile);

router.post("/create-doctor", protect, authorizeRoles("super-admin", "admin"), createDoctor);
router.post("/create-admin", protect, authorizeRoles("super-admin", "admin"), createAdmin);
router.post("/create-helpdesk", protect, authorizeRoles("super-admin", "admin"), createHelpDesk);
router.post("/create-hospital", protect, authorizeRoles("super-admin", "admin"), createHospital);
router.post("/assign-helpdesk", protect, authorizeRoles("super-admin", "admin"), assignHelpdeskToHospital);

router.get("/analytics/dashboard", protect, authorizeRoles("super-admin", "admin"), adminDashboard);
router.get("/audits", protect, authorizeRoles("super-admin", "admin"), adminGetAudits);
router.post("/broadcast", protect, authorizeRoles("super-admin", "admin"), adminBroadcast);

export default router;