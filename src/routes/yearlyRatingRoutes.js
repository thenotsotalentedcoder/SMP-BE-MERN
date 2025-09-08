const express = require('express');
const router = express.Router();
const YearlyRatingController = require('../controllers/YearlyRatingController');
const { authenticateToken } = require('../middleware/auth');

// YearlyRating routes (exact .NET API paths) - All require authentication
router.post('/', authenticateToken, YearlyRatingController.submitRatings);
router.get('/', authenticateToken, YearlyRatingController.getPastRatings);
router.get('/by-department/:deptID', authenticateToken, YearlyRatingController.getRatingsByDepartment);

module.exports = router;