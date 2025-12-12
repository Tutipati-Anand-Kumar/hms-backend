import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DoctorProfile",
        required: true
    },
    hospital: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hospital",
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String, // e.g., "10:00 AM"
        required: true
    },
    endTime: {
        type: String, // e.g., "10:20 AM"
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "cancelled", "completed", "in-progress"],
        default: "pending"
    },
    symptoms: [String],
    reason: {
        type: String
    },
    mrn: {
        type: String // MRN for this specific appointment/hospital
    },
    patientDetails: {
        age: String, // Manual override Age
        gender: String, // Manual override Gender
        duration: String // Manual override Duration
    },
    reports: [String],
    type: {
        type: String,
        enum: ["online", "offline"],
        default: "offline"
    },
    urgency: {
        type: String,
        enum: ["urgent", "non-urgent", "Emergency - Visit Hospital Immediately", "Consult Doctor Soon", "Non-urgent"],
        default: "non-urgent"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("Appointment", appointmentSchema);
