import User from "../models/User.js";
import HelpDesk from "../models/HelpDesk.js";
import bcrypt from "bcrypt";
import DoctorProfile from "../models/DoctorProfile.js";
import Hospital from "../models/Hospital.js";
import mongoose from "mongoose";

export const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;

    if (role === 'doctor') {
      const profiles = await DoctorProfile.find()
        .populate('user', '-password')
        .populate('hospitals.hospital', 'name address');

      const data = profiles
        .filter(p => p.user) // Ensure user exists
        .map(p => ({
          ...p.user.toObject(),
          specialties: p.specialties,
          qualifications: p.qualifications,
          experienceStart: p.experienceStart,
          bio: p.bio,
          doctorProfileId: p._id,
          availability: p.availability,
          hospitals: p.hospitals
        }));
      return res.json(data);
    }

    if (role === 'helpdesk') {
      const helpdesks = await HelpDesk.find().select("-password").populate("hospital", "name");
      const data = helpdesks.map(h => ({
        ...h.toObject(),
        role: 'helpdesk',
        hospitalName: h.hospital?.name,
        hospitalId: h.hospital?._id
      }));
      return res.json(data);
    }

    if (role === 'patient') {
      const users = await User.find({ role: 'patient' }).select("-password");
      // Fetching profiles
      const profiles = await mongoose.model("PatientProfile").find({ user: { $in: users.map(u => u._id) } });

      const data = users.map(user => {
        const profile = profiles.find(p => p.user.toString() === user._id.toString());
        return {
          ...user.toObject(),
          ...profile?.toObject(),
          _id: user._id, // Ensure user _id is preserved
          patientProfileId: profile?._id
        };
      });
      return res.json(data);
    }

    const query = {};
    if (role) query.role = role;

    let users = [];
    if (role) {
      users = await User.find(query).select("-password");
    } else {
      // Fetch all Users
      const allUsers = await User.find().select("-password");

      // Fetch all HelpDesks
      const allHelpDesks = await HelpDesk.find().select("-password").populate("hospital", "name");
      const formattedHelpDesks = allHelpDesks.map(h => ({
        ...h.toObject(),
        role: 'helpdesk',
        hospitalName: h.hospital?.name,
        hospitalId: h.hospital?._id
      }));

      // Fetch all Doctor Profiles to merge
      const doctorProfiles = await DoctorProfile.find().populate('hospitals.hospital', 'name address');

      // Fetch all Patient Profiles to merge
      const patientProfiles = await mongoose.model("PatientProfile").find();

      // Merge details
      users = [...allUsers.map(u => {
        const userObj = u.toObject();
        if (u.role === 'doctor') {
          const profile = doctorProfiles.find(dp => dp.user.toString() === u._id.toString());
          if (profile) {
            return {
              ...userObj,
              specialties: profile.specialties,
              qualifications: profile.qualifications,
              experienceStart: profile.experienceStart,
              bio: profile.bio,
              doctorProfileId: profile._id,
              availability: profile.availability,
              hospitals: profile.hospitals
            };
          }
        } else if (u.role === 'patient') {
          const profile = patientProfiles.find(pp => pp.user.toString() === u._id.toString());
          if (profile) {
            return {
              ...userObj,
              ...profile.toObject(),
              patientProfileId: profile._id,
              _id: u._id // Keep user _id
            };
          }
        }
        return userObj;
      }), ...formattedHelpDesks];
    }

    res.json(users);
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteUser = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const user = await User.findById(req.params.id).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === "doctor") {
      const doctorProfile = await DoctorProfile.findOne({ user: user._id }).session(session);
      if (doctorProfile) {
        await Hospital.updateMany({}, { $pull: { doctors: { doctor: doctorProfile._id } } }, { session });
        await DoctorProfile.deleteOne({ _id: doctorProfile._id }).session(session);
      }
    }
    await User.findByIdAndDelete(user._id).session(session);
    await session.commitTransaction();
    res.json({ message: "User deleted" });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, role } = req.body;
    const user = await User.findByIdAndUpdate(id, { name, email, mobile, role }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const createDoctor = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      name, email, mobile, password,
      assignHospitals = [],
      qualifications, experienceStart, bio, profilePic
    } = req.body;

    session.startTransaction();
    const exists = await User.findOne({ $or: [{ email }, { mobile }] }).session(session);
    if (exists) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Email or mobile already exists" });
    }
    const doctorId = "DOC" + Math.floor(100000 + Math.random() * 900000);
    const hashed = await bcrypt.hash(password, 10);
    const docUser = await User.create([{
      name,
      email,
      mobile,
      password: hashed,
      role: "doctor",
      doctorId,
      avatar: profilePic // Save profile pic to User model as well
    }], { session });

    const userId = docUser[0]._id;

    // Create DoctorProfile with additional fields
    // Aggregate specialties from all assigned hospitals
    const allSpecialties = assignHospitals.flatMap(h => h.specialties || []);

    const profileData = {
      user: userId,
      specialties: allSpecialties,
      qualifications: qualifications || [],
      experienceStart: experienceStart || null,
      bio: bio || "",
      profilePic: profilePic || ""
    };

    const profile = await DoctorProfile.create([profileData], { session });
    const profileId = profile[0]._id;

    let hosp;
    for (let h of assignHospitals) {
      if (mongoose.Types.ObjectId.isValid(h.hospitalId)) {
        hosp = await Hospital.findById(h.hospitalId).session(session);
      } else {
        hosp = await Hospital.findOne({ hospitalId: h.hospitalId }).session(session);
      }
      if (!hosp) continue;

      // Add to Hospital's doctors list
      hosp.doctors.push({
        doctor: profileId,
        specialties: h.specialties || [],
        consultationFee: h.consultationFee || null
      });

      // Add to DoctorProfile's hospitals list
      profile[0].hospitals.push({
        hospital: hosp._id,
        specialties: h.specialties || [],
        consultationFee: h.consultationFee || null
      });

      hosp.numberOfDoctors = hosp.doctors.length;
      await hosp.save({ session });
    }

    await profile[0].save({ session });
    await session.commitTransaction();

    const populated = await DoctorProfile.findById(profileId)
      .populate("user", "name email mobile doctorId")
      .populate("hospitals.hospital", "name address");

    res.status(201).json({ message: "Doctor created", doctor: populated });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

export const createHospital = async (req, res) => {
  try {
    const count = await Hospital.countDocuments();
    // Generate Hospital ID: HOSP + 4 digits (e.g., HOSP0001)
    req.body.hospitalId = "HOSP" + String(count + 1).padStart(4, "0");

    const hospital = await Hospital.create(req.body);
    res.status(201).json({ message: "Hospital created", hospital });
  } catch (err) {
    console.error("createHospital error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    if (!mobile) return res.status(400).json({ message: "Mobile is required" });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);
    const admin = await User.create({ name, email, mobile, password: hashed, role: "admin" });
    res.status(201).json({ message: "Admin created", admin });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const createHelpDesk = async (req, res) => {
  try {
    const { name, email, mobile, password, hospitalId } = req.body;

    if (!name || !email || !mobile || !password || !hospitalId) {
      return res.status(400).json({ message: "All fields including hospitalId are required" });
    }
    const existing = await HelpDesk.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    let hospital;

    if (mongoose.Types.ObjectId.isValid(hospitalId)) {
      hospital = await Hospital.findById(hospitalId);
    } else {
      hospital = await Hospital.findOne({ hospitalId }); // HOSP0001 format
    }

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found for given hospitalId" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const helpdesk = await HelpDesk.create({
      name,
      email,
      mobile,
      password: hashed,
      hospital: hospital._id
    });

    const populatedHelpdesk = await HelpDesk.findById(helpdesk._id)
      .populate("hospital", "name hospitalId address phone");

    res.status(201).json({
      message: "Help Desk created and assigned to hospital",
      helpdesk: populatedHelpdesk
    });

  } catch (err) {
    console.error("createHelpDesk error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const adminListHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find().limit(100);
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const adminPatchHospitalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const hospital = await Hospital.findByIdAndUpdate(id, { status }, { new: true });
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const assignDoctorToHospital = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { doctorProfileId, hospitalId, specialties = [], consultationFee } = req.body;
    session.startTransaction();
    let hospital;
    if (mongoose.Types.ObjectId.isValid(hospitalId)) {
      hospital = await Hospital.findById(hospitalId).session(session);
    } else {
      hospital = await Hospital.findOne({ hospitalId }).session(session);
    }

    if (!hospital) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Hospital not found" });
    }
    let doctor;
    if (mongoose.Types.ObjectId.isValid(doctorProfileId)) {
      doctor = await DoctorProfile.findById(doctorProfileId).session(session);
    } else {
      const docUser = await User.findOne({ doctorId: doctorProfileId, role: "doctor" }).session(session);
      if (!docUser) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Doctor not found" });
      }
      doctor = await DoctorProfile.findOne({ user: docUser._id }).session(session);
    }
    if (!doctor) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Doctor profile not found" });
    }
    if (hospital.doctors.some(d => d.doctor.toString() === doctor._id.toString())) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Doctor already assigned to this hospital" });
    }
    hospital.doctors.push({ doctor: doctor._id, specialties, consultationFee });
    doctor.hospitals.push({ hospital: hospital._id, specialties, consultationFee });
    hospital.numberOfDoctors = hospital.doctors.length;
    await hospital.save({ session });
    await doctor.save({ session });
    await session.commitTransaction();
    session.endSession();
    const populatedHospital = await Hospital.findById(hospital._id).populate({
      path: "doctors.doctor",
      populate: { path: "user", select: "name email mobile doctorId" }
    });
    res.status(201).json({ message: "Doctor assigned to hospital", hospital: populatedHospital });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const assignHelpdeskToHospital = async (req, res) => {
  const { helpdeskId, hospitalId } = req.body;

  const helpdesk = await HelpDesk.findById(helpdeskId);
  if (!helpdesk) return res.status(404).json({ message: "Helpdesk not found" });

  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) return res.status(404).json({ message: "Hospital not found" });

  helpdesk.hospital = hospital._id;
  await helpdesk.save();

  res.json({ message: "Helpdesk assigned to hospital", helpdesk });
};

export const removeDoctorFromHospital = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { hospitalId } = req.params;
    const { doctorProfileId } = req.body;

    session.startTransaction();

    const hospital = await Hospital.findById(hospitalId).session(session);
    const doctor = await DoctorProfile.findById(doctorProfileId).session(session);

    if (!hospital || !doctor) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      return res.status(404).json({ message: "Hospital or Doctor not found" });
    }

    // Remove doctor from hospital list
    hospital.doctors = hospital.doctors.filter(
      (d) => d.doctor.toString() !== doctorProfileId
    );

    // Remove hospital from doctor's list
    doctor.hospitals = doctor.hospitals.filter(
      (h) => h.hospital.toString() !== hospitalId
    );

    hospital.numberOfDoctors = hospital.doctors.length;

    await hospital.save({ session });
    await doctor.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Doctor removed from hospital", hospital });

  } catch (err) {

    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    session.endSession();

    res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

export const listDoctorsByHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findById(id).populate({
      path: "doctors.doctor",
      populate: { path: "user", select: "name email mobile doctorId role" }
    });
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    res.json(hospital.doctors);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getHospitalWithDoctors = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findById(id).populate({
      path: "doctors.doctor",
      populate: { path: "user", select: "name email mobile doctorId" }
    });
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const adminBroadcast = async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ message: "title and body required" });
  res.json({ message: "Broadcast message delivered to all users" });
};

export const adminBulkHospitals = async (req, res) => {
  const taskId = `task_${Date.now()}`;
  res.status(202).json({ taskId, message: "Bulk hospital upload placeholder" });
};

export const getAdminProfile = async (req, res) => {
  try {
    const admin = await User.findById(req.user._id).select("-password");
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    const { name, email, mobile } = req.body;

    if (name) admin.name = name;
    if (email) admin.email = email;
    if (mobile) admin.mobile = mobile;

    await admin.save();
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const adminDashboard = async (req, res) => {
  try {
    const totalDoctors = await User.countDocuments({ role: "doctor" });
    const totalPatients = await User.countDocuments({ role: "patient" });
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalHelpDesks = await HelpDesk.countDocuments();
    const totalHospitals = await Hospital.countDocuments();

    // Total users including HelpDesk staff
    const totalUsers = (await User.countDocuments()) + totalHelpDesks;

    res.json({
      totalUsers,
      totalDoctors,
      totalPatients,
      totalHospitals,
      totalAdmins,
      totalHelpDesks,
      recentRegistrations: await User.find().sort({ createdAt: -1 }).limit(5).select("name email role createdAt"),
      activityStats: await User.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().setDate(new Date().getDate() - 7))
            }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const adminGetAudits = async (req, res) => {
  res.json([{ message: "Audit logging not implemented yet" }]);
};