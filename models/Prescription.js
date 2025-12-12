import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
        required: false
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    medicines: [{
        type: String
    }],
    diet_advice: [{
        type: String
    }],
    suggested_tests: [{
        type: String
    }],
    follow_up: {
        type: String
    },
    avoid: [{
        type: String
    }],
    signature: {
        type: String // URL to the signature image
    },
    symptoms: {
        type: String
    },
    matchedSymptoms: [{
        type: String
    }],
    notes: {
        type: String
    },
    reason: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("Prescription", prescriptionSchema);
