import mongoose from "mongoose";

const supportRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ["patient", "doctor", "admin", "front-desk", "super-admin"],
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["feedback", "complaint", "bug", "other"],
        default: "feedback"
    },
    status: {
        type: String,
        enum: ["open", "in-progress", "resolved"],
        default: "open"
    },
    attachments: [{
        type: String // URL of the uploaded file
    }],
    replies: [{
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        name: { type: String }, // Snapshot of name for UI
        role: { type: String, required: true },
        message: { type: String, required: true },
        attachments: [{ type: String }],
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

supportRequestSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const SupportRequest = mongoose.model("SupportRequest", supportRequestSchema);
export default SupportRequest;
