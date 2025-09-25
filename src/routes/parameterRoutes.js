const express = require('express');
const router = express.Router();
const ParameterController = require('../controllers/ParameterController');
const { authenticateToken } = require('../middleware/auth');

// Parameter routes (exact .NET API paths) - All require authentication
router.get('/', authenticateToken, ParameterController.getParameters);
router.get('/cycles', authenticateToken, ParameterController.getCycles);
router.get('/by-category', authenticateToken, ParameterController.getParametersByCategory);

// ➕ NEW: Group access control routes
router.get('/user-groups', authenticateToken, ParameterController.getUserGroups);
router.get('/accessible', authenticateToken, ParameterController.getAccessibleParameters);
router.get('/by-category/accessible', authenticateToken, ParameterController.getAccessibleParametersByCategory);

router.get('/:id', authenticateToken, ParameterController.getParameter);
router.post('/', authenticateToken, ParameterController.createParameter);
router.put('/:id', authenticateToken, ParameterController.updateParameter);
router.delete('/:id', authenticateToken, ParameterController.deleteParameter);

module.exports = router;