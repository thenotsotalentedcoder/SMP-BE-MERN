const express = require('express');
const router = express.Router();

const ParameterSubmissionController = require('../controllers/ParameterSubmissionController');
const ValidationMiddleware = require('../middleware/validation');
const {
  authenticateToken,
  authorize,
  requireCycleAccess,
  requireYearAccess,
  requireSubmissionPermission,
  requireDepartmentAccess,
  requireFacultyAccess,
  UserRoles
} = require('../middleware/auth');

// Parameter Submission Routes - Dual Submission System
// 🎯 PURPOSE: Complete submission workflow with projected/actual values and approval system

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/submissions
 * @desc    Get submissions with advanced filtering
 * @access  Private (All authenticated users with appropriate access)
 * @query   cycleId, parameterId, userId, submissionYear, submissionType, approvalStatus,
 *          performanceStatus, latestOnly, page, limit, sortBy, sortOrder
 */
router.get('/',
  ValidationMiddleware.buildValidationChain(['pagination', 'filters']),
  ParameterSubmissionController.getSubmissions
);

/**
 * @route   GET /api/submissions/:id
 * @desc    Get single submission details
 * @access  Private (Submission owner, department/faculty heads, or admin)
 * @params  id - Submission ID
 * @query   includeHistory
 */
router.get('/:id',
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ParameterSubmissionController.getSubmissionById
);

/**
 * @route   GET /api/submissions/user/:userId/cycle/:cycleId
 * @desc    Get user's submissions for a cycle
 * @access  Private (Own submissions or authorized viewers)
 * @params  userId - User ID, cycleId - Cycle ID
 * @query   year, submissionType
 */
router.get('/user/:userId/cycle/:cycleId',
  requireCycleAccess('cycleId'),
  ValidationMiddleware.buildValidationChain(['filters']),
  ParameterSubmissionController.getUserSubmissions
);

/**
 * @route   GET /api/submissions/cycle/:cycleId/analytics
 * @desc    Get performance analytics for cycle submissions
 * @access  Private (Dean, VC, PVC, Admin)
 * @params  cycleId - Cycle ID
 * @query   year
 */
router.get('/cycle/:cycleId/analytics',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  requireCycleAccess('cycleId'),
  ValidationMiddleware.buildValidationChain(['filters']),
  ParameterSubmissionController.getPerformanceAnalytics
);

// Submission creation and management
/**
 * @route   POST /api/submissions
 * @desc    Create new submission
 * @access  Private (Users with submission permissions)
 * @body    parameterId, cycleId, submissionYear, submissionType, submittedValue,
 *          evidence, remarks, submissionNotes
 */
router.post('/',
  ValidationMiddleware.validateComplexSubmission(),
  ValidationMiddleware.handleValidationErrors,
  requireCycleAccess(),
  requireYearAccess(),
  async (req, res, next) => {
    // Dynamic submission permission check based on submission type
    const { submissionType } = req.body;
    const permissionCheck = requireSubmissionPermission(submissionType, 'create');
    return permissionCheck(req, res, next);
  },
  ParameterSubmissionController.createSubmission
);

/**
 * @route   PUT /api/submissions/:id
 * @desc    Update existing submission
 * @access  Private (Submission owner with edit permissions)
 * @params  id - Submission ID
 * @body    submittedValue, evidence, remarks, submissionNotes
 */
router.put('/:id',
  ValidationMiddleware.validateUpdateSubmission(),
  ValidationMiddleware.handleValidationErrors,
  requireSubmissionPermission('edit'),
  ParameterSubmissionController.updateSubmission
);

/**
 * @route   POST /api/submissions/:id/submit
 * @desc    Submit for approval
 * @access  Private (Submission owner)
 * @params  id - Submission ID
 */
router.post('/:id/submit',
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ParameterSubmissionController.submitForApproval
);

/**
 * @route   POST /api/submissions/:id/approve
 * @desc    Approve submission
 * @access  Private (Dean, VC, PVC, Admin)
 * @params  id - Submission ID
 * @body    notes
 */
router.post('/:id/approve',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.validateApprovalAction(),
  ValidationMiddleware.handleValidationErrors,
  requireSubmissionPermission('any', 'approve'),
  ParameterSubmissionController.approveSubmission
);

/**
 * @route   POST /api/submissions/:id/reject
 * @desc    Reject submission
 * @access  Private (Dean, VC, PVC, Admin)
 * @params  id - Submission ID
 * @body    reason
 */
router.post('/:id/reject',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  requireSubmissionPermission('any', 'approve'),
  ParameterSubmissionController.rejectSubmission
);

/**
 * @route   POST /api/submissions/:id/request-revision
 * @desc    Request revision for submission
 * @access  Private (Dean, VC, PVC, Admin)
 * @params  id - Submission ID
 * @body    revisionNotes
 */
router.post('/:id/request-revision',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.validateRevisionRequest(),
  ValidationMiddleware.handleValidationErrors,
  requireSubmissionPermission('any', 'approve'),
  ParameterSubmissionController.requestRevision
);

/**
 * @route   POST /api/submissions/:id/revise
 * @desc    Create revision of submission
 * @access  Private (Submission owner)
 * @params  id - Original submission ID
 * @body    revisionData, revisionReason
 */
router.post('/:id/revise',
  [
    ValidationMiddleware.validateUpdateSubmission(),
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  ParameterSubmissionController.createRevision
);

/**
 * @route   POST /api/submissions/:id/flag
 * @desc    Flag submission for review
 * @access  Private (Dean, VC, PVC, Admin)
 * @params  id - Submission ID
 * @body    reason
 */
router.post('/:id/flag',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  ParameterSubmissionController.flagSubmission
);

/**
 * @route   POST /api/submissions/:id/unflag
 * @desc    Remove flag from submission
 * @access  Private (Admin only)
 * @params  id - Submission ID
 */
router.post('/:id/unflag',
  authorize(UserRoles.Admin),
  async (req, res) => {
    try {
      const { id } = req.params;

      const ParameterSubmission = require('../models/ParameterSubmission');
      const submission = await ParameterSubmission.findOne({ _id: id, deletedAt: null });

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      await submission.unflag(req.user?.id);

      res.status(200).json({
        success: true,
        message: 'Submission unflagged successfully',
        data: {
          id: submission._id,
          isFlagged: submission.isFlagged
        }
      });

    } catch (error) {
      console.error('Error unflagging submission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unflag submission',
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/submissions/:id
 * @desc    Soft delete submission
 * @access  Private (Submission owner or Admin)
 * @params  id - Submission ID
 * @body    reason
 */
router.delete('/:id',
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ParameterSubmissionController.deleteSubmission
);

// Bulk operations
/**
 * @route   POST /api/submissions/bulk/approve
 * @desc    Bulk approve submissions
 * @access  Private (Dean, VC, PVC, Admin)
 * @body    submissionIds, notes
 */
router.post('/bulk/approve',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { submissionIds, notes } = req.body;

      if (!submissionIds || !Array.isArray(submissionIds)) {
        return res.status(400).json({
          success: false,
          message: 'Submission IDs array is required'
        });
      }

      const results = {
        successful: [],
        failed: [],
        totalProcessed: 0
      };

      const ParameterSubmission = require('../models/ParameterSubmission');

      for (const submissionId of submissionIds) {
        try {
          const submission = await ParameterSubmission.findOne({
            _id: submissionId,
            deletedAt: null
          });

          if (submission && submission.approvalStatus === 'pending') {
            await submission.approve(req.user?.id, notes);
            results.successful.push({
              submissionId,
              approvedAt: submission.approvedAt
            });
          } else {
            results.failed.push({
              submissionId,
              error: submission ? 'Not pending approval' : 'Submission not found'
            });
          }
        } catch (error) {
          results.failed.push({
            submissionId,
            error: error.message
          });
        }
        results.totalProcessed++;
      }

      res.status(200).json({
        success: true,
        message: 'Bulk approval completed',
        data: results
      });

    } catch (error) {
      console.error('Error in bulk approve:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk approval',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/submissions/bulk/reject
 * @desc    Bulk reject submissions
 * @access  Private (Dean, VC, PVC, Admin)
 * @body    submissionIds, reason
 */
router.post('/bulk/reject',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { submissionIds, reason } = req.body;

      if (!submissionIds || !Array.isArray(submissionIds) || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Submission IDs array and reason are required'
        });
      }

      const results = {
        successful: [],
        failed: [],
        totalProcessed: 0
      };

      const ParameterSubmission = require('../models/ParameterSubmission');

      for (const submissionId of submissionIds) {
        try {
          const submission = await ParameterSubmission.findOne({
            _id: submissionId,
            deletedAt: null
          });

          if (submission && submission.approvalStatus === 'pending') {
            await submission.reject(req.user?.id, reason);
            results.successful.push({
              submissionId,
              rejectedAt: submission.approvedAt
            });
          } else {
            results.failed.push({
              submissionId,
              error: submission ? 'Not pending approval' : 'Submission not found'
            });
          }
        } catch (error) {
          results.failed.push({
            submissionId,
            error: error.message
          });
        }
        results.totalProcessed++;
      }

      res.status(200).json({
        success: true,
        message: 'Bulk rejection completed',
        data: results
      });

    } catch (error) {
      console.error('Error in bulk reject:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk rejection',
        error: error.message
      });
    }
  }
);

// Advanced querying and filtering routes
/**
 * @route   GET /api/submissions/pending/count
 * @desc    Get count of pending submissions
 * @access  Private (Dean, VC, PVC, Admin)
 * @query   cycleId, departmentId, facultyId
 */
router.get('/pending/count',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['filters']),
  async (req, res) => {
    try {
      const { cycleId, departmentId, facultyId } = req.query;

      const ParameterSubmission = require('../models/ParameterSubmission');
      const User = require('../models/User');

      let filter = {
        approvalStatus: 'pending',
        deletedAt: null
      };

      if (cycleId) filter.cycleId = parseInt(cycleId);

      // Apply department/faculty filtering if not admin
      if (req.user.role !== 'Admin') {
        let userIds = [];

        if (departmentId || req.user.role === 'Chairman') {
          const deptId = departmentId || req.user.deptId;
          const deptUsers = await User.find({ deptId, isActive: true }, '_id');
          userIds = deptUsers.map(u => u._id);
        } else if (facultyId || req.user.role === 'Dean') {
          const facId = facultyId || req.user.facultyId;
          const facUsers = await User.find({ facultyId: facId, isActive: true }, '_id');
          userIds = facUsers.map(u => u._id);
        }

        if (userIds.length > 0) {
          filter.userId = { $in: userIds };
        }
      }

      const count = await ParameterSubmission.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          pendingCount: count,
          filters: { cycleId, departmentId, facultyId }
        }
      });

    } catch (error) {
      console.error('Error getting pending count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending submissions count',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/submissions/overdue
 * @desc    Get overdue submissions
 * @access  Private (Dean, VC, PVC, Admin)
 * @query   cycleId, days
 */
router.get('/overdue',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['filters']),
  async (req, res) => {
    try {
      const { cycleId, days = 7 } = req.query;

      const ParameterSubmission = require('../models/ParameterSubmission');
      const cutoffDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

      let filter = {
        status: 'draft',
        'submissionTimeline.deadlineDate': { $lt: cutoffDate },
        deletedAt: null
      };

      if (cycleId) filter.cycleId = parseInt(cycleId);

      const overdueSubmissions = await ParameterSubmission.find(filter)
        .populate('parameterId', 'name')
        .populate('userId', 'firstName lastName userName deptId facultyId')
        .populate('cycleId', 'name')
        .sort({ 'submissionTimeline.deadlineDate': 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          overdueSubmissions,
          count: overdueSubmissions.length,
          cutoffDate
        }
      });

    } catch (error) {
      console.error('Error getting overdue submissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get overdue submissions',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/submissions/statistics/summary
 * @desc    Get submission statistics summary
 * @access  Private (Dean, VC, PVC, Admin)
 * @query   cycleId, year, timeframe
 */
router.get('/statistics/summary',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['filters', 'analytics']),
  async (req, res) => {
    try {
      const { cycleId, year, timeframe = 30 } = req.query;

      const ParameterSubmission = require('../models/ParameterSubmission');

      let filter = { deletedAt: null };
      if (cycleId) filter.cycleId = parseInt(cycleId);
      if (year) filter.submissionYear = parseInt(year);

      // Time-based filtering
      const startDate = new Date(Date.now() - parseInt(timeframe) * 24 * 60 * 60 * 1000);
      filter['submissionTimeline.finalSubmittedAt'] = { $gte: startDate };

      const [
        totalSubmissions,
        approvedSubmissions,
        pendingSubmissions,
        rejectedSubmissions,
        projectedSubmissions,
        actualSubmissions,
        flaggedSubmissions
      ] = await Promise.all([
        ParameterSubmission.countDocuments(filter),
        ParameterSubmission.countDocuments({ ...filter, approvalStatus: 'approved' }),
        ParameterSubmission.countDocuments({ ...filter, approvalStatus: 'pending' }),
        ParameterSubmission.countDocuments({ ...filter, approvalStatus: 'rejected' }),
        ParameterSubmission.countDocuments({ ...filter, submissionType: 'projected' }),
        ParameterSubmission.countDocuments({ ...filter, submissionType: 'actual' }),
        ParameterSubmission.countDocuments({ ...filter, isFlagged: true })
      ]);

      const summary = {
        total: totalSubmissions,
        byStatus: {
          approved: approvedSubmissions,
          pending: pendingSubmissions,
          rejected: rejectedSubmissions,
          flagged: flaggedSubmissions
        },
        byType: {
          projected: projectedSubmissions,
          actual: actualSubmissions
        },
        metrics: {
          approvalRate: totalSubmissions > 0 ? Math.round((approvedSubmissions / totalSubmissions) * 100) : 0,
          pendingRate: totalSubmissions > 0 ? Math.round((pendingSubmissions / totalSubmissions) * 100) : 0,
          actualSubmissionRate: totalSubmissions > 0 ? Math.round((actualSubmissions / totalSubmissions) * 100) : 0
        },
        timeframe: parseInt(timeframe),
        generatedAt: new Date()
      };

      res.status(200).json({
        success: true,
        data: summary
      });

    } catch (error) {
      console.error('Error getting submission statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get submission statistics',
        error: error.message
      });
    }
  }
);

module.exports = router;