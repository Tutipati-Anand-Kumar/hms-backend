import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import HelpDesk from "../models/HelpDesk.js";
import Hospital from "../models/Hospital.js";

dotenv.config({ path: "backend/.env" });

const hospitalsData = [
    { hospitalId: "HOSP0001", name: "Sunrise Super Specialty Hospital", email: "helpdesk.sunrise@hms.com", mobile: "9002000031" },
    { hospitalId: "HOSP0002", name: "RIMS Government General Hospital Kadapa", email: "helpdesk.rims@hms.com", mobile: "9002000032" },
    { hospitalId: "HOSP0003", name: "Apollo Reach Hospital Kadapa", email: "helpdesk.apollo@hms.com", mobile: "90020000033" },
    { hospitalId: "HOSP0004", name: "Kadapa Multi-Speciality Hospital", email: "helpdesk.kadapams@hms.com", mobile: "9002000034" },
    { hospitalId: "HOSP0005", name: "MediCare Super Speciality Hospital Kadapa", email: "helpdesk.medicare@hms.com", mobile: "9002000035" },
    { hospitalId: "HOSP0006", name: "Kadapa Heart & Brain Institute", email: "helpdesk.khbi@hms.com", mobile: "9002000036" },
    { hospitalId: "HOSP0007", name: "Kadapa Women and Children Speciality Hospital", email: "helpdesk.womenchild@hms.com", mobile: "9002000037" },
    { hospitalId: "HOSP0008", name: "Kadapa Ortho and Trauma Care Hospital", email: "helpdesk.ortho@hms.com", mobile: "9002000038" },
    { hospitalId: "HOSP0009", name: "Kadapa Kidney and Liver Institute", email: "helpdesk.kidney@hms.com", mobile: "9002000039" },
    { hospitalId: "HOSP0010", name: "Kadapa Eye and ENT Care Hospital", email: "helpdesk.eyeent@hms.com", mobile: "9002000040" },
];

const seedHelpDesk = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected");

        const password = "He 3";
        const hashedPassword = await bcrypt.hash(password, 10);

        for (const data of hospitalsData) {
            const hospital = await Hospital.findOne({ hospitalId: data.hospitalId });

            if (!hospital) {
                console.log(`Hospital not found: ${data.hospitalId}`);
                continue;
            }

            const existing = await HelpDesk.findOne({ email: data.email });
            if (existing) {
                console.log(`HelpDesk already exists for: ${data.name}`);
                continue;
            }

            await HelpDesk.create({
                name: `HelpDesk - ${data.name}`,
                email: data.email,
                mobile: data.mobile,
                password: hashedPassword,
                hospital: hospital._id,
                status: "active"
            });

            console.log(`Created HelpDesk for: ${data.name}`);
        }

        console.log("Seeding Completed");
        process.exit();
    } catch (err) {
        console.error("Seeding Error:", err);
        process.exit(1);
    }
};

seedHelpDesk();
