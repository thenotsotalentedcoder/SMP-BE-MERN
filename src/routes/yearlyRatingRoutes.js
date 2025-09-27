const express = require('express');
const router = express.Router();
const YearlyRatingController = require('../controllers/YearlyRatingController');
const { authenticateToken } = require('../middleware/auth');

// YearlyRating routes (exact .NET API paths) - All require authentication
router.post('/', authenticateToken, YearlyRatingController.submitRatings);

// ➕ NEW: Individual parameter submission route
router.post('/submit-parameter', authenticateToken, YearlyRatingController.submitIndividualParameter);

router.get('/all', authenticateToken, YearlyRatingController.getAllRatings); // New route for ratings report
router.get('/by-parameter/:parameterId', authenticateToken, YearlyRatingController.getRatingsByParameter); // New route for parameter ratings
router.get('/', authenticateToken, YearlyRatingController.getPastRatings);
router.get('/by-department/:deptID', authenticateToken, YearlyRatingController.getRatingsByDepartment);

module.exports = router;