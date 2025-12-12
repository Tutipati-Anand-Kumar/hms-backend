import SupportRequest from "../models/SupportRequest.js";
import sendEmail from "../utils/sendEmail.js";

// @desc    Create a new support request
// @route   POST /api/support
// @access  Private (All authenticated users)
export const createSupportRequest = async (req, res) => {
    try {
        const { subject, message, type } = req.body;
        const user = req.user;

        // Handle file uploads
        let attachments = [];
        if (req.files && req.files.length > 0) {
            attachments = req.files.map(file => file.path); // Cloudinary URL
        }

        const newRequest = new SupportRequest({
            userId: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            subject,
            message,
            type,
            attachments
        });

        await newRequest.save();

        // Send Email to Super Admin
        const SUPER_ADMIN_EMAIL = "anandk85260@gmail.com";
        const emailSubject = `[Support - ${type.toUpperCase()}] ${subject}`;
        const emailBody = `
            <h3>New Support Request</h3>
            <p><strong>From:</strong> ${user.name} (${user.role})</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>Attachments:</strong> ${attachments.length > 0 ? 'Yes' : 'No'}</p>
            <hr />
            <h4>Message:</h4>
            <p>${message}</p>
            <br />
            <p><small>This email was sent from the Hospital Management System Support.</small></p>
        `;

        try {
            await sendEmail(SUPER_ADMIN_EMAIL, emailSubject, emailBody);
        } catch (emailError) {
            console.error("Failed to send support email:", emailError);
        }

        res.status(201).json({ success: true, message: "Support request submitted successfully.", data: newRequest });
    } catch (error) {
        console.error("Create Support Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// @desc    Get all support requests
// @route   GET /api/support
// @access  Private (Super Admin only - can be adapted)
export const getAllSupportRequests = async (req, res) => {
    try {
        // Populate userId just in case we need fresh user data
        const requests = await SupportRequest.find()
            .populate("userId", "name role email")
            .sort({ createdAt: -1 });
        res.status(200).json(requests);
    } catch (error) {
        console.error("Get Support Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// @desc    Get single support request by ID
// @route   GET /api/support/:id
// @access  Private
export const getSupportRequestById = async (req, res) => {
    try {
        const ticket = await SupportRequest.findById(req.params.id)
            .populate("userId", "name role email")
            .populate("replies.senderId", "name role");

        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        // Access check: only allow if user is the creator OR an admin/super-admin
        if (ticket.userId._id.toString() !== req.user._id.toString() &&
            !["admin", "super-admin"].includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "Not authorized to view this ticket" });
        }

        res.status(200).json(ticket);
    } catch (error) {
        console.error("Get Ticket Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// @desc    Add a reply to a ticket
// @route   POST /api/support/:id/reply
// @access  Private
export const addReply = async (req, res) => {
    try {
        const { message } = req.body;
        const user = req.user;
        const ticketId = req.params.id;

        const ticket = await SupportRequest.findById(ticketId);
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        // Handle file uploads for reply
        let attachments = [];
        if (req.files && req.files.length > 0) {
            attachments = req.files.map(file => file.path);
        }

        const reply = {
            senderId: user._id,
            name: user.name,
            role: user.role,
            message,
            attachments
        };

        ticket.replies.push(reply);

        // Logic for status update
        // If Admin replies to a user's ticket, set to 'in-progress' if it was 'open'
        // If User replies, maybe keep it 'in-progress' or 'open'.
        // Let's adopt: Admin reply -> 'in-progress'.
        if (["admin", "super-admin"].includes(user.role) && ticket.status === 'open') {
            ticket.status = 'in-progress';
        }

        await ticket.save();

        // Populate the new reply sender for frontend display
        const updatedTicket = await SupportRequest.findById(ticketId)
            .populate("replies.senderId", "name role");

        res.status(200).json({ success: true, data: updatedTicket });
    } catch (error) {
        console.error("Add Reply Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// @desc    Get current user's support requests
// @route   GET /api/support/my-tickets
// @access  Private
export const getMySupportRequests = async (req, res) => {
    try {
        const requests = await SupportRequest.find({ userId: req.user._id })
            .populate("userId", "name role email")
            .sort({ createdAt: -1 });
        res.status(200).json(requests);
    } catch (error) {
        console.error("Get My Support Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// @desc    Update ticket status
// @route   PUT /api/support/:id/status
// @access  Private (Admin/Super Admin)
export const updateSupportStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const ticket = await SupportRequest.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        if (!["open", "in-progress", "resolved"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        ticket.status = status;
        await ticket.save();

        res.status(200).json({ success: true, message: "Status updated", data: ticket });
    } catch (error) {
        console.error("Update Status Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
