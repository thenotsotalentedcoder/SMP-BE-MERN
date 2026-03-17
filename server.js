const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Legacy Routes (preserved for backward compatibility)
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/category', require('./src/routes/categoryRoutes'));
app.use('/api/parameters', require('./src/routes/parameterRoutes'));
app.use('/api/faculty', require('./src/routes/facultyRoutes'));
app.use('/api/departments', require('./src/routes/departmentRoutes'));
app.use('/api/yearly-rating', require('./src/routes/yearlyRatingRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));

// ✨ Enhanced Dynamic Cycle Management Routes
app.use('/api/cycles', require('./src/routes/cycleRoutes'));
app.use('/api/target-edit-requests', require('./src/routes/targetEditRequestRoutes'));
app.use('/api/parameter-cycles', require('./src/routes/parameterCycleRoutes'));
app.use('/api/submissions', require('./src/routes/submissionRoutes'));
app.use('/api/user-access', require('./src/routes/userCycleAccessRoutes'));
app.use('/api/analytics', require('./src/routes/analyticsRoutes'));

// Basic health check
app.get('/', (req, res) => {
  res.json({
    message: 'SMP Backend API - Enhanced with Dynamic Cycle Management',
    version: '2.0.0',
    status: 'running',
    database: 'MongoDB Atlas - SMPDB',
    features: [
      'Dynamic Cycle Management',
      'Progressive Year Activation',
      'Parameter Inheritance',
      'Dual Submission System (Projected/Actual)',
      'Advanced Analytics & Reporting',
      'Role-based Access Control',
      'Real-time Dashboard'
    ],
    apiEndpoints: {
      legacy: [
        '/api/auth',
        '/api/users',
        '/api/category',
        '/api/parameters',
        '/api/faculty',
        '/api/departments',
        '/api/yearly-rating',
        '/api/dashboard'
      ],
      enhanced: [
        '/api/cycles',
        '/api/parameter-cycles',
        '/api/submissions',
        '/api/user-access',
        '/api/analytics'
      ]
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    Status: false,
    Message: `Internal server error: ${err.message}`
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    Status: false,
    Message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`✅ SMP Backend Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 CORS Origin: ${process.env.CORS_ORIGIN}`);
  console.log(`📊 Database: MongoDB Atlas - SMPDB`);
});