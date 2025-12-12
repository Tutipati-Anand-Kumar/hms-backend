// controllers/hospitalController.js
import Hospital from "../models/Hospital.js";
import mongoose from "mongoose";
import DoctorProfile from "../models/DoctorProfile.js";

export const createHospital = async (req, res) => {
  try {

    const count = await Hospital.countDocuments();
    req.body.hospitalId = "HOSP" + String(count + 1).padStart(4, "0");

    const hospital = await Hospital.create(req.body);
    res.status(201).json(hospital);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


export const listHospitals = async (req, res) => {
  try {
    const { lat, lng, radius, speciality } = req.query;
    // For now a simple filter
    const filter = {};
    if (speciality) filter.specialities = speciality;
    const hospitals = await Hospital.find(filter).limit(200);
    res.json(hospitals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    res.json(hospital);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const patchHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(hospital);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const addBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address } = req.body;
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ message: "Not found" });
    hospital.branches.push({ name, address });
    await hospital.save();
    res.status(201).json(hospital);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listBranches = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ message: "Not found" });
    res.json(hospital.branches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteHospital = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id: hospitalId } = req.params;

    session.startTransaction();

    const hospital = await Hospital.findById(hospitalId).session(session);
    if (!hospital) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Hospital not found" });
    }

    // 🔥 Remove hospital reference from all doctor profiles
    await DoctorProfile.updateMany(
      {},
      { $pull: { hospitals: { hospital: hospitalId } } },
      { session }
    );

    // Delete hospital itself
    await Hospital.findByIdAndDelete(hospitalId).session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Hospital deleted successfully" });

  } catch (err) {
    await session.abortTransaction().catch(() => { });
    session.endSession();
    console.error("deleteHospital error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};