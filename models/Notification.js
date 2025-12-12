import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    type: {
        type: String,
        enum: ["appointment_request", "appointment_confirmed", "appointment_cancelled", "appointment_rejected", "appointment_completed", "system_alert", "emergency_alert"],
        required: true
    },
    message: {
        type: String,
        required: true
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment"
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 1209600 // 14 days in seconds (14 * 24 * 60 * 60)
    }
});

export default mongoose.model("Notification", notificationSchema);
