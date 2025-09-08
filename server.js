const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/category', require('./src/routes/categoryRoutes'));
app.use('/api/parameters', require('./src/routes/parameterRoutes'));
app.use('/api/faculty', require('./src/routes/facultyRoutes'));
app.use('/api/departments', require('./src/routes/departmentRoutes'));
app.use('/api/yearly-rating', require('./src/routes/yearlyRatingRoutes'));

// Basic health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'SMP Backend API - MERN Stack', 
    version: '1.0.0',
    status: 'running',
    database: 'MongoDB Atlas - SMPDB'
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