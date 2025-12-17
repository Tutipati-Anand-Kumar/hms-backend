import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    name: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    type: {
        type: String, // MIME type
        required: true
    },
    public_id: {
        type: String
    },
    date: {
        type: String, // Report date selected by user
        required: true
    },
    size: {
        type: Number
    },
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment"
    },
    hospital: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hospital"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("Report", reportSchema);
