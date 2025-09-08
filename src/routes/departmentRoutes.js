const express = require('express');
const router = express.Router();
const DepartmentController = require('../controllers/DepartmentController');
const { authenticateToken } = require('../middleware/auth');

// Department routes (exact .NET API paths) - All require authentication
router.get('/', authenticateToken, DepartmentController.getDepartments);
router.get('/:id', authenticateToken, DepartmentController.getDepartment);
router.post('/', authenticateToken, DepartmentController.createDepartment);
router.put('/:id', authenticateToken, DepartmentController.updateDepartment); // MISSING
router.delete('/:id', authenticateToken, DepartmentController.deleteDepartment);

module.exports = router;