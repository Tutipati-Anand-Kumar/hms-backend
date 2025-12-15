import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import os from "os";
import express from "express";
import rateLimit from "express-rate-limit";

// Route imports
import authRoutes from "./routes/authRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import helpDeskRoutes from "./routes/helpDeskRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import prescriptionPDFRoutes from "./routes/prescriptionPDFRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"]
    }
});

// Attach io to req
app.use((req, res, next) => {
    req.io = io;
    next();
});

io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("join_room", ({ role, userId }) => {
        if (role && userId) {
            const room = `${role}_${userId}`;
            socket.join(room);
            console.log(`Socket ${socket.id} joined room: ${room}`);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

app.use(cors({
    origin: ["http://localhost:5173", "https://hms-frontend-green.vercel.app", "http://localhost:3000"],
    credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
// Rate Limiting Configuration

// General Limiter: 100 requests per 15 minutes
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { status: 429, error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => process.env.NODE_ENV === 'test', // Disable in tests
});

// Auth Limiter: 10 requests per minute (stricter for login/OTP)
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: { status: 429, error: "Too many login attempts, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => process.env.NODE_ENV === 'test', // Disable in tests
});

// Routes
// Apply Auth Limiter to Auth routes
app.use("/api/auth", authLimiter, authRoutes);

// Apply General Limiter to all other routes
app.use("/api/patients", generalLimiter, patientRoutes);
app.use("/api/doctors", generalLimiter, doctorRoutes);
app.use("/api/hospitals", generalLimiter, hospitalRoutes);
app.use("/api/admin", generalLimiter, adminRoutes);
app.use("/api/helpdesk", generalLimiter, helpDeskRoutes);
app.use("/api/ai", generalLimiter, aiRoutes);
app.use("/api/bookings", generalLimiter, bookingRoutes);
app.use("/api/prescriptions", generalLimiter, prescriptionRoutes);
app.use("/api/prescriptions", generalLimiter, prescriptionPDFRoutes);
app.use("/api/reports", generalLimiter, reportRoutes);
app.use("/api/messages", generalLimiter, messageRoutes);
app.use("/api/leaves", generalLimiter, leaveRoutes);
app.use("/api/notes", generalLimiter, noteRoutes);
app.use("/api/notifications", generalLimiter, notificationRoutes);
app.use("/api/support", generalLimiter, supportRoutes);

app.get("/api/health", generalLimiter, (req, res) => res.json({ status: "ok" }));

export { app, server };
