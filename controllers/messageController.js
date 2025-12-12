import Message from "../models/Message.js";
import User from "../models/User.js";
import HelpDesk from "../models/HelpDesk.js";

// Helper to populate messages from both User and HelpDesk collections
const populateMessages = async (messages) => {
    if (!messages || messages.length === 0) return [];

    const userIds = new Set();
    const replyIds = new Set(); // To fetch quoted messages

    // Handle both array of documents and single document
    const msgArray = Array.isArray(messages) ? messages : [messages];

    msgArray.forEach(msg => {
        if (msg.sender) userIds.add(msg.sender.toString());
        if (msg.receiver) userIds.add(msg.receiver.toString());
        if (msg.replyTo) replyIds.add(msg.replyTo.toString());
    });

    const ids = Array.from(userIds);
    const rIds = Array.from(replyIds);

    const [users, helpDesks, replies] = await Promise.all([
        User.find({ _id: { $in: ids } }).select("name role avatar"), // Include avatar
        HelpDesk.find({ _id: { $in: ids } }).select("name"),
        Message.find({ _id: { $in: rIds } }).select("content sender") // Fetch quoted content
    ]);

    const userMap = {};
    users.forEach(u => {
        userMap[u._id.toString()] = u.toObject ? u.toObject() : u; // Ensure plain object
    });

    // Populate Doctor Profile Pictures
    const doctorIds = users.filter(u => u.role === 'doctor').map(u => u._id);
    if (doctorIds.length > 0) {
        try {
            const DoctorProfile = (await import("../models/DoctorProfile.js")).default;
            const profiles = await DoctorProfile.find({ user: { $in: doctorIds } }).select("user profilePic");
            profiles.forEach(p => {
                if (userMap[p.user.toString()] && p.profilePic) {
                    userMap[p.user.toString()].profilePic = p.profilePic;
                }
            });
        } catch (e) {
            console.error("Error populating doctor images", e);
        }
    }

    helpDesks.forEach(hd => {
        const obj = hd.toObject ? hd.toObject() : hd;
        obj.role = 'helpdesk'; // Manually assign role
        userMap[hd._id.toString()] = obj;
    });

    const replyMap = {};
    replies.forEach(r => replyMap[r._id.toString()] = r);

    return msgArray.map(msg => {
        const msgObj = msg.toObject ? msg.toObject() : msg;
        msgObj.sender = userMap[msg.sender.toString()] || null;
        msgObj.receiver = userMap[msg.receiver.toString()] || null;

        if (msg.replyTo) {
            const originalMsg = replyMap[msg.replyTo.toString()];
            if (originalMsg) {
                msgObj.replyTo = {
                    _id: originalMsg._id,
                    content: originalMsg.content,
                    senderName: userMap[originalMsg.sender.toString()]?.name || "Unknown"
                };
            }
        }

        return msgObj;
    });
};

// Send Message
export const sendMessage = async (req, res) => {
    try {
        const { receiverId, content, hospitalId, replyTo } = req.body;
        const senderId = req.user._id;

        const message = await Message.create({
            sender: senderId,
            receiver: receiverId,
            content,
            hospital: hospitalId, // Ensure this matches the schema field
            replyTo: replyTo || null
        });

        // Manually populate
        const populatedMessages = await populateMessages([message]);
        const fullMessage = populatedMessages[0];

        // Socket.io Emit
        if (req.io) {
            req.io.to(receiverId).emit("receive_message", fullMessage);
        }

        // --- AUTO-COMPLETE APPOINTMENT LOGIC ---
        // If sender is a doctor and message implies completion
        if (req.user.role === 'doctor' && (content.toLowerCase().includes("completed") || content.toLowerCase().includes("next patient"))) {
            try {
                // Import Appointment dynamically to avoid circular dependency issues if any
                const Appointment = (await import("../models/Appointment.js")).default;
                const DoctorProfile = (await import("../models/DoctorProfile.js")).default;

                const docProfile = await DoctorProfile.findOne({ user: senderId });
                if (docProfile) {
                    // Find the latest active appointment (pending or confirmed) for this doctor
                    // We prioritize 'confirmed' ones that are likely happening now
                    const activeAppointment = await Appointment.findOne({
                        doctor: docProfile._id,
                        status: { $in: ["confirmed", "pending"] },
                        date: {
                            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                            $lt: new Date(new Date().setHours(23, 59, 59, 999))
                        } // Today's appointments
                    }).sort({ timeSlot: 1 }); // Get the earliest one (likely the current one)

                    if (activeAppointment) {
                        activeAppointment.status = "completed";
                        await activeAppointment.save();
                        console.log(`Auto-completed appointment ${activeAppointment._id} for doctor ${docProfile._id}`);

                        // Notify via socket about status change
                        if (req.io) {
                            req.io.emit("appointment_status_changed", {
                                appointmentId: activeAppointment._id,
                                status: "completed",
                                doctorName: req.user.name,
                                hospitalId: hospitalId
                            });
                        }
                    }
                }
            } catch (autoErr) {
                console.error("Auto-complete error:", autoErr);
                // Don't fail the message send if auto-complete fails
            }
        }
        // ---------------------------------------

        res.status(201).json(fullMessage);
    } catch (err) {
        console.error("Send Message Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// Get Messages (Conversation between two users)
export const getMessages = async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const currentUserId = req.user._id;

        const messages = await Message.find({
            $or: [
                { sender: currentUserId, receiver: otherUserId },
                { sender: otherUserId, receiver: currentUserId }
            ],
            // Exclude messages hidden for this user
            hiddenFor: { $ne: currentUserId }
        }).sort({ createdAt: 1 });

        const populatedMessages = await populateMessages(messages);

        res.json(populatedMessages);
    } catch (err) {
        console.error("Get Messages Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Get Recent Conversations (For Help Desk to see list of doctors they talked to)
export const getConversations = async (req, res) => {
    try {
        const currentUserId = req.user._id;

        // Find all messages where current user is sender or receiver
        // AND not hidden for current user
        const messages = await Message.find({
            $or: [{ sender: currentUserId }, { receiver: currentUserId }],
            hiddenFor: { $ne: currentUserId }
        }).sort({ createdAt: -1 });

        const populatedMessages = await populateMessages(messages);

        // Group by other user
        const conversations = {};
        populatedMessages.forEach(msg => {
            if (!msg.sender || !msg.receiver) return; // Skip if user deleted

            const otherUser = msg.sender._id.toString() === currentUserId.toString()
                ? msg.receiver
                : msg.sender;

            if (!conversations[otherUser._id]) {
                conversations[otherUser._id] = {
                    user: otherUser,
                    lastMessage: msg
                };
            }
        });

        res.json(Object.values(conversations));
    } catch (err) {
        console.error("Get Conversations Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete Message (Soft delete for "Delete For Me", Hard delete if "Delete for Everyone" logic requested, but here we do soft for individual)
// Updated to support Bulk Delete as well if needed, but keeping singular for now based on route
export const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const currentUserId = req.user._id;
        const { deleteForEveryone } = req.body || {}; // Optional flag if we implement that

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ message: "Message not found" });

        // Logic:
        // 1. If "Delete for Everyone" AND user is sender -> Hard delete (or special flag)
        // 2. Else -> "Delete for Me" -> Add to hiddenFor

        if (deleteForEveryone && message.sender.toString() === currentUserId.toString()) {
            await Message.findByIdAndDelete(messageId);
            // Notify via socket for removal
            if (req.io) {
                req.io.emit("message_deleted", { messageId });
            }
            return res.json({ message: "Message deleted for everyone" });
        }

        // Soft Delete (Delete for Me)
        // Check if already hidden
        if (!message.hiddenFor.includes(currentUserId)) {
            message.hiddenFor.push(currentUserId);
            await message.save();
        }

        res.json({ message: "Message deleted for you" });
    } catch (err) {
        console.error("Delete Message Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
