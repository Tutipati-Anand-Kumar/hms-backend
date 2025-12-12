import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import os from "os";
import express from "express";

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

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/helpdesk", helpDeskRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/prescriptions", prescriptionPDFRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/support", supportRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

export { app, server };
