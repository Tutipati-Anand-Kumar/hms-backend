import Appointment from "../models/Appointment.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
import PatientProfile from "../models/PatientProfile.js";
import HelpDesk from "../models/HelpDesk.js";
import Leave from "../models/Leave.js";
import { createNotification } from "./notificationController.js";
import { generateSlots, isHourBlockFull } from "../utils/slotUtils.js";

// --- BACKGROUND CLEANUP TASK (2 Minute Timeout) ---
export const startAppointmentCleanupTask = (io) => {
    // Check every 60 seconds
    setInterval(async () => {
        try {
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

            // Find pending appointments created > 2 mins ago (and not yet confirmed/rejected)
            // AND ensure they haven't been processed yet (you might want a flag, but if we delete, it's fine)
            const expiredAppointments = await Appointment.find({
                status: "pending",
                createdAt: { $lt: twoMinutesAgo }
            }).populate("patient");

            if (expiredAppointments.length > 0) {
                console.log(`Found ${expiredAppointments.length} expired pending appointments.`);
            }

            for (const app of expiredAppointments) {
                // DELETE
                await Appointment.findByIdAndDelete(app._id);

                // NOTIFY PATIENT
                if (app.patient) {
                    const message = "Doctor is not available";

                    // Create Notification Record
                    await createNotification({ user: { _id: "SYSTEM" } }, { // Mock req object
                        recipient: app.patient._id,
                        sender: app.doctor, // or System
                        type: "appointment_cancelled",
                        message: message,
                        relatedId: app._id // Note: ID might refer to deleted obj, but good for logs
                    });

                    // Emit Socket
                    io.to(`patient_${app.patient._id}`).emit("appointment_cancelled", {
                        appointmentId: app._id,
                        message: message
                    });
                }
            }
        } catch (err) {
            console.error("Error in appointment cleanup task:", err);
        }
    }, 60 * 1000);
};


// Book Appointment
export const bookAppointment = async (req, res) => {
    try {
        const { doctorId, hospitalId, date, timeSlot, symptoms, reason, type, urgency } = req.body;
        const patientId = req.user._id;

        // Validate Doctor & Hospital
        const doctor = await DoctorProfile.findById(doctorId).populate('user');
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        // Prevent Self-Booking
        if (doctor.user && doctor.user._id.toString() === patientId.toString()) {
            return res.status(400).json({ message: "You cannot book an appointment with yourself." });
        }

        // Fallback: If hospitalId is missing, use the doctor's first assigned hospital
        let targetHospitalId = hospitalId;
        if (!targetHospitalId && doctor.hospitals && doctor.hospitals.length > 0) {
            targetHospitalId = doctor.hospitals[0].hospital;
        }

        if (!targetHospitalId) {
            return res.status(400).json({ message: "Hospital ID is required and doctor has no assigned hospital." });
        }

        const hospital = await Hospital.findById(targetHospitalId);
        if (!hospital) return res.status(404).json({ message: "Hospital not found" });

        // Parse timeSlot
        // Scenario A: "12:00 AM - 12:05 AM" (Specific 5-min slot - Legacy/Direct)
        // Scenario B: "09:00 AM - 10:00 AM" (Hourly Block - New Logic)

        if (!timeSlot || !timeSlot.includes(" - ")) {
            return res.status(400).json({ message: "Invalid time slot format" });
        }

        let [reqStart, reqEnd] = timeSlot.split(" - ");
        let isHourlyBlock = false;

        // --- DYNAMIC AVAILABILITY CHECK ---
        // 1. Find doctor's availability for this hospital
        const hospitalRecord = doctor.hospitals.find(h => h.hospital.toString() === targetHospitalId.toString());
        if (!hospitalRecord) return res.status(400).json({ message: "Doctor not available at this hospital" });

        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

        // Try standard format first
        let availability = hospitalRecord.availability.find(a => a.days && a.days.includes(dayName));
        let startTimeVal, endTimeVal, breakStartVal, breakEndVal;

        if (availability) {
            startTimeVal = availability.startTime;
            endTimeVal = availability.endTime;
            breakStartVal = availability.breakStart;
            breakEndVal = availability.breakEnd;
        } else {
            // Fallback: Try legacy format (from doctorEdit.js)
            const legacyAvailability = hospitalRecord.availability.find(a => a.day === dayName);

            if (legacyAvailability && legacyAvailability.slots && legacyAvailability.slots.length > 0) {
                const slotStr = legacyAvailability.slots[0];
                const [start, end] = slotStr.split("-");

                const formatTime = (t) => {
                    const match = t.match(/(\d+)(AM|PM)/);
                    if (match) {
                        return `${match[1]}:00 ${match[2]}`;
                    }
                    return t;
                };

                startTimeVal = formatTime(start);
                endTimeVal = formatTime(end);
                breakStartVal = null;
                breakEndVal = null;

                availability = true;
            }
        }

        if (!availability) {
            return res.status(400).json({ message: `Doctor is not available on ${dayName}` });
        }

        // 2. Generate all valid slots for the day
        const validSlots = generateSlots(
            startTimeVal,
            endTimeVal,
            breakStartVal,
            breakEndVal
        );

        // Check if the requested timeSlot matches a specific 5-min slot
        let finalStartTime = reqStart;
        let finalEndTime = reqEnd;

        const exactMatch = validSlots.find(s => s.startTime === reqStart && s.endTime === reqEnd);

        if (!exactMatch) {
            // Assume it's an hourly block request (e.g. "9:00 AM - 10:00 AM")
            // Find all slots that fall WITHIN this hour

            // Parse request start hour
            const [t, m] = reqStart.split(" ");
            let [rh, rm] = t.split(":").map(Number);
            if (m === "PM" && rh < 12) rh += 12;
            if (m === "AM" && rh === 12) rh = 0;

            // Filter validSlots that start in this hour
            const slotsInHour = validSlots.filter(s => {
                const [st, sm] = s.startTime.split(" ");
                let [sh, smm] = st.split(":").map(Number);
                if (sm === "PM" && sh < 12) sh += 12;
                if (sm === "AM" && sh === 12) sh = 0;
                return sh === rh;
            });

            if (slotsInHour.length === 0) {
                return res.status(400).json({ message: "Invalid time slot or no slots available in this hour." });
            }

            // Find the first one that isn't booked
            const appointmentsInHour = await Appointment.find({
                doctor: doctorId,
                hospital: targetHospitalId,
                date: new Date(date),
                status: { $ne: "cancelled" }
            }).select("startTime");

            const bookedStarts = appointmentsInHour.map(a => a.startTime);

            const nextAvailable = slotsInHour.find(s => !bookedStarts.includes(s.startTime));

            if (!nextAvailable) {
                return res.status(400).json({ message: "Selected time block is full, please choose another slot." });
            }

            finalStartTime = nextAvailable.startTime;
            finalEndTime = nextAvailable.endTime;
            isHourlyBlock = true;
        }

        // 3. Final Check (Redundant if hourly logic worked, but good for safety)
        // Check exact slot availability
        const existing = await Appointment.findOne({
            doctor: doctorId,
            hospital: targetHospitalId,
            date: new Date(date),
            startTime: finalStartTime,
            status: { $ne: "cancelled" }
        });

        if (existing) {
            return res.status(400).json({ message: "Time slot already booked" });
        }

        // Use finalStartTime/finalEndTime for creation
        const startTime = finalStartTime;
        const endTime = finalEndTime;

        // MRN Logic
        const patientProfile = await PatientProfile.findOne({ user: patientId });
        let mrn = null;

        if (patientProfile) {
            // Check if MRN exists for this hospital
            const record = patientProfile.hospitalRecords.find(
                r => r.hospital.toString() === targetHospitalId.toString()
            );

            if (record) {
                mrn = record.mrn;
                // Update last visit
                record.lastVisit = new Date();
            } else {
                // Generate new MRN based on Hospital Name + Random + Year
                const initials = hospital.name.split(' ').map(n => n[0]).join('').toUpperCase();
                const randomNum = Math.floor(100 + Math.random() * 900); // 3 digit random
                const year = new Date().getFullYear();
                mrn = `${initials}${randomNum}${year}`;

                patientProfile.hospitalRecords.push({
                    hospital: targetHospitalId,
                    mrn: mrn,
                    lastVisit: new Date()
                });
            }
            await patientProfile.save();
        }

        const appointment = await Appointment.create({
            patient: patientId,
            doctor: doctorId,
            hospital: targetHospitalId,
            date: new Date(date),
            startTime,
            endTime,
            symptoms,
            reason,
            type,
            urgency: urgency || "non-urgent",
            mrn,
            status: "pending",
            patientDetails: req.body.patientDetails // Save Manual Age/Gender
        });

        // --- NOTIFICATIONS ---
        // 1. Notify Doctor
        if (doctor.user) {
            await createNotification(req, {
                recipient: doctor.user._id,
                sender: patientId,
                type: "appointment_request",
                message: `New appointment request from ${req.user.name} for ${date} at ${startTime} - ${endTime}`,
                relatedId: appointment._id
            });
            // Emit Socket Event
            if (req.io) {
                req.io.to(`doctor_${doctor.user._id}`).emit("notification:new", {
                    message: `New appointment request`,
                    appointmentId: appointment._id
                });
            }
        }

        // 2. Notify Helpdesk (New Requirement - Persistent + Socket)
        // Find all helpdesk users for this hospital
        const helpdeskUsers = await HelpDesk.find({ hospital: targetHospitalId });

        for (const hdUser of helpdeskUsers) {
            await createNotification(req, {
                recipient: hdUser._id,
                sender: patientId,
                type: "appointment_request",
                message: `New appointment request from ${req.user.name} for ${date} at ${startTime} - ${endTime}`,
                relatedId: appointment._id
            });
        }

        if (req.io) {
            req.io.to(`helpdesk_${targetHospitalId}`).emit("notification:new", {
                message: `New appointment pending approval`,
                appointmentId: appointment._id
            });
        }

        res.status(201).json({ message: "Appointment request sent", appointment });

    } catch (err) {
        console.error("Booking Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Check Availability (Dynamic 5-min slots -> Hourly Blocks)
export const checkAvailability = async (req, res) => {
    try {
        const { doctorId, hospitalId, date } = req.query;
        if (!doctorId || !hospitalId || !date) return res.status(400).json({ message: "Missing params" });

        const isHelpdesk = req.user.role === 'helpdesk' || req.user.role === 'admin';

        // 1. Fetch Doctor Profile
        const doctor = await DoctorProfile.findById(doctorId).populate('user');
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        // 1.1 Check for Approved Leave
        const queryDate = new Date(date);
        const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

        const leave = await Leave.findOne({
            doctorId: doctor.user._id,
            status: "approved",
            $or: [
                { startDate: { $lte: endOfDay }, endDate: { $gte: startOfDay } }
            ]
        });

        if (leave) {
            return res.json({
                availableSlots: [],
                bookedSlots: [],
                message: "Doctor is on leave",
                isLeave: true
            });
        }

        // 2. Find Availability for Hospital & Day
        const hospitalRecord = doctor.hospitals.find(h => h.hospital.toString() === hospitalId.toString());
        if (!hospitalRecord) return res.json({ availableSlots: [], bookedSlots: [] }); // Not assigned

        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

        // Try standard format first
        let availability = hospitalRecord.availability.find(a => a.days && a.days.includes(dayName));
        let startTimeVal, endTimeVal, breakStartVal, breakEndVal;

        if (availability) {
            startTimeVal = availability.startTime;
            endTimeVal = availability.endTime;
            breakStartVal = availability.breakStart;
            breakEndVal = availability.breakEnd;
        } else {
            // Fallback: Try legacy format
            const legacyAvailability = hospitalRecord.availability.find(a => a.day === dayName);
            if (legacyAvailability && legacyAvailability.slots && legacyAvailability.slots.length > 0) {
                const slotStr = legacyAvailability.slots[0];
                const [start, end] = slotStr.split("-");

                const formatTime = (t) => {
                    const match = t.match(/(\d+)(AM|PM)/);
                    if (match) {
                        return `${match[1]}:00 ${match[2]}`;
                    }
                    return t;
                };

                startTimeVal = formatTime(start);
                endTimeVal = formatTime(end);
                breakStartVal = null;
                breakEndVal = null;

                availability = true;
            }
        }

        if (!availability) return res.json({ availableSlots: [], bookedSlots: [] }); // Not available today

        // 3. Generate Slots
        const allSlots = generateSlots(
            startTimeVal,
            endTimeVal,
            breakStartVal,
            breakEndVal
        );

        // 4. Fetch Existing Bookings
        const appointments = await Appointment.find({
            doctor: doctorId,
            hospital: hospitalId,
            date: new Date(date),
            status: { $ne: "cancelled" }
        }).select("startTime endTime");

        const bookedStartTimes = appointments.map(a => a.startTime);

        // 5. Process Slots into Hourly Blocks
        const hourlyBlocks = [];
        const slotsByHour = {};

        // Group 5-min slots by hour
        allSlots.forEach(slot => {
            const [time, modifier] = slot.startTime.split(" ");
            let [h, m] = time.split(":").map(Number);
            // Normalize to 0-23 hour for sorting/grouping
            let hour24 = h;
            if (modifier === "PM" && h < 12) hour24 += 12;
            if (modifier === "AM" && h === 12) hour24 = 0;

            const hourKey = `${hour24}`; // Simple key
            if (!slotsByHour[hourKey]) {
                slotsByHour[hourKey] = {
                    hour24,
                    displayStart: `${h}:00 ${modifier}`,
                    displayEnd: `${h === 12 ? 1 : (h + 1 > 12 ? h + 1 - 12 : h + 1)}:00 ${modifier === "AM" && h === 11 ? "PM" : (modifier === "PM" && h === 11 ? "AM" : modifier)}`, // Simple next hour logic
                    slots: []
                };
            }
            slotsByHour[hourKey].slots.push(slot);
        });

        // Calculate booked count per hour (for Helpdesk extra info)
        const bookedCountByHour = {};
        appointments.forEach(app => {
            const [time, modifier] = app.startTime.split(" ");
            let [h, m] = time.split(":").map(Number);
            if (modifier === "PM" && h < 12) h += 12;
            if (modifier === "AM" && h === 12) h = 0;
            bookedCountByHour[h] = (bookedCountByHour[h] || 0) + 1;
        });

        // Process each hour block
        Object.values(slotsByHour).sort((a, b) => a.hour24 - b.hour24).forEach(block => {
            // Backend enforces max 10-12 appointments per hour
            const HOURLY_LIMIT = 12;
            const totalCapacity = Math.min(block.slots.length, HOURLY_LIMIT);

            // Count booked slots in this hour
            const bookedCount = block.slots.filter(slot => bookedStartTimes.includes(slot.startTime)).length;

            // Mark as full if booked count reaches limit OR all physical slots are taken
            const isFull = bookedCount >= totalCapacity;

            hourlyBlocks.push({
                timeSlot: `${block.displayStart} - ${block.displayEnd}`, // "9:00 AM - 10:00 AM"
                totalCapacity,
                bookedCount,
                isFull,
                availableCount: Math.max(0, totalCapacity - bookedCount)
            });
        });

        res.json({
            slots: hourlyBlocks, // Frontend expects "slots" array
            bookedCountByHour: isHelpdesk ? bookedCountByHour : undefined
        });

    } catch (err) {
        console.error("checkAvailability error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Helpdesk/Doctor: Confirm/Reject/Cancel Appointment
export const updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; // confirmed, rejected, cancelled

        if (!["confirmed", "rejected", "cancelled", "completed", "in-progress"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        if ((status === "rejected" || status === "cancelled") && !reason) {
            // Reason is optional for cancel but good to have. Enforce if you prefer.
            // For now, let's allow it to be optional if not strictly required, 
            // but user asked to pass a message, so we will expect one.
            // let's keep it lenient or enforcement based on previous logic?
            // Previous logic enforced it for rejected.
            // Let's enforce it if we want to ensure the message is sent.
            // But to be safe simply warn or allow empty.
            // However, user said "pass message...", so likely reason will be present.
        }

        const appointment = await Appointment.findByIdAndUpdate(id, {
            status: (status === "rejected" || status === "cancelled") ? "cancelled" : status,
        }, { new: true })
            .populate("doctor")
            .populate("hospital")
            .populate("patient");

        if (!appointment) return res.status(404).json({ message: "Appointment not found" });

        // --- NOTIFICATIONS ---
        const dateStr = new Date(appointment.date).toDateString();
        const timeSlotStr = `${appointment.startTime} - ${appointment.endTime}`;

        // --- NOTIFICATIONS ---
        // Notify Patient
        if (appointment.patient) {

            let msg = "";
            let notifType = "appointment_status_change";

            if (status === "confirmed") {
                msg = `Your appointment on ${dateStr} at ${timeSlotStr} has been confirmed.`;
                notifType = "appointment_confirmed";
            } else if (status === "completed") {
                msg = `Your appointment on ${dateStr} at ${timeSlotStr} is completed.`;
                notifType = "appointment_completed";
            } else {
                // Rejected or Cancelled
                msg = `Your appointment on ${dateStr} at ${timeSlotStr} was cancelled. ${reason ? `Reason: ${reason}` : ''}`;
                notifType = "appointment_cancelled";
            }

            await createNotification(req, {
                recipient: appointment.patient._id,
                sender: req.user._id, // Helpdesk/Admin/Doctor
                type: notifType,
                message: msg,
                relatedId: appointment._id
            });
            if (req.io) {
                req.io.to(`patient_${appointment.patient._id}`).emit("appointment:status_change", {
                    appointmentId: id,
                    status: "cancelled", // Normalized status
                    reason
                });
            }
        }

        // Notify Doctor
        const fullAppointment = await Appointment.findById(id).populate({
            path: 'doctor',
            populate: { path: 'user' }
        });

        if (fullAppointment && fullAppointment.doctor && fullAppointment.doctor.user) {
            const dateStr = new Date(appointment.date).toDateString();
            const timeSlotStr = `${appointment.startTime} - ${appointment.endTime}`;
            await createNotification(req, {
                recipient: fullAppointment.doctor.user._id,
                sender: req.user._id,
                type: "system_alert",
                message: `Appointment for ${fullAppointment.patient?.name || 'Patient'} on ${dateStr} at ${timeSlotStr} is ${status}`,
                relatedId: appointment._id
            });
            if (req.io) {
                req.io.to(`doctor_${fullAppointment.doctor.user._id}`).emit("appointment:update", {
                    appointmentId: id,
                    status: status === "rejected" ? "cancelled" : status
                });
            }
        }

        // Notify via Socket (Broadcast/General)
        if (req.io) {
            req.io.emit("appointment_status_changed", {
                appointmentId: id,
                status: status === "rejected" ? "cancelled" : status,
                doctorName: fullAppointment?.doctor?.user?.name || "Doctor",
                hospitalId: appointment.hospital?._id
            });

            // Send specific event with message for toast
            const targetRoom = `patient_${appointment.patient._id}`;
            if (status === "confirmed") {
                req.io.to(targetRoom).emit("appointment_confirmed", {
                    appointmentId: id,
                    message: `Your appointment on ${dateStr} at ${timeSlotStr} has been confirmed.`
                });
            } else if (status === "rejected" || status === "cancelled") {
                req.io.to(targetRoom).emit("appointment_cancelled", {
                    appointmentId: id,
                    message: `Your appointment on ${dateStr} at ${timeSlotStr} was cancelled. ${reason ? `Reason: ${reason}` : ''}`
                });
            }
        }

        res.json({ message: `Appointment ${status}`, appointment });
    } catch (err) {
        console.error("Update Status Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Get Appointments (For Patient, Doctor, Helpdesk)
export const getAppointments = async (req, res) => {
    try {
        const { role, _id } = req.user;
        let query = {};

        if (role === "patient") {
            query.patient = _id;
        } else if (role === "doctor") {
            // Find doctor profile first
            const docProfile = await DoctorProfile.findOne({ user: _id });
            if (docProfile) {
                query.doctor = docProfile._id;

                // Doctor: Show only upcoming appointments (Today onwards)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                query.date = { $gte: today };
            }
        } else if (role === "helpdesk") {
            // Helpdesk sees appointments for their hospital
            if (req.user.hospital) {
                query.hospital = req.user.hospital;
            } else {
                return res.json([]);
            }
        }

        let appointments = await Appointment.find(query)
            .populate("patient", "name mobile email") // Only User fields available here
            .populate({
                path: "doctor",
                populate: { path: "user", select: "name" }
            })
            .populate("hospital", "name address")
            .sort({ date: 1, startTime: 1 }) // Sort by date ascending (earliest first)
            .lean(); // Use lean to allow modification

        // Manually populate PatientProfile details (age, gender, mrn)
        const enrichedAppointments = await Promise.all(appointments.map(async (app) => {
            // Reconstruct timeSlot for frontend compatibility
            app.timeSlot = `${app.startTime} - ${app.endTime}`;

            if (app.patient) {
                const profile = await PatientProfile.findOne({ user: app.patient._id });
                if (profile) {
                    // Prefer manual patientDetails (from AI Symptom Checker) if available
                    if (app.patientDetails && app.patientDetails.name) {
                        app.patient.name = app.patientDetails.name;
                    }

                    if (app.patientDetails && app.patientDetails.age) {
                        app.patient.age = app.patientDetails.age;
                    } else {
                        app.patient.age = profile.age;
                    }

                    if (app.patientDetails && app.patientDetails.gender) {
                        app.patient.gender = app.patientDetails.gender;
                    } else {
                        app.patient.gender = profile.gender;
                    }

                    // Find MRN for this hospital if available, or use generic
                    const record = profile.hospitalRecords?.find(r => r.hospital?.toString() === app.hospital?._id?.toString());
                    app.patient.mrn = record ? record.mrn : (app.mrn || "N/A");
                }
            }
            return app;
        }));

        res.json(enrichedAppointments);

    } catch (err) {
        console.error("Error fetching appointments:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const getHospitalAppointmentStats = async (req, res) => {
    try {
        const { hospitalId, date, range } = req.query;

        if (!hospitalId || !date) {
            return res.status(400).json({ message: "Hospital ID and date are required" });
        }

        const selectedDate = new Date(date);

        // --- WEEKLY OR RANGE STATS ---
        if (range === 'week') {
            // Calculate last 7 days including selected date
            const endDate = new Date(selectedDate);
            endDate.setHours(23, 59, 59, 999);

            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);

            const appointments = await Appointment.find({
                hospital: hospitalId,
                date: { $gte: startDate, $lte: endDate },
                status: { $ne: "cancelled" } // Include pending and completed
            })
                .populate("doctor", "name")
                .populate("patient", "name") // minimal populate for speed
                .populate({
                    path: "doctor",
                    populate: { path: "user", select: "name" }
                })
                .lean();

            // 1. Daily Stats (for Line Chart)
            const dailyStatsMap = {};
            // Initialize last 7 days with 0
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                dailyStatsMap[dateStr] = 0;
            }

            // 2. Doctor Stats (for Top Doctors)
            const doctorStatsMap = {};

            appointments.forEach(app => {
                const appDate = new Date(app.date).toISOString().split('T')[0];
                if (dailyStatsMap[appDate] !== undefined) {
                    dailyStatsMap[appDate]++;
                } else {
                    dailyStatsMap[appDate] = 1;
                }

                const docName = app.doctor?.user?.name || "Unknown Doctor";
                doctorStatsMap[docName] = (doctorStatsMap[docName] || 0) + 1;
            });

            // Format Daily Stats
            const dailyStats = Object.keys(dailyStatsMap).sort().map(dateStr => ({
                date: dateStr,
                count: dailyStatsMap[dateStr]
            }));

            // Format Top Doctors
            const topDoctors = Object.entries(doctorStatsMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5); // Top 5

            return res.json({
                period: 'week',
                totalPatients: appointments.length,
                dailyStats,
                topDoctors
            });
        }

        // --- ORIGINAL HOURLY STATS (Day View) ---
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const appointments = await Appointment.find({
            hospital: hospitalId,
            date: {
                $gte: startOfDay,
                $lte: endOfDay
            },
            status: { $ne: "cancelled" }
        })
            .populate("patient", "name mobile age gender")
            .populate({
                path: "doctor",
                populate: {
                    path: "user",
                    select: "name"
                }
            })
            .lean();

        const hourlyStats = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            count: 0,
            appointments: []
        }));

        for (const app of appointments) {
            if (!app.startTime) continue;

            const [time, modifier] = app.startTime.split(' ');
            let [hours, minutes] = time.split(':').map(Number);

            if (modifier === 'PM' && hours !== 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;

            if (hours >= 0 && hours < 24) {
                hourlyStats[hours].count++;

                hourlyStats[hours].appointments.push({
                    _id: app._id,
                    patient: app.patient,
                    patientDetails: app.patientDetails, // Include manual details
                    doctorName: app.doctor?.user?.name || "Unknown Doctor",
                    timeSlot: `${app.startTime} - ${app.endTime}`,
                    reason: app.reason,
                    urgency: app.urgency,
                    status: app.status
                });
            }
        }

        res.json(hourlyStats);

    } catch (err) {
        console.error("Error fetching hospital stats:", err);
        res.status(500).json({ message: "Server error" });
    }
};