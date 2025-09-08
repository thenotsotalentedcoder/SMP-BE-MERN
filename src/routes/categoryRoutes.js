const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/CategoryController');
const { authenticateToken } = require('../middleware/auth');

// Category routes (exact .NET API paths) - All require authentication
router.get('/', authenticateToken, CategoryController.getCategories);
router.get('/:id', authenticateToken, CategoryController.getCategory);
router.post('/', authenticateToken, CategoryController.createCategory);
router.put('/:id', authenticateToken, CategoryController.updateCategory);
router.delete('/:id', authenticateToken, CategoryController.deleteCategory);

module.exports = router;