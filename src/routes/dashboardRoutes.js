const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const { authenticateToken } = require('../middleware/auth');

// Dashboard routes - All require authentication
router.get('/statistics', authenticateToken, DashboardController.getDashboardStatistics);
router.get('/overview', authenticateToken, DashboardController.getDashboardOverview);

module.exports = router;