// models/DoctorProfile.js
import mongoose from "mongoose";

const hospitalRefSubSchema = new mongoose.Schema({
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  specialties: [String],
  consultationFee: Number,
  availability: [
    {
      days: [String], // e.g., ["Monday", "Tuesday"]
      startTime: String, // "10:00 am"
      breakStart: String, // "01:00 pm"
      breakEnd: String, // "02:00 pm"
      endTime: String // "06:00 pm"
    }
  ],
  assignedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, { _id: false });

const doctorProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  assignedHelpdesk: { type: mongoose.Schema.Types.ObjectId, ref: "HelpDesk" },
  specialties: [String], // global specialties
  hospitals: [hospitalRefSubSchema], // many-to-many with per-hospital metadata
  qualifications: [String],
  experienceStart: Date,
  bio: String,
  profilePic: String, // URL to profile image
  quickNotes: [
    {
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// virtual for computed experience
doctorProfileSchema.virtual('experience').get(function () {
  if (!this.experienceStart) return null;
  const start = new Date(this.experienceStart);
  const now = new Date();
  let totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) totalMonths -= 1;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years <= 0 && months <= 0) return 'Less than a month';
  if (years > 0 && months > 0) return `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`;
  if (years > 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${months} month${months > 1 ? 's' : ''}`;
});

const DoctorProfile = mongoose.model("DoctorProfile", doctorProfileSchema);
export default DoctorProfile;