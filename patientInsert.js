// patientInsert.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

dotenv.config();

import User from "./models/User.js";
import PatientProfile from "./models/PatientProfile.js";

const PASSWORD = "Patient@123";

const kadapaAddresses = [
    "Kadapa City, Andhra Pradesh",
    "Rajampet, Kadapa District",
    "Proddatur, Kadapa District",
    "Badvel, Kadapa District",
    "Pulivendula, Kadapa District",
    "Rayachoti, Kadapa District",
    "Mydukur, Kadapa District",
    "Jammalamadugu, Kadapa District",
    "Yerraguntla, Kadapa District",
    "Muddanur, Kadapa District"
];

function randomAddress() {
    return kadapaAddresses[Math.floor(Math.random() * kadapaAddresses.length)];
}

const patients = [
    { name: "Aarav Reddy", gender: "male" },
    { name: "Saanvi Sharma", gender: "female" },
    { name: "Rohan Kumar", gender: "male" },
    { name: "Priya Nair", gender: "female" },
    { name: "Vikas Verma", gender: "male" },
    { name: "Aditi Rao", gender: "female" },
    { name: "Manish Patil", gender: "male" },
    { name: "Kavya Desai", gender: "female" },
    { name: "Rithvik Reddy", gender: "male" },
    { name: "Sneha Pillai", gender: "female" },

    { name: "Harsha Varma", gender: "male" },
    { name: "Mounika Goud", gender: "female" },
    { name: "Srinivas Rao", gender: "male" },
    { name: "Lavanya Shetty", gender: "female" },
    { name: "Anirudh Sai", gender: "male" },
    { name: "Divya Kalyan", gender: "female" },
    { name: "Rahul Sinha", gender: "male" },
    { name: "Nikita Mehra", gender: "female" },
    { name: "Sandeep Reddy", gender: "male" },
    { name: "Pravallika Devi", gender: "female" },

    { name: "Teja Chowdary", gender: "male" },
    { name: "Ashwini Rao", gender: "female" },
    { name: "Karthik Menon", gender: "male" },
    { name: "Shreya Anand", gender: "female" },
    { name: "Varun Krishna", gender: "male" },
    { name: "Neha Fernandes", gender: "female" },
    { name: "Abhinav Goud", gender: "male" },
    { name: "Aishwarya Iyer", gender: "female" },
    { name: "Rithika Reddy", gender: "female" },
    { name: "Jayesh Gupta", gender: "male" }
];

function randomDOB() {
    const year = Math.floor(Math.random() * (2003 - 1988 + 1)) + 1988;
    const month = Math.floor(Math.random() * 12);
    const day = Math.floor(Math.random() * 28) + 1;
    return new Date(year, month, day);
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const hashedPassword = await bcrypt.hash(PASSWORD, 10);

    let inserted = 0;
    let mobileCounter = 9002000000;

    for (const p of patients) {
        mobileCounter++;
        const email = p.name.toLowerCase().replace(/ /g, "") + "@patient.com";

        // Create User
        const user = await User.create({
            name: p.name,
            email,
            mobile: mobileCounter.toString(),
            password: hashedPassword,
            role: "patient"
        });

        // Create PatientProfile
        await PatientProfile.create({
            user: user._id,

            medicalHistory: "No major issues reported",
            dob: randomDOB(),
            gender: p.gender,
            address: randomAddress(),
            contactNumber: mobileCounter.toString()
        });

        console.log(`✔ Inserted: ${p.name}`);
        inserted++;
    }

    console.log("\n===== SUMMARY =====");
    console.log({ inserted });

    process.exit(0);
}

run();
