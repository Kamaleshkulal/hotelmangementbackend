const User = require('../models/User');
const jwt = require('jsonwebtoken');
const {
  sendVerificationEmail,
  sendLoginOTPEmail,
  sendPasswordResetEmail
} = require('../config/emailService');
const { Op } = require('sequelize');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { first_name, last_name, email, password, confirm_password } = req.body;

    // Check if passwords match
    if (password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.create({
      first_name,
      last_name,
      email,
      password
    });

    // Generate verification token
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Try to send verification email
    try {
      await sendVerificationEmail(email, verificationToken, first_name);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // For development, provide the verification link
      console.log('Development verification link:', `${process.env.BASE_URL}/api/auth/verify-email/${verificationToken}`);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        // For development only
        development_verification_url: `${process.env.BASE_URL}/api/auth/verify-email/${verificationToken}`
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

// Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with the verification token
    const user = await User.findOne({
      where: {
        verification_token: token,
        verification_token_expires: {
          [Op.gt]: Date.now()
        }
      }
    });

    if (!user) {
      // For browser requests, redirect to error page
      if (!req.originalUrl.startsWith('/api/')) {
        return res.redirect('/verification-error');
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Mark email as verified
    user.is_email_verified = true;
    user.verification_token = null;
    user.verification_token_expires = null;
    await user.save();

    // Generate token
    const jwtToken = generateToken(user.user_id);

    // For API verification
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        token: jwtToken
      });
    }

    // For browser verification - redirect to success page
    res.redirect('/verification-success');
  } catch (error) {
    console.error('Email verification error:', error);
    // For browser requests, redirect to error page
    if (!req.originalUrl.startsWith('/api/')) {
      return res.redirect('/verification-error');
    }
    res.status(500).json({
      success: false,
      message: 'Error verifying email',
      error: error.message
    });
  }
};

// Login - Initial phase (password check)
exports.loginInitiate = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if email is verified
    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Please verify your email first.'
      });
    }

    // Check password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate login OTP
    const otp = user.generateLoginOTP();
    await user.save();

    // Try to send login OTP email
    try {
      await sendLoginOTPEmail(email, otp, user.first_name);
    } catch (emailError) {
      console.error('Error sending login OTP email:', emailError);
      // For development purposes, print the OTP to console
      console.log('Development login OTP for testing:', otp);
    }

    res.status(200).json({
      success: true,
      message: 'Password verified. Please enter the OTP sent to your email.',
      email: user.email,
      // For development only
      development_otp: otp
    });
  } catch (error) {
    console.error('Login initiate error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating login',
      error: error.message
    });
  }
};

// Login - Second phase (OTP verification)
exports.loginVerify = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if OTP is expired
    if (user.login_otp_expiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // Check if OTP is correct
    if (user.login_otp !== otp) {
      // Increment OTP attempts
      user.login_otp_attempts += 1;
      await user.save();

      // Check if max attempts reached
      if (user.login_otp_attempts >= 3) {
        // Reset OTP
        user.login_otp = null;
        user.login_otp_expiry = null;
        user.login_otp_attempts = 0;
        await user.save();

        return res.status(400).json({
          success: false,
          message: 'Maximum OTP attempts reached. Please login again.'
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
        attempts_left: 3 - user.login_otp_attempts
      });
    }

    // Reset OTP fields
    user.login_otp = null;
    user.login_otp_expiry = null;
    user.login_otp_attempts = 0;
    await user.save();

    // Generate token
    const token = generateToken(user.user_id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        id: user.user_id,
        email: user.email,
        name: user.first_name + " " + user.last_name,
        is_email_verified: user.is_email_verified
      }
    });
  } catch (error) {
    console.error('Login verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying login OTP',
      error: error.message
    });
  }
};

// Resend verification email
exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already verified
    if (user.is_email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Generate new verification token
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Try to send verification email
    try {
      await sendVerificationEmail(email, verificationToken, user.first_name);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // For development, provide the verification link
      console.log('Development verification link:', `${process.env.BASE_URL}/api/auth/verify-email/${verificationToken}`);
    }

    res.status(200).json({
      success: true,
      message: 'Verification email resent successfully',
      // For development only
      development_verification_url: `${process.env.BASE_URL}/api/auth/verify-email/${verificationToken}`
    });
  } catch (error) {
    console.error('Resend verification email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending verification email',
      error: error.message
    });
  }
};

// Resend login OTP
exports.resendLoginOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate new OTP
    const otp = user.generateLoginOTP();
    await user.save();

    // Try to send login OTP email
    try {
      await sendLoginOTPEmail(email, otp, user.first_name);
    } catch (emailError) {
      console.error('Error sending login OTP email:', emailError);
      // For development purposes, print the OTP to console
      console.log('Development login OTP for testing:', otp);
    }

    res.status(200).json({
      success: true,
      message: 'Login OTP resent successfully',
      // For development only
      development_otp: otp
    });
  } catch (error) {
    console.error('Resend login OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending login OTP',
      error: error.message
    });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate OTP for password reset (reusing login OTP fields)
    const otp = user.generateLoginOTP();
    await user.save();

    // Try to send password reset email
    try {
      await sendPasswordResetEmail(email, otp, user.first_name);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      // For development purposes, print the OTP to console
      console.log('Development password reset OTP for testing:', otp);
    }

    res.status(200).json({
      success: true,
      message: 'Password reset instructions sent to your email',
      // For development only
      development_otp: otp
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing forgot password request',
      error: error.message
    });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, new_password, confirm_password } = req.body;

    // Check if passwords match
    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if OTP is expired
    if (user.login_otp_expiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // Check if OTP is correct
    if (user.login_otp !== otp) {
      // Increment OTP attempts
      user.login_otp_attempts += 1;
      await user.save();

      // Check if max attempts reached
      if (user.login_otp_attempts >= 3) {
        // Reset OTP
        user.login_otp = null;
        user.login_otp_expiry = null;
        user.login_otp_attempts = 0;
        await user.save();

        return res.status(400).json({
          success: false,
          message: 'Maximum OTP attempts reached. Please request a new password reset.'
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
        attempts_left: 3 - user.login_otp_attempts
      });
    }

    // Update password
    user.password = new_password;
    user.login_otp = null;
    user.login_otp_expiry = null;
    user.login_otp_attempts = 0;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

