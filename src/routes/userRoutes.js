const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { authenticateToken } = require('../middleware/auth');

// User routes (exact .NET API paths) - All require authentication
router.get('/get-current-user', authenticateToken, UserController.getCurrentUser);
router.get('/get-all-users', authenticateToken, UserController.getAllUsers);

module.exports = router;