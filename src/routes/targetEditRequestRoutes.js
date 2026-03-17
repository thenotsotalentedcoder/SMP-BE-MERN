const express = require('express');
const router = express.Router();
const TargetEditRequestController = require('../controllers/TargetEditRequestController');
const { authenticateToken, authorize } = require('../middleware/auth');

// User: submit edit request
router.post('/', authenticateToken, TargetEditRequestController.createRequest);

// User: get their own requests for a parameter
router.get('/my', authenticateToken, TargetEditRequestController.getMyRequests);

// Admin: get all requests
router.get('/', authenticateToken, authorize('Admin'), TargetEditRequestController.getAllRequests);

// Admin: approve request
router.put('/:id/approve', authenticateToken, authorize('Admin'), TargetEditRequestController.approveRequest);

// Admin: reject request
router.put('/:id/reject', authenticateToken, authorize('Admin'), TargetEditRequestController.rejectRequest);

module.exports = router;
