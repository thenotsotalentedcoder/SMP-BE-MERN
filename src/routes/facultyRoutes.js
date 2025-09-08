const express = require('express');
const router = express.Router();
const FacultyController = require('../controllers/FacultyController');
const { authenticateToken } = require('../middleware/auth');

// Faculty routes (exact .NET API paths) - All require authentication
router.get('/', authenticateToken, FacultyController.getFaculties);
router.get('/:id', authenticateToken, FacultyController.getFaculty);
router.post('/', authenticateToken, FacultyController.createFaculty);
router.put('/:id', authenticateToken, FacultyController.updateFaculty); // MISSING
router.delete('/:id', authenticateToken, FacultyController.deleteFaculty);

module.exports = router;