import Prescription from "../models/Prescription.js";

export const createPrescription = async (req, res) => {
    try {
        const { appointment, patient, medicines, diet_advice, suggested_tests, follow_up, avoid, signature, symptoms, matchedSymptoms, reason } = req.body;

        // Ensure doctor is taken from authenticated user
        const doctor = req.user._id;

        const newPrescription = new Prescription({
            appointment,
            patient,
            doctor,
            medicines,
            diet_advice,
            suggested_tests,
            follow_up,
            avoid,
            signature,
            symptoms,
            matchedSymptoms,
            reason
        });

        await newPrescription.save();

        await newPrescription.save();

        // Update appointment status to completed if appointment ID is provided
        if (appointment) {
            const Appointment = (await import("../models/Appointment.js")).default;
            const apptId = appointment._id || appointment;

            const updatedAppointment = await Appointment.findByIdAndUpdate(apptId, { status: "completed" });

            if (updatedAppointment) {
                // Create Notification only if appointment was found and updated
                const Notification = (await import("../models/Notification.js")).default;
                const { getIO } = await import("../socket/socket.js");

                const notifMsg = `Your appointment status is completed. Prescription generated.`;

                await Notification.create({
                    recipient: patient,
                    sender: doctor,
                    type: "appointment_completed",
                    message: notifMsg,
                    relatedId: updatedAppointment._id
                });

                // Emit Socket Event
                const io = getIO();
                io.to(patient.toString()).emit("notification:new", {
                    message: notifMsg,
                    type: "appointment_completed",
                    relatedId: updatedAppointment._id
                });
            }
        }

        res.status(201).json({ message: "Prescription saved successfully", prescription: newPrescription });
    } catch (err) {
        console.error("Create Prescription Error:", err);
        res.status(500).json({ message: "Failed to save prescription", error: err.message });
    }
};

export const getPrescriptions = async (req, res) => {
    try {
        const { role, id } = req.user; // Assuming auth middleware populates this
        let query = {};

        if (role === "doctor") {
            query.doctor = id; // Or user ID linked to doctor profile
        } else if (role === "patient") {
            query.patient = id;
        }

        const prescriptions = await Prescription.find(query)
            .populate("patient", "name age gender")
            .populate("doctor", "name email") // Populating name from User model
            .populate({
                path: "appointment",
                populate: {
                    path: "hospital",
                    select: "name address"
                }
            })
            .sort({ date: -1 })
            .lean(); // Use lean to allow modification

        // Fallback: Fetch hospital from DoctorProfile if not in appointment
        const DoctorProfile = (await import("../models/DoctorProfile.js")).default;
        const Hospital = (await import("../models/Hospital.js")).default;

        const populatedPrescriptions = await Promise.all(prescriptions.map(async (pres) => {
            // If doctor exists but no hospital via appointment
            if (pres.doctor && (!pres.appointment || !pres.appointment.hospital)) {
                const doctorProfile = await DoctorProfile.findOne({ user: pres.doctor._id }).populate("hospitals.hospital");
                if (doctorProfile) {
                    // Attach specialization
                    pres.doctor.specialization = doctorProfile.specialties?.[0] || "General Physician";

                    // Attach hospital (taking the first one as default)
                    if (doctorProfile.hospitals && doctorProfile.hospitals.length > 0) {
                        const hosp = doctorProfile.hospitals[0].hospital;
                        if (hosp) {
                            if (!pres.appointment) pres.appointment = {};
                            pres.appointment.hospital = {
                                name: hosp.name,
                                address: hosp.address
                            };
                        }
                    }
                }
            }
            return pres;
        }));

        res.json(populatedPrescriptions);
    } catch (err) {
        console.error("Get Prescriptions Error:", err);
        res.status(500).json({ message: "Failed to fetch prescriptions" });
    }
};

export const getPrescriptionById = async (req, res) => {
    try {
        let prescription = await Prescription.findById(req.params.id)
            .populate("patient", "name age gender mobile email")
            .populate("doctor", "name email")
            .populate({
                path: "appointment",
                populate: {
                    path: "hospital",
                    select: "name address phone email"
                }
            })
            .lean();

        if (!prescription) {
            return res.status(404).json({ message: "Prescription not found" });
        }

        // Fallback: Fetch hospital from DoctorProfile if not in appointment
        if (prescription.doctor && (!prescription.appointment || !prescription.appointment.hospital)) {
            const DoctorProfile = (await import("../models/DoctorProfile.js")).default;
            const doctorProfile = await DoctorProfile.findOne({ user: prescription.doctor._id }).populate("hospitals.hospital");

            if (doctorProfile) {
                // Attach specialization
                prescription.doctor.specialization = doctorProfile.specialties?.[0] || "General Physician";

                // Attach hospital
                if (doctorProfile.hospitals && doctorProfile.hospitals.length > 0) {
                    const hosp = doctorProfile.hospitals[0].hospital;
                    if (hosp) {
                        if (!prescription.appointment) prescription.appointment = {};
                        prescription.appointment.hospital = {
                            name: hosp.name,
                            address: hosp.address,
                            phone: hosp.phone,
                            email: hosp.email
                        };
                    }
                }
            }
        }

        res.json(prescription);
    } catch (err) {
        console.error("Get Prescription By ID Error:", err);
        res.status(500).json({ message: "Failed to fetch prescription details" });
    }
};

export const deletePrescription = async (req, res) => {
    try {
        const { id } = req.params;
        const prescription = await Prescription.findById(id);

        if (!prescription) {
            return res.status(404).json({ message: "Prescription not found" });
        }

        // Authorization check: Only the doctor who created it or the patient who owns it (optional) can delete?
        // Usually only doctors can delete. Patient might want to hide it?
        // Let's allow simple deletion for now based on role protection in route
        await Prescription.findByIdAndDelete(id);

        res.json({ message: "Prescription deleted successfully" });
    } catch (err) {
        console.error("Delete Prescription Error:", err);
        res.status(500).json({ message: "Failed to delete prescription" });
    }
};

export const deletePrescriptions = async (req, res) => {
    try {
        const { ids } = req.body; // Expecting an array of IDs

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "No prescriptions selected for deletion" });
        }

        const result = await Prescription.deleteMany({ _id: { $in: ids } });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "No prescriptions found to delete" });
        }

        res.json({ message: `${result.deletedCount} prescriptions deleted successfully` });
    } catch (err) {
        console.error("Bulk Delete Prescription Error:", err);
        res.status(500).json({ message: "Failed to delete prescriptions" });
    }
};
