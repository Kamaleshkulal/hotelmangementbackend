const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendEmail = async (options) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

const sendVerificationEmail = async (email, verificationToken, firstName) => {
  const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email/${verificationToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333;">Email Verification</h2>
      <p>Hello ${firstName},</p>
      <p>Thank you for registering with our hotel management system. Please click the button below to verify your email address:</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email</a>
      </div>
      <p>Or copy and paste the following link in your browser:</p>
      <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, please ignore this email.</p>
      <p>Thank you,<br>Hotel Management Team</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Verify Your Email',
    html
  });
};

const sendLoginOTPEmail = async (email, otp, firstName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333;">Login Verification</h2>
      <p>Hello ${firstName},</p>
      <p>Your login verification code is:</p>
      <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 15px 0;">
        ${otp}
      </div>
      <p>This code will expire in 2 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
      <p>Thank you,<br>Hotel Management Team</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Login Verification Code',
    html
  });
};

const sendPasswordResetEmail = async (email, resetToken, firstName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333;">Password Reset</h2>
      <p>Hello ${firstName},</p>
      <p>Your password reset verification code is:</p>
      <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 15px 0;">
        ${resetToken}
      </div>
      <p>This code will expire in 2 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
      <p>Thank you,<br>Hotel Management Team</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Password Reset Verification Code',
    html
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendLoginOTPEmail,
  sendPasswordResetEmail
}; 