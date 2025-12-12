import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const hashed = await bcrypt.hash("admin123", 10);

  const admin = await User.create({
    name: "Super Admin",
    email: "admin@gmail.com",
    mobile: "8328470402", 
    password: hashed,
    role: "super-admin"
  });

  console.log("Admin created:", admin);
  process.exit();
}

createAdmin();