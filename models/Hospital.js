// models/Hospital.js
import mongoose from "mongoose";

const doctorRefSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "DoctorProfile", required: true },
  specialties: [String],
  consultationFee: Number,
  assignedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["active","inactive"], default: "active" }
}, { _id: false });

const branchSchema = new mongoose.Schema({
  name: String,
  address: String,
  phone: String,
  mobile: String,
  createdAt: { type: Date, default: Date.now }
});

const departmentSchema = new mongoose.Schema({
  name: String,
  code: String
});

const roomSchema = new mongoose.Schema({
  label: String,
  type: String
});

const employeeRefSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  role: String
});

const hospitalSchema = new mongoose.Schema({
  hospitalId: { type: String, unique: true, index: true, sparse: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  location: { lat: Number, lng: Number },
  phone: String,
  email: String,
  pincode: String,
  establishedYear: Number,
  specialities: [String],
  services: [String],
  numberOfDoctors: { type: Number, default: 0 },
  numberOfBeds: Number,
  ICUBeds: Number,
  ambulanceAvailability: { type: Boolean, default: false },
  rating: Number,
  website: String,
  operatingHours: String,
  status: { type: String, enum: ["pending","approved","suspended"], default: "pending" },
  branches: [branchSchema],
  departments: [departmentSchema],
  rooms: [roomSchema],
  employees: [employeeRefSchema],
  doctors: [doctorRefSchema], 
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

const Hospital = mongoose.model("Hospital", hospitalSchema);
export default Hospital;