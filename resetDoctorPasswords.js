// resetDoctorPasswords.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import User from "./models/User.js";
import bcrypt from "bcrypt";

async function resetPasswords() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const newPassword = "Doctor@123";
        const hashed = await bcrypt.hash(newPassword, 10);

        const result = await User.updateMany(
            { role: "doctor" },
            { $set: { password: hashed } }
        );

        console.log("===============");
        console.log("PASSWORD RESET DONE");
        console.log("===============");
        console.log(`Matched doctors : ${result.matchedCount}`);
        console.log(`Updated doctors : ${result.modifiedCount}`);
        console.log("New password for ALL doctors = Doctor@123");

        process.exit(0);
    } catch (err) {
        console.error("Error resetting passwords:", err);
        process.exit(1);
    }
}

resetPasswords();
