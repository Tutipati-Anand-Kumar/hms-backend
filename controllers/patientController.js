// controllers/patientController.js
import PatientProfile from "../models/PatientProfile.js";
import User from "../models/User.js";

export const getProfile = async (req, res) => {
  try {
    const profile = await PatientProfile.findOne({ user: req.user._id }).populate("user", "name email mobile role");
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, ...profileData } = req.body;

    // Update User model if name, email, or mobile is provided
    if (name || email || req.body.mobile) {
      await User.findByIdAndUpdate(req.user._id, {
        $set: {
          name,
          email,
          mobile: req.body.mobile
        }
      });
    }

    // Update PatientProfile
    const profile = await PatientProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: profileData },
      { new: true, upsert: true }
    ).populate("user", "name email mobile");

    res.json(profile);
  } catch (err) {
    if (err.code === 11000) {
      // Check if it's the mobile number that's duplicated
      if (err.keyPattern && err.keyPattern.mobile) {
        return res.status(400).json({ message: "This phone number is already registered with another user. Please select another phone number." });
      }
      return res.status(400).json({ message: "Duplicate field value entered" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
