import Notification from "../models/Notification.js";

// Helper to create notification (Internal Use)
export const createNotification = async (req, { recipient, sender, type, message, relatedId }) => {
    try {
        const notification = await Notification.create({
            recipient,
            sender,
            type,
            message,
            relatedId
        });

        // Emit Socket Event
        if (req.io) {
            // Determine room based on recipient role (This requires knowing recipient role, or we just emit to user_ID if we change room logic)
            // For now, let's assume the client joins "user_{userId}" room as well or we fetch user role.
            // Simplified: Emit to "user_{recipientId}" if we standardize rooms, OR fetch user to get role.
            // Better approach: The caller of this function usually knows the role.
            // Let's emit to a generic "user_{recipientId}" room if possible, or rely on the caller to emit.
            // BUT, the requirement says rooms are "role_id".

            // We will try to emit to all possible role rooms for this user or just "user_{id}" if we add that.
            // Let's stick to the plan: The caller (bookingController) emits the specific events.
            // This helper just saves to DB. 
            // WAIT, the plan said "Emit socket events" in the controller.
            // Let's let the specific controllers handle the emission for now to ensure correct rooms.
            // OR, we can emit to `notification_${recipient}` if the client joins that.
        }

        return notification;
    } catch (err) {
        console.error("Notification creation error:", err);
    }
};

export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id })
            .sort({ createdAt: -1 });
        res.json(notifications);
    } catch (err) {
        console.error("getNotifications error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true, readAt: new Date() },
            { new: true }
        );
        res.json(notification);
    } catch (err) {
        console.error("markAsRead error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );
        res.json({ message: "All marked as read" });
    } catch (err) {
        console.error("markAllAsRead error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Restore deleteNotification
export const deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            recipient: req.user._id // Ensure user owns the notification
        });

        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.json({ message: "Notification deleted" });
    } catch (err) {
        console.error("deleteNotification error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const deleteEmergencyAlerts = async (req, res) => {
    try {
        // Delete all notifications of type 'emergency_alert' for this user
        await Notification.deleteMany({
            recipient: req.user._id,
            type: "emergency_alert"
        });
        res.json({ message: "Emergency alerts cleared" });
    } catch (err) {
        console.error("deleteEmergencyAlerts error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Broadcast Emergency Alert (Helpdesk -> Doctors of Hospital)
export const sendEmergencyAlert = async (req, res) => {
    try {
        const { hospitalId, message } = req.body;
        const senderId = req.user._id;

        if (!hospitalId || !message) {
            return res.status(400).json({ message: "Hospital ID and message are required" });
        }

        // Find all doctors working in this hospital
        // We need to find DoctorProfiles where 'hospitals.hospital' matches hospitalId
        const DoctorProfile = (await import("../models/DoctorProfile.js")).default;

        const doctors = await DoctorProfile.find({
            "hospitals.hospital": hospitalId
        }).populate("user");

        const notifications = [];

        for (const doc of doctors) {
            if (!doc.user) continue;

            const notif = await createNotification(req, {
                recipient: doc.user._id,
                sender: senderId,
                type: "emergency_alert",
                message: message,
                relatedId: hospitalId
            });
            notifications.push(notif);

            // Emit Socket
            if (req.io) {
                req.io.to(`doctor_${doc.user._id}`).emit("notification:new", {
                    _id: notif._id,
                    message: `EMERGENCY: ${message}`,
                    type: "emergency_alert",
                    senderName: req.user.name,
                    createdAt: notif.createdAt
                });
            }
        }

        res.json({ message: `Emergency alert sent to ${notifications.length} doctors`, count: notifications.length });

    } catch (err) {
        console.error("sendEmergencyAlert error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
