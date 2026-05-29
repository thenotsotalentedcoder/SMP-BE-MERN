const express = require('express');
const router = express.Router();
const YearlyRatingController = require('../controllers/YearlyRatingController');
const { authenticateToken } = require('../middleware/auth');

// YearlyRating routes (exact .NET API paths) - All require authentication
router.post('/', authenticateToken, YearlyRatingController.submitRatings);

// ➕ NEW: Individual parameter submission route
router.post('/submit-parameter', authenticateToken, YearlyRatingController.submitIndividualParameter);

// ➕ NEW: Submit target values for all cycle years (batch, immutable once saved)
router.post('/submit-targets', authenticateToken, YearlyRatingController.submitTargetValues);

router.get('/all', authenticateToken, YearlyRatingController.getAllRatings);
router.get('/export-matrix', authenticateToken, YearlyRatingController.getExportMatrix);
router.get('/by-parameter/:parameterId', authenticateToken, YearlyRatingController.getRatingsByParameter);
router.get('/', authenticateToken, YearlyRatingController.getPastRatings);
router.get('/by-department/:deptID', authenticateToken, YearlyRatingController.getRatingsByDepartment);

module.exports = router;