import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS, // Your Gmail APP PASSWORD (not login password)
      },
    });

    console.log(`Attempting to send email via Gmail to: ${to}`);

    // Setup email data
    const mailOptions = {
      from: `"MSureChain Support" <${process.env.EMAIL_USER}>`, // Valid sender name
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully via Gmail:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email via Gmail:", error);
    throw error;
  }
};

export default sendEmail;
