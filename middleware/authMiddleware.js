// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import HelpDesk from "../models/HelpDesk.js";

export const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // First try Users
    const user = await User.findById(decoded.id).select("-password");
    if (user) {
      req.user = user;
      return next();
    }

    // If not a User, try HelpDesk (helpdesk tokens have role 'helpdesk')
    const helpDesk = await HelpDesk.findById(decoded.id).select("-password");
    if (helpDesk) {
      req.helpDesk = helpDesk;
      // also set req.user for compatibility and set role so authorizeRoles works
      req.user = helpDesk;
      req.user.role = 'helpdesk';
      return next();
    }

    return res.status(401).json({ message: "Not authorized, user not found" });
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized to access this route" });
    }
    next();
 };
};