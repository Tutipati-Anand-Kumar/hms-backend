import DoctorProfile from "../models/DoctorProfile.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import PatientProfile from "../models/PatientProfile.js";
import Appointment from "../models/Appointment.js";
import Prescription from "../models/Prescription.js";
import Report from "../models/Report.js";
import Leave from "../models/Leave.js";
import cloudinary from "../config/cloudinary.js";

export const getDoctorProfile = async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ message: "Unauthorized" });

    const profile = await DoctorProfile.findOne({ user: req.user._id })
      .populate({ path: "user", select: "name email mobile doctorId" })
      .populate({ path: "hospitals.hospital", select: "name address phone email hospitalId" });

    if (!profile) return res.status(404).json({ message: "Doctor profile not found" });
    res.json(profile);
  } catch (err) {
    console.error("getDoctorProfile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateDoctorProfile = async (req, res) => {
  try {
    let profile = await DoctorProfile.findOne({ user: req.user._id });

    // UPSERT: Create profile if it doesn't exist
    if (!profile) {
      profile = new DoctorProfile({
        user: req.user._id,
        hospitals: [], // Initialize empty
        // Add defaults if needed
      });
    }

    // 1. Update Generic Profile Fields
    if (req.body.bio) profile.bio = req.body.bio;
    if (req.body.specialties) profile.specialties = req.body.specialties;
    if (req.body.qualifications) profile.qualifications = req.body.qualifications;
    if (req.body.experienceStart) profile.experienceStart = req.body.experienceStart;
    if (req.body.profilePic) profile.profilePic = req.body.profilePic;
    if (req.body.signature) profile.signature = req.body.signature;

    // Handle Quick Notes (sanitized)
    if (req.body.quickNotes) {
      profile.quickNotes = req.body.quickNotes.filter(n => n.text && n.text.trim() !== "");
    }

    // 2. Update Hospital-Specific Fields (if provided)
    if (req.body.hospitalId) {
      const hospitalIndex = profile.hospitals.findIndex(
        h => h.hospital.toString() === req.body.hospitalId
      );

      if (hospitalIndex > -1) {
        if (req.body.availability) {
          profile.hospitals[hospitalIndex].availability = req.body.availability;
        }
        if (req.body.consultationFee) {
          profile.hospitals[hospitalIndex].consultationFee = req.body.consultationFee;
        }
      } else {
        // Optional: Handle case where doctor tries to update a hospital they aren't linked to
        // For now, we just log or ignore, or potentially add them (logic depends on your requirements)
        console.warn(`Doctor ${req.user._id} tried to update unconnected hospital ${req.body.hospitalId}`);
      }
    }

    // 3. Save Changes
    await profile.save();

    // 4. Update User Model (Avatar, Name, Mobile, Email)
    const userUpdates = {};
    if (req.body.profilePic) userUpdates.avatar = req.body.profilePic;
    if (req.body.name) userUpdates.name = req.body.name;
    if (req.body.mobile) userUpdates.mobile = req.body.mobile;
    if (req.body.email) userUpdates.email = req.body.email;

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(req.user._id, userUpdates);
    }

    // 5. Return Updated Profile
    const updatedProfile = await DoctorProfile.findById(profile._id)
      .populate("user", "name email role doctorId")
      .populate({ path: "hospitals.hospital", select: "name address hospitalId" });

    res.json(updatedProfile);

  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern && err.keyPattern.mobile) {
        return res.status(400).json({ message: "This phone number is already registered with another user. Please select another phone number." });
      }
      return res.status(400).json({ message: "Duplicate field value entered" });
    }
    console.error("updateDoctorProfile error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

export const searchDoctors = async (req, res) => {
  try {
    const { speciality } = req.query;
    const filter = {};
    if (speciality) filter.specialties = speciality;

    const docs = await DoctorProfile.find(filter)
      .populate({ path: "user", select: "name email mobile doctorId" })
      .populate({ path: "hospitals.hospital", select: "name address hospitalId" });

    res.json(docs);
  } catch (err) {
    console.error("searchDoctors error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getDoctorById = async (req, res) => {
  try {
    let userId = req.params.id;
    if (userId === "me") {
      if (!req.user || !req.user._id) return res.status(401).json({ message: "Unauthorized" });
      userId = req.user._id;
    }

    let profile;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      profile = await DoctorProfile.findOne({ user: userId })
        .populate({ path: "user", select: "name email mobile doctorId" })
        .populate({ path: "hospitals.hospital", select: "name address hospitalId" });
    } else {
      const user = await User.findOne({ doctorId: userId, role: "doctor" });
      if (!user) return res.status(404).json({ message: "Doctor not found" });
      profile = await DoctorProfile.findOne({ user: user._id })
        .populate({ path: "user", select: "name email mobile doctorId" })
        .populate({ path: "hospitals.hospital", select: "name address hospitalId" });
    }

    if (!profile) return res.status(404).json({ message: "Doctor profile not found" });
    res.json(profile);
  } catch (err) {
    console.error("getDoctorById error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPatientDetails = async (req, res) => {
  try {
    const { patientId } = req.params;
    const callingUserId = req.user._id;
    const isAdmin = ["admin", "super-admin"].includes(req.user.role);

    let doctorHospitalIds = [];

    if (!isAdmin) {
      // 0. Fetch Requesting Doctor's Profile to get their Hospitals
      const doctorProfile = await DoctorProfile.findOne({ user: callingUserId });
      if (!doctorProfile) {
        return res.status(403).json({ message: "Access denied: Not a doctor" });
      }
      // Extract IDs of hospitals the doctor is associated with
      doctorHospitalIds = doctorProfile.hospitals.map(h => h.hospital.toString());
    }

    // 1. Fetch Patient Profile (includes User details)
    const patientProfile = await PatientProfile.findOne({ user: patientId })
      .populate("user", "name email mobile");

    if (!patientProfile) {
      return res.status(404).json({ message: "Patient profile not found" });
    }

    // 2. Fetch Appointments History (FILTERED)
    const appointmentFilter = { patient: patientId };
    if (!isAdmin) {
      appointmentFilter.hospital = { $in: doctorHospitalIds };
    }

    const appointments = await Appointment.find(appointmentFilter)
      .populate("doctor", "name") // Doctor is now User ref
      .sort({ date: -1 });

    // 3. Fetch Prescriptions (FILTERED)
    const allPrescriptions = await Prescription.find({ patient: patientId })
      .populate("doctor", "name")
      .populate("appointment") // Need appointment to check hospital
      .sort({ createdAt: -1 });

    let prescriptions = allPrescriptions;

    if (!isAdmin) {
      // Filter in memory because of deep population check
      prescriptions = allPrescriptions.filter(pres => {
        // 1. If linked to an appointment at one of my hospitals -> SHOW
        if (pres.appointment && pres.appointment.hospital && doctorHospitalIds.includes(pres.appointment.hospital.toString())) {
          return true;
        }
        // 2. If I wrote it (even if unlinked or different hospital logic?) -> SHOW
        if (pres.doctor && pres.doctor._id.toString() === callingUserId.toString()) {
          return true;
        }
        // Hide otherwise
        return false;
      });
    }

    // 4. Fetch Reports (FILTERED)
    // We populate 'appointment' to check its hospital if report.hospital is missing
    const allReports = await Report.find({ patient: patientId })
      .populate("appointment")
      .sort({ date: -1 });

    let reports = allReports;

    if (!isAdmin) {
      reports = allReports.filter(rep => {
        // 1. Check Explicit Hospital Field
        if (rep.hospital) {
          return doctorHospitalIds.includes(rep.hospital.toString());
        }
        // 2. Check Linked Appointment Hospital
        if (rep.appointment && rep.appointment.hospital) {
          return doctorHospitalIds.includes(rep.appointment.hospital.toString());
        }
        // 3. If NO hospital info linked, assume it's a general patient report -> SHOW
        return true;
      });
    }

    // 5. Construct Response
    const responseData = {
      personal: {
        _id: patientProfile.user._id,
        name: patientProfile.user.name,
        email: patientProfile.user.email,
        mobile: patientProfile.user.mobile,
        dob: patientProfile.dob,
        age: patientProfile.age, // Virtual
        gender: patientProfile.gender,
        address: patientProfile.address,
      },
      health: {
        conditions: patientProfile.conditions,
        allergies: patientProfile.allergies,
        medicalHistory: patientProfile.medicalHistory,
        medications: patientProfile.medications,
      },
      history: appointments.map(app => ({
        _id: app._id,
        date: app.date,
        reason: app.reason,
        symptoms: app.symptoms,
        doctorName: app.doctor?.name,
        status: app.status,
      })),
      prescriptions: prescriptions.map(pres => ({
        _id: pres._id,
        date: pres.createdAt,
        doctorName: pres.doctor?.name,
        medicines: pres.medicines,
        notes: pres.notes
      })),
      reports: reports.map(rep => ({
        _id: rep._id,
        name: rep.name,
        url: rep.url,
        type: rep.type,
        date: rep.date
      }))
    };

    res.json(responseData);

  } catch (err) {
    console.error("getPatientDetails error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload to Cloudinary using stream (since we have buffer from memory storage)
    const runUpload = () => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "doctors" }, // Optional: organize in a folder
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
    };

    const result = await runUpload();

    // Return the secure URL
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
};

export const startNextAppointment = async (req, res) => {
  try {
    const doctorId = req.user._id; // User ID of the doctor

    // Find the doctor profile to get the DoctorProfile ID if needed
    const doctorProfile = await DoctorProfile.findOne({ user: doctorId });
    if (!doctorProfile) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    // 1. Mark any currently "in-progress" appointment as "completed"
    await Appointment.updateMany(
      { doctor: doctorProfile._id, status: "in-progress" },
      { $set: { status: "completed" } }
    );

    // 2. Find the next "confirmed" appointment for today and mark it as "in-progress"
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const nextAppointment = await Appointment.findOneAndUpdate(
      {
        doctor: doctorProfile._id,
        status: "confirmed",
        date: { $gte: startOfDay, $lte: endOfDay }
      },
      { $set: { status: "in-progress" } },
      { new: true, sort: { date: 1 } } // Sort by date ascending (earliest first)
    ).populate("patient", "name email mobile");

    if (!nextAppointment) {
      return res.status(200).json({ message: "No more confirmed appointments for today" });
    }

    res.status(200).json({
      message: "Next appointment started",
      appointment: nextAppointment
    });

  } catch (err) {
    console.error("startNextAppointment error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getDoctorCalendarStats = async (req, res) => {
  try {
    const { month, year, view, startDate: queryStartDate, doctorId } = req.query;

    // 1. Get Doctor Profile ID
    let targetUserId = req.user._id;
    if (doctorId && doctorId !== "undefined") {
      targetUserId = doctorId;
    }

    const doctorProfile = await DoctorProfile.findOne({ user: targetUserId });
    if (!doctorProfile) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    // --- WEEKLY VIEW LOGIC ---
    if (view === "weekly") {
      if (!queryStartDate) {
        return res.status(400).json({ message: "startDate is required for weekly view" });
      }

      const start = new Date(queryStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // 7 days total
      end.setHours(23, 59, 59, 999);

      // Fetch appointments for the week
      const appointments = await Appointment.find({
        doctor: doctorProfile._id,
        date: { $gte: start, $lte: end },
        status: { $ne: "cancelled" }
      });

      // 1. Determine Dynamic Start/End Hours from Availability
      let minHour = 9; // Default 9 AM
      let maxHour = 21; // Default 9 PM

      if (doctorProfile.hospitals && doctorProfile.hospitals.length > 0) {
        let foundAvailability = false;
        let earliest = 24;
        let latest = 0;

        doctorProfile.hospitals.forEach(h => {
          h.availability.forEach(a => {
            const parseTime = (timeStr) => {
              if (!timeStr) return null;
              // Normalize: remove spaces, lowercase
              const normalized = timeStr.replace(/\s+/g, '').toLowerCase();
              const match = normalized.match(/(\d+):?(\d+)?(am|pm)/);
              if (!match) return null;
              let hours = parseInt(match[1]);
              const minutes = match[2] ? parseInt(match[2]) : 0;
              const ampm = match[3];

              if (ampm === "pm" && hours < 12) hours += 12;
              if (ampm === "am" && hours === 12) hours = 0;
              return { hours, minutes };
            };

            // Check Standard Format
            if (a.startTime && a.endTime) {
              const start = parseTime(a.startTime);
              const end = parseTime(a.endTime);

              if (start && end) {
                if (start.hours < earliest) earliest = start.hours;
                if (end.hours > latest) latest = end.hours;
                // If end minutes > 0, round up to next hour?
                if (end.minutes > 0 && end.hours >= latest) latest = end.hours + 1;
                foundAvailability = true;
              }
            }
            // Check Legacy Format
            if (a.slots && a.slots.length > 0) {
              const [s, e] = a.slots[0].split("-");
              const parseLegacy = (t) => {
                const p = parseTime(t);
                return p ? p.hours : 0;
              };
              const sh = parseLegacy(s);
              const eh = parseLegacy(e);
              if (sh < earliest) earliest = sh;
              if (eh > latest) latest = eh;
              foundAvailability = true;
            }
          });
        });

        if (foundAvailability) {
          minHour = earliest;
          maxHour = latest;
        }
      }

      // Generate Hourly Range Slots
      const timeSlots = [];
      for (let h = minHour; h < maxHour; h++) {
        const startH = h;
        const endH = h + 1;

        const formatH = (hour) => {
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const h12 = hour % 12 || 12;
          return `${h12}:00 ${ampm}`; // "9:00 AM"
        };

        timeSlots.push(`${formatH(startH)} - ${formatH(endH)}`);
      }

      const days = [];
      const current = new Date(start);
      for (let i = 0; i < 7; i++) {
        days.push({
          date: new Date(current),
          dayName: current.toLocaleDateString('en-US', { weekday: 'long' }),
          slots: {},
          dailyTotal: 0
        });
        current.setDate(current.getDate() + 1);
      }

      // Initialize Weekly Totals per slot
      const weeklyTotals = {};
      timeSlots.forEach(slot => weeklyTotals[slot] = 0);
      let grandTotal = 0;
      const HOURLY_LIMIT = 12;

      // Fetch Approved Leaves for the week
      const leaves = await Leave.find({
        doctorId: doctorProfile.user, // Leave uses User ID
        status: "approved",
        $or: [
          { startDate: { $lte: end }, endDate: { $gte: start } }
        ]
      });

      // Populate Grid
      appointments.forEach(app => {
        const appDate = new Date(app.date);
        const appDateStr = appDate.toDateString();

        // Find the day in our grid
        const dayObj = days.find(d => d.date.toDateString() === appDateStr);
        if (dayObj) {
          // Determine Time Slot from startTime string (e.g. "10:00 AM")
          // Use robust parser
          const parseTime = (timeStr) => {
            if (!timeStr) return { hours: 0 };
            const normalized = timeStr.replace(/\s+/g, '').toLowerCase();
            const match = normalized.match(/(\d+):?(\d+)?(am|pm)/);
            if (!match) return { hours: 0 };
            let hours = parseInt(match[1]);
            const minutes = match[2] ? parseInt(match[2]) : 0;
            if (hours === 12) {
              if (match[3] === "am") hours = 0;
            } else if (match[3] === "pm") {
              hours += 12;
            }
            return { hours, minutes };
          };

          const time = parseTime(app.startTime);
          const h = time.hours;
          const formatH = (hour) => {
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const h12 = hour % 12 || 12;
            return `${h12}:00 ${ampm}`;
          };
          // Reconstruct slot string to match timeSlots key
          const slotStartStr = `${formatH(h)}`;

          const matchingSlot = timeSlots.find(s => s.startsWith(slotStartStr));

          if (matchingSlot) {
            // Initialize slot if not exists
            if (!dayObj.slots[matchingSlot]) dayObj.slots[matchingSlot] = { count: 0, isFull: false };

            // Increment Slot Count
            dayObj.slots[matchingSlot].count++;

            // Check Limit
            if (dayObj.slots[matchingSlot].count >= HOURLY_LIMIT) {
              dayObj.slots[matchingSlot].isFull = true;
            }

            // Increment Daily Total
            dayObj.dailyTotal++;

            // Increment Weekly Slot Total
            weeklyTotals[matchingSlot]++;

            // Increment Grand Total
            grandTotal++;
          }
        }
      });

      // Mark Leaves in Grid
      leaves.forEach(leave => {
        let current = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);

        while (current <= leaveEnd) {
          const dateStr = current.toDateString();
          const dayObj = days.find(d => d.date.toDateString() === dateStr);

          if (dayObj) {
            dayObj.isLeave = true;
            // Optionally clear slots or mark them as unavailable
            timeSlots.forEach(slot => {
              dayObj.slots[slot] = { count: 0, isFull: true, isLeave: true };
            });
          }
          current.setDate(current.getDate() + 1);
        }
      });

      // Mark Breaks in Grid (New Logic)
      days.forEach(day => {
        if (day.isLeave) return; // Skip if already on leave

        // Find availability for this day
        // Assuming we look at the first hospital or merge? Let's take the first matching availability.
        let dayAvailability = null;
        if (doctorProfile.hospitals) {
          for (const h of doctorProfile.hospitals) {
            const avail = h.availability.find(a => a.days && a.days.includes(day.dayName));
            // Try legacy as well?
            const legacyAvail = h.availability.find(a => a.day === day.dayName);
            if (avail) { dayAvailability = avail; break; }
            if (legacyAvail) { dayAvailability = legacyAvail; break; }
          }
        }

        if (dayAvailability) {
          // Parse breakStart and breakEnd
          const parseTimeVal = (t) => {
            if (!t) return null;
            const normalized = t.replace(/\s+/g, '').toLowerCase();
            const match = normalized.match(/(\d+):?(\d+)?(am|pm)/);
            if (!match) return null;
            let h = parseInt(match[1]);
            if (h === 12) {
              if (match[3] === "am") h = 0;
            } else if (match[3] === "pm") {
              h += 12;
            }
            return h; // Return just hour for simplicity of hourly blocks
          };

          // Check for standard break fields
          if (dayAvailability.breakStart && dayAvailability.breakEnd) {
            const bStart = parseTimeVal(dayAvailability.breakStart);
            const bEnd = parseTimeVal(dayAvailability.breakEnd);

            if (bStart !== null && bEnd !== null) {
              // Iterate slots and mark if within break
              timeSlots.forEach(slot => {
                // slot is "1:00 PM - 2:00 PM"
                const [sStart, sEnd] = slot.split(" - ");
                const slotStartHour = parseTimeVal(sStart);

                // If the slot START is >= Break Start AND < Break End, it's a break slot
                // Example: Break 1PM-2PM. Slot 1PM-2PM. slotStart=13, bStart=13, bEnd=14. 13 >= 13 && 13 < 14. TRUE.
                if (slotStartHour !== null && slotStartHour >= bStart && slotStartHour < bEnd) {
                  if (!day.slots[slot]) day.slots[slot] = { count: 0, isFull: false };
                  day.slots[slot].isBreak = true;
                }
              });
            }
          }
        }
      });

      // Fill missing slots with 0
      days.forEach(day => {
        timeSlots.forEach(slot => {
          if (!day.slots[slot]) {
            day.slots[slot] = { count: 0, isFull: false };
          }
        });
      });

      return res.json({
        timeSlots,
        days,
        weeklyTotals: { ...weeklyTotals, total: grandTotal }
      });
    }

    // --- EXISTING MONTHLY LOGIC ---
    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // 2. Aggregate Appointments Count
    const appointments = await Appointment.aggregate([
      {
        $match: {
          doctor: doctorProfile._id,
          date: { $gte: startDate, $lte: endDate },
          status: { $ne: "cancelled" }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 }
        }
      }
    ]);

    // 3. Fetch Approved Leaves
    const leaves = await Leave.find({
      doctorId: doctorProfile.user, // Leave uses User ID
      status: "approved",
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
      ]
    });

    // 4. Transform Data
    const stats = {};
    appointments.forEach(app => {
      stats[app._id] = { count: app.count, isLeave: false };
    });

    // Mark leaves
    leaves.forEach(leave => {
      let current = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      while (current <= end) {
        if (current >= startDate && current <= endDate) {
          const dateStr = current.toISOString().split('T')[0];
          if (!stats[dateStr]) {
            stats[dateStr] = { count: 0, isLeave: true };
          } else {
            stats[dateStr].isLeave = true;
          }
        }
        current.setDate(current.getDate() + 1);
      }
    });

    res.json(stats);

  } catch (err) {
    console.error("getDoctorCalendarStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getDoctorAppointmentsByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const doctorProfile = await DoctorProfile.findOne({ user: req.user._id });
    if (!doctorProfile) return res.status(404).json({ message: "Doctor profile not found" });

    const searchDate = new Date(date);
    const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

    const appointments = await Appointment.find({
      doctor: doctorProfile._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: "cancelled" }
    })
      .populate({
        path: "patient",
        select: "name email mobile" // Patient is User ref
      })
      .populate("hospital", "name address")
      .sort({ date: 1 }); // Sort by time

    res.json(appointments);

  } catch (err) {
    console.error("getDoctorAppointmentsByDate error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const addQuickNote = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Note text is required" });

    const profile = await DoctorProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        $push: {
          quickNotes: {
            text,
            timestamp: new Date()
          }
        }
      },
      { new: true }

    );

    if (!profile) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    // Return the newly added note (last element)
    const newNote = profile.quickNotes[profile.quickNotes.length - 1];
    res.status(201).json(newNote);

  } catch (err) {
    console.error("addQuickNote error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getQuickNotes = async (req, res) => {
  try {
    const profile = await DoctorProfile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }
    // Return array, sorted by timestamp desc
    const notes = profile.quickNotes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(notes);
  } catch (err) {
    console.error("getQuickNotes error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteQuickNote = async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await DoctorProfile.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { quickNotes: { _id: id } } },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    res.json({ message: "Note deleted" });
  } catch (err) {
    console.error("deleteQuickNote error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getDoctorPatients = async (req, res) => {
  try {
    const userId = req.user._id;
    // console.log(`[getDoctorPatients] Requesting for User ID: ${userId}`);

    // 1. Find the Doctor Profile to get the correct Doctor ID for Appointments
    const doctorProfile = await DoctorProfile.findOne({ user: userId });

    if (!doctorProfile) {
      // console.warn(`[getDoctorPatients] No Doctor Profile found for User ID: ${userId}`);
      // If no profile, they can't have appointments as a doctor
      return res.json([]);
    }

    const doctorProfileId = doctorProfile._id;
    // console.log(`[getDoctorPatients] Found DoctorProfile ID: ${doctorProfileId}`);

    // 2. Find ALL appointments for this doctor, sorted by date DESC (latest first)
    // We populate 'hospital' to ensure we have the ID to match against records if needed (though ID reference is enough)
    const appointments = await Appointment.find({ doctor: doctorProfileId })
      .sort({ date: -1, createdAt: -1 })
      .select("patient hospital reason date");

    if (appointments.length === 0) {
      return res.json([]);
    }

    // 3. Create a Map of "PatientID -> Latest Appointment"
    // Since we sorted by date DESC, the first time we see a patient is their latest appointment.
    const latestAppointmentMap = new Map();
    const uniquePatientIds = [];

    for (const app of appointments) {
      const pId = app.patient.toString();
      if (!latestAppointmentMap.has(pId)) {
        latestAppointmentMap.set(pId, app);
        uniquePatientIds.push(pId);
      }
    }

    // console.log(`[getDoctorPatients] Found ${uniquePatientIds.length} unique patients`);

    // 4. Fetch Patient Profiles (containing hospitalRecords/MRN) AND User details
    const profiles = await PatientProfile.find({ user: { $in: uniquePatientIds } })
      .populate("user", "name mobile email");

    // console.log(`[getDoctorPatients] Found ${profiles.length} Patient Profiles`);

    // 5. Map to simple structure using the specific appointment data
    const patients = profiles.map(profile => {
      const pId = profile.user?._id?.toString();
      const latestApp = latestAppointmentMap.get(pId);

      let relevantMrn = "N/A";

      // Filter MRN based on the Hospital ID from the latest appointment
      if (latestApp && profile.hospitalRecords?.length > 0) {
        const appHospitalId = latestApp.hospital.toString();

        // Find record matching the hospital
        const record = profile.hospitalRecords.find(r => r.hospital.toString() === appHospitalId);

        if (record) {
          relevantMrn = record.mrn;
        } else {
          // Fallback: If no specific match, show "No Record" for this specific hospital context
          relevantMrn = "No Record";
        }
      }

      // Reason logic
      const lastReason = latestApp?.reason || "No";

      return {
        _id: profile.user?._id,
        name: profile.user?.name || "Unknown",
        mobile: profile.user?.mobile || "N/A",
        email: profile.user?.email || "N/A",
        mrn: relevantMrn,
        reason: lastReason
      };
    });

    res.json(patients);

  } catch (err) {
    console.error("getDoctorPatients error:", err);
    res.status(500).json({ message: "Failed to fetch patients" });
  }
};