const express = require('express');
const router = express.Router();
const ParameterController = require('../controllers/ParameterController');
const { authenticateToken } = require('../middleware/auth');

// Parameter routes (exact .NET API paths) - All require authentication
router.get('/', authenticateToken, ParameterController.getParameters);
router.get('/cycles', authenticateToken, ParameterController.getCycles);
router.get('/by-category', authenticateToken, ParameterController.getParametersByCategory);
router.get('/:id', authenticateToken, ParameterController.getParameter);
router.post('/', authenticateToken, ParameterController.createParameter);
router.put('/:id', authenticateToken, ParameterController.updateParameter);
router.delete('/:id', authenticateToken, ParameterController.deleteParameter);

module.exports = router;