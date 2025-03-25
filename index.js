const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sequelize = require('./config/database');
const authRoutes = require('./router/authRoutes');

dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Hotel Management System API',
    version: '1.0.0',
    status: 'Sucessfully running',
    endpoints: {
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login-initiate',
        verifyLogin: 'POST /api/v1/auth/login-verify',
        verifyEmail: 'GET /api/v1/auth/verify-email/:token',
        resendVerification: 'POST /api/v1/auth/resend-verification',
        forgotPassword: 'POST /api/v1/auth/forgot-password',
        resetPassword: 'POST /api/v1/auth/reset-password'
      }
    }
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running'
  });
});

// Routes
app.use('/api/v1/auth', authRoutes);

// Verification success page
app.get('/verification-success', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Email Verified Successfully</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #4CAF50;
            margin-bottom: 1rem;
          }
          p {
            color: #666;
            margin-bottom: 2rem;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s;
          }
          .button:hover {
            background-color: #45a049;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Email Verified Successfully!</h1>
          <p>Your email has been verified. You can now log in to your account.</p>
          <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/login" class="button">Go to Login</a>
        </div>
      </body>
    </html>
  `);
});

// Verification error page
app.get('/verification-error', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Email Verification Failed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #f44336;
            margin-bottom: 1rem;
          }
          p {
            color: #666;
            margin-bottom: 2rem;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s;
          }
          .button:hover {
            background-color: #45a049;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Email Verification Failed</h1>
          <p>The verification link is invalid or has expired. Please request a new verification email.</p>
          <a href="${process.env.FRONTEND_URL || process.env.BASE_URL}/resend-verification" class="button">Request New Verification Email</a>
        </div>
      </body>
    </html>
  `);
});

// Sync database and start server
const PORT = process.env.PORT || 8000;

// Sync all models with database
sequelize.sync()
  .then(() => {
    console.log('Database connected!');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to sync database:', err);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION!  Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});