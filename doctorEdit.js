// doctorEdit.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import User from "./models/User.js";
import DoctorProfile from "./models/DoctorProfile.js";
import Hospital from "./models/Hospital.js";

// ==========================================================
// 20 DOCTOR UPDATE FULL DATA — AUTO MAPPED BY SPECIALTY
// ==========================================================

const updates = [
    // 1 — Dr Suresh — Cardiology → HOSP0001
    {
        doctorId: "DOC758454",
        specialties: ["Cardiology"],
        qualifications: ["MBBS", "MD Cardiology"],
        experienceStart: "2016-05-01",
        bio: "Senior cardiologist specializing in complex heart disorders.",
        hospitals: [
            {
                hospitalId: "HOSP0001",
                specialties: ["Cardiology"],
                consultationFee: 500,
                availability: [{ day: "Monday", slots: ["9AM-1PM"] }],
            },
        ],
    },

    // 2 — Dr Arjun Reddy — General Surgery → HOSP0003
    {
        doctorId: "DOC464173",
        specialties: ["General Surgery"],
        qualifications: ["MBBS", "MS General Surgery"],
        experienceStart: "2015-03-12",
        bio: "General surgeon with experience in major and minor surgeries.",
        hospitals: [
            {
                hospitalId: "HOSP0003",
                specialties: ["General Surgery"],
                consultationFee: 450,
                availability: [{ day: "Tuesday", slots: ["10AM-2PM"] }],
            },
        ],
    },

    // 3 — Dr Sneha Rao — Neurology → HOSP0003
    {
        doctorId: "DOC704633",
        specialties: ["Neurology"],
        qualifications: ["MBBS", "DM Neurology"],
        experienceStart: "2017-02-10",
        bio: "Neurologist focusing on epilepsy and neuro-muscular disorders.",
        hospitals: [
            {
                hospitalId: "HOSP0003",
                specialties: ["Neurology"],
                consultationFee: 600,
                availability: [{ day: "Wednesday", slots: ["11AM-3PM"] }],
            },
        ],
    },

    // 4 — Dr Vikram Singh — Orthopedics → HOSP0008
    {
        doctorId: "DOC746932",
        specialties: ["Orthopedics"],
        qualifications: ["MBBS", "MS Ortho"],
        experienceStart: "2014-06-20",
        bio: "Orthopedic surgeon with expertise in fractures and joint care.",
        hospitals: [
            {
                hospitalId: "HOSP0008",
                specialties: ["Orthopedics"],
                consultationFee: 550,
                availability: [{ day: "Thursday", slots: ["9AM-1PM"] }],
            },
        ],
    },

    // 5 — Dr Ravi Teja — Pediatrics → HOSP0007
    {
        doctorId: "DOC754143",
        specialties: ["Pediatrics"],
        qualifications: ["MBBS", "MD Pediatrics"],
        experienceStart: "2019-08-10",
        bio: "Child specialist focused on modern pediatric care.",
        hospitals: [
            {
                hospitalId: "HOSP0007",
                specialties: ["Pediatrics"],
                consultationFee: 400,
                availability: [{ day: "Friday", slots: ["10AM-2PM"] }],
            },
        ],
    },

    // 6 — Dr Sruthi Menon — Ophthalmology → HOSP0010
    {
        doctorId: "DOC426062",
        specialties: ["Ophthalmology"],
        qualifications: ["MBBS", "MS Ophthalmology"],
        experienceStart: "2018-11-01",
        bio: "Eye specialist with interest in LASIK and cataract surgery.",
        hospitals: [
            {
                hospitalId: "HOSP0010",
                specialties: ["Ophthalmology"],
                consultationFee: 550,
                availability: [{ day: "Monday", slots: ["11AM-2PM"] }],
            },
        ],
    },

    // 7 — Dr Kunal Sharma — ENT → HOSP0010
    {
        doctorId: "DOC924724",
        specialties: ["ENT"],
        qualifications: ["MBBS", "MS ENT"],
        experienceStart: "2016-03-01",
        bio: "ENT specialist treating sinus, hearing, and throat issues.",
        hospitals: [
            {
                hospitalId: "HOSP0010",
                specialties: ["ENT"],
                consultationFee: 500,
                availability: [{ day: "Tuesday", slots: ["10AM-1PM"] }],
            },
        ],
    },

    // 8 — Dr Jasmine Fatima — Gynecology → HOSP0007
    {
        doctorId: "DOC178976",
        specialties: ["Gynecology"],
        qualifications: ["MBBS", "MD Gynecology"],
        experienceStart: "2017-06-15",
        bio: "Gynecologist with expertise in women's reproductive health.",
        hospitals: [
            {
                hospitalId: "HOSP0007",
                specialties: ["Gynecology"],
                consultationFee: 450,
                availability: [{ day: "Wednesday", slots: ["12PM-4PM"] }],
            },
        ],
    },

    // 9 — Dr Nikhil Varma — Orthopedics → HOSP0004
    {
        doctorId: "DOC471501",
        specialties: ["Orthopedics"],
        qualifications: ["MBBS", "MS Ortho"],
        experienceStart: "2013-10-10",
        bio: "Ortho specialist in sports medicine and trauma care.",
        hospitals: [
            {
                hospitalId: "HOSP0004",
                specialties: ["Orthopedics"],
                consultationFee: 600,
                availability: [{ day: "Friday", slots: ["9AM-12PM"] }],
            },
        ],
    },

    // 10 — Dr Manohar Reddy — Cardiology → HOSP0006
    {
        doctorId: "DOC773698",
        specialties: ["Cardiology"],
        qualifications: ["MBBS", "DM Cardiology"],
        experienceStart: "2015-04-18",
        bio: "Cardiologist with expertise in cardiac emergencies.",
        hospitals: [
            {
                hospitalId: "HOSP0006",
                specialties: ["Cardiology"],
                consultationFee: 650,
                availability: [{ day: "Saturday", slots: ["10AM-2PM"] }],
            },
        ],
    },

    // 11 — Dr Harsha Naidu — Neurology → HOSP0006
    {
        doctorId: "DOC413586",
        specialties: ["Neurology"],
        qualifications: ["MBBS", "DM Neurology"],
        experienceStart: "2018-09-12",
        bio: "Neurologist specializing in stroke and neuro care.",
        hospitals: [
            {
                hospitalId: "HOSP0006",
                specialties: ["Neurology"],
                consultationFee: 600,
                availability: [{ day: "Monday", slots: ["2PM-6PM"] }],
            },
        ],
    },

    // 12 — Dr Lakshmi Prasad — General Medicine → HOSP0002
    {
        doctorId: "DOC386154",
        specialties: ["General Medicine"],
        qualifications: ["MBBS", "MD Internal Medicine"],
        experienceStart: "2013-01-05",
        bio: "Physician managing chronic diseases and general care.",
        hospitals: [
            {
                hospitalId: "HOSP0002",
                specialties: ["General Medicine"],
                consultationFee: 350,
                availability: [{ day: "Tuesday", slots: ["9AM-12PM"] }],
            },
        ],
    },

    // 13 — Dr Rakesh Pillai — ENT → HOSP0010
    {
        doctorId: "DOC108918",
        specialties: ["ENT"],
        qualifications: ["MBBS", "MS ENT"],
        experienceStart: "2016-02-22",
        bio: "ENT surgeon specializing in endoscopic sinus surgery.",
        hospitals: [
            {
                hospitalId: "HOSP0010",
                specialties: ["ENT"],
                consultationFee: 550,
                availability: [{ day: "Thursday", slots: ["1PM-4PM"] }],
            },
        ],
    },

    // 14 — Dr Ananya Devi — Pediatrics → HOSP0007
    {
        doctorId: "DOC736537",
        specialties: ["Pediatrics"],
        qualifications: ["MBBS", "MD Pediatrics"],
        experienceStart: "2020-02-01",
        bio: "Pediatrician with expertise in newborn and child care.",
        hospitals: [
            {
                hospitalId: "HOSP0007",
                specialties: ["Pediatrics"],
                consultationFee: 400,
                availability: [{ day: "Friday", slots: ["11AM-3PM"] }],
            },
        ],
    },

    // 15 — Dr Kavitha Shankar — Gynecology → HOSP0007
    {
        doctorId: "DOC417458",
        specialties: ["Gynecology"],
        qualifications: ["MBBS", "MS Gynecology"],
        experienceStart: "2014-08-20",
        bio: "Gynecologist specializing in maternity and fertility.",
        hospitals: [
            {
                hospitalId: "HOSP0007",
                specialties: ["Gynecology"],
                consultationFee: 500,
                availability: [{ day: "Monday", slots: ["10AM-1PM"] }],
            },
        ],
    },

    // 16 — Dr Suresh Patil — Gastroenterology → HOSP0009
    {
        doctorId: "DOC948437",
        specialties: ["Gastroenterology"],
        qualifications: ["MBBS", "DM Gastroenterology"],
        experienceStart: "2017-06-14",
        bio: "Gastro specialist with focus on stomach, liver and GI tract disorders.",
        hospitals: [
            {
                hospitalId: "HOSP0009",
                specialties: ["Gastroenterology"],
                consultationFee: 700,
                availability: [{ day: "Wednesday", slots: ["9AM-12PM"] }],
            },
        ],
    },

    // 17 — Dr Vinay Chandra — Nephrology → HOSP0009
    {
        doctorId: "DOC999879",
        specialties: ["Nephrology"],
        qualifications: ["MBBS", "DM Nephrology"],
        experienceStart: "2018-01-01",
        bio: "Nephrologist specializing in chronic kidney diseases.",
        hospitals: [
            {
                hospitalId: "HOSP0009",
                specialties: ["Nephrology"],
                consultationFee: 600,
                availability: [{ day: "Saturday", slots: ["10AM-1PM"] }],
            },
        ],
    },

    // 18 — Dr Alekhya Nair — Dermatology → HOSP0004
    {
        doctorId: "DOC717652",
        specialties: ["Dermatology"],
        qualifications: ["MBBS", "DDVL"],
        experienceStart: "2019-04-10",
        bio: "Dermatologist with expertise in skin & hair treatments.",
        hospitals: [
            {
                hospitalId: "HOSP0004",
                specialties: ["Dermatology"],
                consultationFee: 450,
                availability: [{ day: "Thursday", slots: ["10AM-2PM"] }],
            },
        ],
    },

    // 19 — Dr Tarun Verma — Urology → HOSP0009
    {
        doctorId: "DOC227329",
        specialties: ["Urology"],
        qualifications: ["MBBS", "MCH Urology"],
        experienceStart: "2016-10-12",
        bio: "Urologist specializing in kidney and urinary tract disorders.",
        hospitals: [
            {
                hospitalId: "HOSP0009",
                specialties: ["Urology"],
                consultationFee: 650,
                availability: [{ day: "Monday", slots: ["9AM-12PM"] }],
            },
        ],
    },

    // 20 — Dr Neha Kulkarni — Neurology → HOSP0006
    {
        doctorId: "DOC376128",
        specialties: ["Neurology"],
        qualifications: ["MBBS", "DM Neurology"],
        experienceStart: "2017-12-01",
        bio: "Neurologist with focus on headache and spinal disorders.",
        hospitals: [
            {
                hospitalId: "HOSP0006",
                specialties: ["Neurology"],
                consultationFee: 550,
                availability: [{ day: "Tuesday", slots: ["11AM-2PM"] }],
            },
        ],
    },
];

// ==========================================================
// MAIN SCRIPT
// ==========================================================

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    let updated = 0;
    let notFound = 0;

    for (let doc of updates) {
        const user = await User.findOne({ doctorId: doc.doctorId });

        if (!user) {
            console.log(`❌ User not found: ${doc.doctorId}`);
            notFound++;
            continue;
        }

        const profile = await DoctorProfile.findOne({ user: user._id });

        if (!profile) {
            console.log(`❌ DoctorProfile missing: ${doc.doctorId}`);
            notFound++;
            continue;
        }

        // hospital assignments
        const hospitalAssignments = [];
        for (const h of doc.hospitals) {
            const hosp = await Hospital.findOne({ hospitalId: h.hospitalId });
            if (!hosp) continue;

            hospitalAssignments.push({
                hospital: hosp._id,
                specialties: h.specialties,
                consultationFee: h.consultationFee,
                availability: h.availability,
                status: "active",
                assignedAt: new Date(),
            });
        }

        await DoctorProfile.updateOne(
            { user: user._id },
            {
                $set: {
                    specialties: doc.specialties,
                    qualifications: doc.qualifications,
                    experienceStart: doc.experienceStart,
                    bio: doc.bio,
                    hospitals: hospitalAssignments,
                },
            }
        );

        console.log(`✔ Updated: ${doc.doctorId}`);
        updated++;
    }

    console.log("\n===== SUMMARY =====");
    console.log({ updated, notFound });

    process.exit(0);
}

main();