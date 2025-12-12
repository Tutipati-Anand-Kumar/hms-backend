// models/PatientProfile.js
import mongoose from "mongoose";

const patientProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  medicalHistory: { type: String },
  contactNumber: { type: String },

  // New fields per your confirmation
  dob: { type: Date },
  gender: { type: String, enum: ["male", "female", "other"] },
  address: { type: String },
  conditions: { type: String, default: "None" },
  allergies: { type: String, default: "None" },
  medications: { type: String, default: "None" },

  // Array to store hospital-specific data
  hospitalRecords: [{
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    mrn: { type: String },
    lastVisit: { type: Date }
  }]
}, { timestamps: true });

// Virtual: age (calculated from dob)
patientProfileSchema.virtual("age").get(function () {
  if (!this.dob) return null;
  const ageMs = Date.now() - this.dob.getTime();
  return Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
});

// Ensure virtuals are included in toJSON / toObject output
patientProfileSchema.set("toJSON", { virtuals: true });
patientProfileSchema.set("toObject", { virtuals: true });

const PatientProfile = mongoose.model("PatientProfile", patientProfileSchema);
export default PatientProfile;
