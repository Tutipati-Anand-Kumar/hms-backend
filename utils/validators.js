// utils/validators.js
import { body } from "express-validator";

export const otpSendValidator = [
  body("mobile").notEmpty().withMessage("mobile required"),
  body("email").isEmail().withMessage("valid email required")
];

export const otpVerifyValidator = [
  body("mobile").notEmpty().withMessage("mobile required"),
  body("otp").notEmpty().withMessage("otp required")
];

export const registerValidator = [
  body("name").notEmpty().withMessage("Name required"),
  body("mobile").notEmpty().withMessage("Mobile required"),
  body("email").isEmail().withMessage("Valid email required"),
  body("otp").notEmpty().withMessage("OTP required"),
  body("password").isLength({ min: 6 }).withMessage("Password min 6 chars")
];

export const loginValidator = [
  body("password").notEmpty().withMessage("Password is required"),
  body("identifier").notEmpty().withMessage("Identifier (Mobile or Doctor ID) is required")
];


export const refreshValidator = [
  body("refreshToken").notEmpty().withMessage("refreshToken required")
];

export const resetPwdValidator = [
  body("token").notEmpty().withMessage("token required"),
  body("newPwd").isLength({ min: 6 }).withMessage("newPwd min 6 chars")
];
