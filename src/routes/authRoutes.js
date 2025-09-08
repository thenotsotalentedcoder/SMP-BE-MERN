const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthenticationController');

// Authentication routes (exact .NET API paths)
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.post('/register-admin', AuthController.registerAdmin);
router.post('/update-password', AuthController.updatePassword);
router.post('/update-user/:username', AuthController.updateUser);
router.get('/generate-role', AuthController.generateRole);

module.exports = router;