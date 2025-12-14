import express from "express";
import { sendMessage, getMessages, getConversations, deleteMessage, editMessage } from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, sendMessage);
router.get("/conversation/:otherUserId", protect, getMessages);
router.get("/conversations", protect, getConversations);

router.put("/:messageId", protect, editMessage);
router.delete("/:messageId", protect, deleteMessage);

export default router;
