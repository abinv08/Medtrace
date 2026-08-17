import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
  port: Number(process.env.EMAIL_PORT) || 587,
  auth: {
    user: process.env.EMAIL_USER || 'medtrace_demo',
    pass: process.env.EMAIL_PASS || 'medtrace_pass',
  },
});

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string
): Promise<boolean> => {
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
  } catch (error) {
    console.error('Failed to send reset email:', error);
    return false;
  }
};
