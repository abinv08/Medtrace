"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = exports.sendCaretakerAssignmentEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: Number(process.env.EMAIL_PORT) || 587,
    auth: {
        user: process.env.EMAIL_USER || 'medtrace_demo',
        pass: process.env.EMAIL_PASS || 'medtrace_pass',
    },
});
const sendCaretakerAssignmentEmail = async (details) => {
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
    const mailOptions = {
        from: process.env.EMAIL_FROM || `"MedTrace Health Team" <${process.env.EMAIL_USER || 'no-reply@medtrace.ai'}>`,
        to: details.caretakerEmail,
        subject: `MedTrace Care Network Access for ${details.patientName}`,
        text: [
            `Hello ${details.caretakerName},`,
            '',
            `You have been assigned as a ${details.relationship} caretaker for ${details.patientName}.`,
            `Access level: ${details.accessLevel}`,
            '',
            `Register or sign in at: ${clientOrigin}/register`,
            `Use this email address to access the Caretaker Dashboard: ${details.caretakerEmail}`,
            '',
            'MedTrace Health Team',
        ].join('\n'),
        html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1E293B; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px;">
        <h2 style="color: #1565C0;">MedTrace Care Network</h2>
        <p>Hello <strong>${details.caretakerName}</strong>,</p>
        <p>You have been assigned as a <strong>${details.relationship}</strong> caretaker for <strong>${details.patientName}</strong>.</p>
        <p>Access level: <strong>${details.accessLevel}</strong></p>
        <p><a href="${clientOrigin}/register">Register or sign in to MedTrace</a> using this email address.</p>
        <p style="color: #64748B; font-size: 13px;">After signing in, the assigned patient will appear in your Caretaker Dashboard.</p>
        <p>MedTrace Health Team</p>
      </div>
    `,
    };
    try {
        await transporter.sendMail(mailOptions);
        return true;
    }
    catch (error) {
        console.error('Failed to send caretaker assignment email:', error);
        return false;
    }
};
exports.sendCaretakerAssignmentEmail = sendCaretakerAssignmentEmail;
const sendPasswordResetEmail = async (email, resetToken) => {
    const resetUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    const mailOptions = {
        from: '"MedTrace AI Support" <no-reply@medtrace.ai>',
        to: email,
        subject: 'MedTrace Password Reset Request',
        html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1E293B; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px;">
        <h2 style="color: #2563EB;">MEDTRACE</h2>
        <p style="font-size: 16px;">Hello,</p>
        <p>You requested a password reset for your <strong>MedTrace AI Clinical Intelligence</strong> account.</p>
        <p>Please click the button below to reset your password. This link is valid for 1 hour:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${resetUrl}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #64748B; font-size: 13px;">If you did not request this password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="color: #94A3B8; font-size: 12px; text-align: center;">MedTrace AI-Based Clinical Intelligence & Contactless Patient Monitoring System</p>
      </div>
    `,
    };
    try {
        console.log(`[Email Service] Password reset email link generated: ${resetUrl}`);
        // In production environment with active SMTP credentials, transporter.sendMail(mailOptions);
        return true;
    }
    catch (error) {
        console.error('Failed to send reset email:', error);
        return false;
    }
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
