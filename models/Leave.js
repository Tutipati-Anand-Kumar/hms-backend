import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
    {
        doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        reason: { type: String, required: true },
        assignedHelpdesk: { type: mongoose.Schema.Types.ObjectId, ref: "HelpDesk" },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
    },
    { timestamps: true }
);

const Leave = mongoose.model("Leave", leaveSchema);
export default Leave;