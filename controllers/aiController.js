import dotenv from "dotenv";
import fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load fallback data
const loadFallbackData = () => {
    try {
        const dataPath = path.join(__dirname, "../data/medicine.json");
        const data = fs.readFileSync(dataPath, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        console.error("Error loading fallback data:", err);
        return { symptoms_data: [] };
    }
};

import DoctorProfile from "../models/DoctorProfile.js";

// Simple rule-based mapping
const symptomMap = {
    // General / Common
    "fever": ["General Medicine", "Pediatrics"],
    "cough": ["General Medicine", "Pulmonology", "Pediatrics"],
    "headache": ["General Medicine", "Neurology"],
    "fatigue": ["General Medicine", "Endocrinology"],
    "weakness": ["General Medicine"],
    "dizziness": ["General Medicine", "Neurology", "ENT"],

    // Pain related
    "chest pain": ["Cardiology", "General Medicine"],
    "abdominal pain": ["Gastroenterology", "General Medicine", "Gynecology"],
    "back pain": ["Orthopedics", "Rheumatology"],
    "joint pain": ["Orthopedics", "Rheumatology"],
    "muscle pain": ["Orthopedics", "General Medicine"],
    "neck pain": ["Orthopedics", "Neurology"],

    // EENT
    "vision problems": ["Ophthalmology"],
    "eye redness": ["Ophthalmology"],
    "ear pain": ["ENT"],
    "ear discharge": ["ENT"],
    "throat pain": ["ENT", "General Medicine"],
    "sore throat": ["ENT", "General Medicine"],
    "nasal congestion": ["ENT", "General Medicine"],
    "runny nose": ["ENT", "General Medicine"],

    // Gastro
    "vomiting": ["General Medicine", "Gastroenterology"],
    "nausea": ["General Medicine", "Gastroenterology"],
    "diarrhea": ["General Medicine", "Gastroenterology"],
    "constipation": ["General Medicine", "Gastroenterology"],
    "acidity": ["Gastroenterology", "General Medicine"],
    "heartburn": ["Gastroenterology", "General Medicine"],
    "bloating": ["Gastroenterology"],

    // Skin
    "skin rash": ["Dermatology", "General Medicine", "Pediatrics"],
    "itching": ["Dermatology"],
    "acne": ["Dermatology"],
    "hair loss": ["Dermatology"],

    // Uro/Nephro
    "urinary issues": ["Urology", "Nephrology"],
    "burning urination": ["Urology", "General Medicine"],
    "frequent urination": ["Urology", "Nephrology", "Endocrinology"],

    // Neuro/Psych
    "anxiety": ["Psychiatry", "General Medicine"],
    "depression": ["Psychiatry"],
    "insomnia": ["Psychiatry", "General Medicine"],
    "seizures": ["Neurology"],
    "numbness": ["Neurology"],

    // Repro
    "pregnancy": ["Gynecology"],
    "menstrual cramps": ["Gynecology"],
    "irregular periods": ["Gynecology"],

    // Cardio/Resp
    "palpitations": ["Cardiology"],
    "shortness of breath": ["Pulmonology", "Cardiology"],
    "wheezing": ["Pulmonology"],

    // Dental
    "tooth pain": ["Dentistry"],
    "bleeding gums": ["Dentistry"]
};

export const checkSymptoms = async (req, res) => {
    try {
        const { symptoms, duration, age, gender, isEmergency } = req.body;
        if (!symptoms || symptoms.length === 0) {
            return res.status(400).json({ message: "Symptoms are required" });
        }

        // Gender Validation
        const femaleSymptoms = ["pregnancy", "menstrual cramps", "irregular periods"];
        // Add maleSymptoms later if needed

        if (gender && gender.toLowerCase() === "male") {
            const invalid = symptoms.some(s => femaleSymptoms.includes(s.toLowerCase()));
            if (invalid) {
                return res.status(400).json({ message: "Certain selected symptoms are invalid for Male gender." });
            }
        }

        // 1. Determine Urgency
        let urgency = "Non-urgent";
        const urgentSymptoms = ["chest pain", "difficulty breathing", "severe bleeding", "loss of consciousness"];

        const hasUrgent = symptoms.some(s => urgentSymptoms.includes(s.toLowerCase()));

        if (isEmergency || hasUrgent) {
            urgency = "Emergency - Visit Hospital Immediately";
        } else if (duration && (duration.includes("week") || duration.includes("month"))) {
            urgency = "Consult Doctor Soon";
        }

        // 2. Determine Specialties
        let possibleSpecialties = new Set();
        symptoms.forEach(s => {
            const key = s.toLowerCase();
            if (symptomMap[key]) {
                symptomMap[key].forEach(spec => possibleSpecialties.add(spec));
            }
        });

        // Age-based logic
        const ageVal = parseInt(age);
        if (!isNaN(ageVal)) {
            if (ageVal < 18) {
                possibleSpecialties.add("Pediatrics");
            } else {
                // Remove Pediatrics for adults
                possibleSpecialties.delete("Pediatrics");
            }
        }

        // Gender-based logic
        if (gender && gender.toLowerCase() === "female") {
            if (symptoms.includes("abdominal pain") || symptoms.includes("pregnancy") || symptoms.includes("menstrual cramps") || symptoms.includes("irregular periods")) {
                possibleSpecialties.add("Gynecology");
            }
        }

        if (possibleSpecialties.size === 0) {
            possibleSpecialties.add("General Medicine");
        }

        const specialtiesArray = Array.from(possibleSpecialties);

        // 3. Find Doctors
        const doctors = await DoctorProfile.find({
            specialties: { $in: specialtiesArray }
        })
            .populate("user", "name email mobile")
            .populate({
                path: "hospitals.hospital",
                select: "name address location phone" // Include location
            });

        // Format doctors for frontend
        const formattedDoctors = doctors.map(doc => ({
            _id: doc._id,
            name: doc.user?.name || "Unknown Doctor",
            qualifications: doc.qualifications || [],
            experience: doc.experience || null,
            specialties: doc.specialties,
            profilePic: doc.profilePic || doc.user?.avatar,
            hospitals: doc.hospitals.map(h => ({
                _id: h.hospital?._id, // Include Hospital ID
                name: h.hospital?.name || "Unknown Hospital",
                address: h.hospital?.address,
                location: h.hospital?.location, // { lat, lng }
                phone: h.hospital?.phone,
                consultationFee: h.consultationFee
            }))
        }));

        res.json({
            urgency,
            doctors: formattedDoctors
        });

    } catch (err) {
        console.error("Check Symptoms Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const generatePrescription = async (req, res) => {
    try {
        const { symptoms, patientDetails } = req.body;
        if (!symptoms) return res.status(400).json({ message: "Symptoms are required" });

        let result = null;

        // Use local medicine.json data
        console.log("Using local medicine.json for prescription generation");
        const medicineData = loadFallbackData();
        const terms = symptoms.split(",").map(s => s.trim().toLowerCase());

        const matches = medicineData.symptoms_data.filter(item =>
            terms.some(t => item.symptom.toLowerCase().includes(t))
        );

        if (matches.length > 0) {
            // Combine matches
            const combined = {
                medicines: new Set(),
                diet_advice: new Set(),
                suggested_tests: new Set(),
                follow_up: new Set(),
                avoid: new Set()
            };

            matches.forEach(m => {
                m.medicine?.forEach(x => combined.medicines.add(x));
                m.diet_advice?.forEach(x => combined.diet_advice.add(x));
                m.suggested_tests?.forEach(x => combined.suggested_tests.add(x));
                if (m.follow_up) combined.follow_up.add(m.follow_up);
                m.avoid?.forEach(x => combined.avoid.add(x));
            });

            result = {
                medicines: [...combined.medicines],
                diet_advice: [...combined.diet_advice],
                suggested_tests: [...combined.suggested_tests],
                follow_up: [...combined.follow_up].join(". "),
                avoid: [...combined.avoid]
            };
        }

        if (!result) {
            return res.json({
                medicines: ["Consult a doctor for specific medication."],
                diet_advice: ["Eat healthy, balanced meals."],
                suggested_tests: ["General checkup"],
                follow_up: "If symptoms persist.",
                avoid: ["Stress"],
                matchedSymptoms: symptoms ? symptoms.split(",") : []
            });
        }

        const formattedResult = {
            medicines: Array.isArray(result.medicines) ? result.medicines : [result.medicines],
            diet_advice: Array.isArray(result.diet_advice) ? result.diet_advice : [result.diet_advice],
            suggested_tests: Array.isArray(result.suggested_tests) ? result.suggested_tests : [result.suggested_tests],
            follow_up: Array.isArray(result.follow_up) ? result.follow_up.join("\n") : result.follow_up,
            avoid: Array.isArray(result.avoid) ? result.avoid : [result.avoid],
            matchedSymptoms: symptoms.split(",")
        };

        res.json(formattedResult);

    } catch (err) {
        console.error("Generate Prescription Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
