import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    content: {
        type: String,
        required: true
    },
    hospital: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hospital",
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message", // Reference to another message
        default: null
    },
    hiddenFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User" // Users who have "deleted" this message for themselves
    }]
}, { timestamps: true });

export default mongoose.model("Message", messageSchema);
