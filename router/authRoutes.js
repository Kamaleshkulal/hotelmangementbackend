const express = require('express');
const { 
  register, 
  verifyEmail,
  loginInitiate,
  loginVerify,
  resendVerificationEmail,
  resendLoginOTP,
  forgotPassword, 
  resetPassword 
} = require('../controller/authentication');

const router = express.Router();

// Registration routes
router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

// Login routes (two-factor with OTP)
router.post('/login-initiate', loginInitiate);
router.post('/login-verify', loginVerify);
router.post('/resend-login-otp', resendLoginOTP);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;