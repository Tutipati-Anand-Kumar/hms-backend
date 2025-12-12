import Leave from "../models/Leave.js";
import DoctorProfile from "../models/DoctorProfile.js";
import HelpDesk from "../models/HelpDesk.js";
import { createNotification } from "./notificationController.js";

// Request Leave
export const requestLeave = async (req, res) => {
    try {
        const { startDate, endDate, reason } = req.body;
        const userId = req.user._id;

        // Ensure user is a doctor
        if (req.user.role !== "doctor") {
            return res.status(403).json({ message: "Only doctors can request leave" });
        }

        // Validate Dates: Start Date cannot be after End Date. Equal dates are allowed.
        if (new Date(startDate) > new Date(endDate)) {
            return res.status(400).json({ message: "End date must be after or equal to start date" });
        }

        // Find Doctor Profile to get assigned helpdesk
        const doctorProfile = await DoctorProfile.findOne({ user: userId });
        if (!doctorProfile) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }

        let assignedHelpdesk = doctorProfile.assignedHelpdesk;

        // If helpdesk not assigned, fallback to hospital helpdesk
        if (!assignedHelpdesk && doctorProfile.hospitals && doctorProfile.hospitals.length > 0) {
            const hospitalId = doctorProfile.hospitals[0].hospital;
            const helpdesk = await HelpDesk.findOne({ hospital: hospitalId });
            if (helpdesk) {
                assignedHelpdesk = helpdesk._id;
            }
        }

        const leave = await Leave.create({
            doctorId: userId,
            startDate,
            endDate,
            reason,
            assignedHelpdesk
        });

        // Notify Helpdesk
        if (assignedHelpdesk) {
            await createNotification(req, {
                recipient: assignedHelpdesk,
                sender: userId,
                type: "system_alert",
                message: `New leave request from Doctor`,
                relatedId: leave._id
            });
            if (req.io) {
                req.io.to(`helpdesk_${assignedHelpdesk}`).emit("leave:new", {
                    message: "New leave request",
                    leave
                });
            }
        }

        res.status(201).json({ message: "Leave requested successfully", leave });
    } catch (error) {
        console.error("Request Leave Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get Leaves
export const getLeaves = async (req, res) => {
    try {
        const { role, _id } = req.user;
        let query = {};

        if (role === "doctor") {
            query.doctorId = _id;
        } else if (role === "helpdesk") {
            query.assignedHelpdesk = _id;
        }

        const leaves = await Leave.find(query)
            .populate("doctorId", "name email")
            .sort({ createdAt: -1 });

        res.json(leaves);
    } catch (error) {
        console.error("Get Leaves Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Update Leave Status
export const updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { role, _id } = req.user;

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const leave = await Leave.findById(id);
        if (!leave) {
            return res.status(404).json({ message: "Leave request not found" });
        }

        // Authorization: helpdesk can only manage assigned requests
        if (role === "helpdesk") {
            if (leave.assignedHelpdesk && leave.assignedHelpdesk.toString() !== _id.toString()) {
                return res.status(403).json({ message: "Not authorized to manage this leave request" });
            }
        }

        leave.status = status;
        await leave.save();

        // Notify Doctor
        await createNotification(req, {
            recipient: leave.doctorId,
            sender: _id,
            type: "system_alert",
            message: `Your leave request has been ${status}`,
            relatedId: leave._id
        });

        if (req.io) {
            req.io.to(`doctor_${leave.doctorId}`).emit("leave:status_change", {
                message: `Leave request ${status}`,
                leave
            });
        }

        res.json({ message: `Leave ${status}`, leave });
    } catch (error) {
        console.error("Update Leave Status Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};