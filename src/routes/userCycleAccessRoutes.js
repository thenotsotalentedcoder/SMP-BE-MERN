const express = require('express');
const router = express.Router();

const UserCycleAccessController = require('../controllers/UserCycleAccessController');
const ValidationMiddleware = require('../middleware/validation');
const {
  authenticateToken,
  authorize,
  requireCycleAccess,
  UserRoles
} = require('../middleware/auth');

// User Cycle Access Management Routes
// 🎯 PURPOSE: Manage user access to cycles, permissions, and activity tracking

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/user-access/:userId
 * @desc    Get user's cycle access information
 * @access  Private (Own access or Admin)
 * @params  userId - User ID
 */
router.get('/:userId',
  ValidationMiddleware.buildValidationChain(['sanitize']),
  UserCycleAccessController.getUserCycleAccess
);

/**
 * @route   GET /api/user-access/:userId/activity
 * @desc    Get user activity summary
 * @access  Private (Own activity or Admin)
 * @params  userId - User ID
 * @query   cycleId, days
 */
router.get('/:userId/activity',
  ValidationMiddleware.buildValidationChain(['filters', 'analytics']),
  UserCycleAccessController.getUserActivitySummary
);

/**
 * @route   GET /api/user-access/:userId/history
 * @desc    Get access history for user
 * @access  Private (Own history or Admin)
 * @params  userId - User ID
 * @query   cycleId, limit
 */
router.get('/:userId/history',
  ValidationMiddleware.buildValidationChain(['pagination', 'filters']),
  UserCycleAccessController.getAccessHistory
);

/**
 * @route   GET /api/user-access/cycle/:cycleId/users
 * @desc    Get users by cycle
 * @access  Private (Dean, VC, PVC, Admin)
 * @params  cycleId - Cycle ID
 * @query   includeActivity, activeOnly
 */
router.get('/cycle/:cycleId/users',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  requireCycleAccess('cycleId'),
  ValidationMiddleware.buildValidationChain(['filters']),
  UserCycleAccessController.getUsersByCycle
);

// Admin-only routes for access management
/**
 * @route   POST /api/user-access/:userId/grant
 * @desc    Grant cycle access to user
 * @access  Private (Admin only)
 * @params  userId - User ID
 * @body    cycleId, year, accessLevel, permissions
 */
router.post('/:userId/grant',
  authorize(UserRoles.Admin),
  ValidationMiddleware.validateGrantCycleAccess(),
  ValidationMiddleware.handleValidationErrors,
  UserCycleAccessController.grantCycleAccess
);

/**
 * @route   POST /api/user-access/:userId/revoke
 * @desc    Revoke cycle access from user
 * @access  Private (Admin only)
 * @params  userId - User ID
 * @body    cycleId, reason
 */
router.post('/:userId/revoke',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  UserCycleAccessController.revokeCycleAccess
);

/**
 * @route   PUT /api/user-access/:userId/permissions
 * @desc    Update user permissions
 * @access  Private (Admin only)
 * @params  userId - User ID
 * @body    permissions
 */
router.put('/:userId/permissions',
  authorize(UserRoles.Admin),
  ValidationMiddleware.validateUpdatePermissions(),
  ValidationMiddleware.handleValidationErrors,
  UserCycleAccessController.updateUserPermissions
);

/**
 * @route   PUT /api/user-access/:userId/submission-access
 * @desc    Update submission access settings
 * @access  Private (Admin only)
 * @params  userId - User ID
 * @body    submissionAccess
 */
router.put('/:userId/submission-access',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  UserCycleAccessController.updateSubmissionAccess
);

/**
 * @route   POST /api/user-access/:userId/activity
 * @desc    Record user activity
 * @access  Private (Own activity only)
 * @params  userId - User ID
 * @body    cycleId, year
 */
router.post('/:userId/activity',
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  UserCycleAccessController.recordUserActivity
);

// Bulk operations
/**
 * @route   POST /api/user-access/bulk/update
 * @desc    Bulk update user cycle access
 * @access  Private (Admin only)
 * @body    userIds, cycleId, year, accessLevel, permissions, action
 */
router.post('/bulk/update',
  authorize(UserRoles.Admin),
  ValidationMiddleware.validateBulkOperation(),
  ValidationMiddleware.handleValidationErrors,
  UserCycleAccessController.bulkUpdateCycleAccess
);

/**
 * @route   POST /api/user-access/bulk/grant-by-role
 * @desc    Bulk grant access by user role
 * @access  Private (Admin only)
 * @body    role, cycleId, year, accessLevel, permissions
 */
router.post('/bulk/grant-by-role',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { role, cycleId, year, accessLevel = 'write', permissions = {} } = req.body;

      if (!role || !cycleId) {
        return res.status(400).json({
          success: false,
          message: 'Role and Cycle ID are required'
        });
      }

      const User = require('../models/User');
      const users = await User.find({
        userRole: role,
        isActive: true,
        deletedAt: null
      });

      const userIds = users.map(u => u._id);

      // Use existing bulk update functionality
      req.body = {
        userIds,
        cycleId,
        year,
        accessLevel,
        permissions,
        action: 'grant'
      };

      return UserCycleAccessController.bulkUpdateCycleAccess(req, res);

    } catch (error) {
      console.error('Error in bulk grant by role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to grant access by role',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/user-access/bulk/grant-by-department
 * @desc    Bulk grant access by department
 * @access  Private (Admin only)
 * @body    departmentId, cycleId, year, accessLevel, permissions
 */
router.post('/bulk/grant-by-department',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { departmentId, cycleId, year, accessLevel = 'write', permissions = {} } = req.body;

      if (!departmentId || !cycleId) {
        return res.status(400).json({
          success: false,
          message: 'Department ID and Cycle ID are required'
        });
      }

      const User = require('../models/User');
      const users = await User.find({
        deptId: parseInt(departmentId),
        isActive: true,
        deletedAt: null
      });

      const userIds = users.map(u => u._id);

      req.body = {
        userIds,
        cycleId,
        year,
        accessLevel,
        permissions,
        action: 'grant'
      };

      return UserCycleAccessController.bulkUpdateCycleAccess(req, res);

    } catch (error) {
      console.error('Error in bulk grant by department:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to grant access by department',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/user-access/bulk/grant-by-faculty
 * @desc    Bulk grant access by faculty
 * @access  Private (Admin only)
 * @body    facultyId, cycleId, year, accessLevel, permissions
 */
router.post('/bulk/grant-by-faculty',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { facultyId, cycleId, year, accessLevel = 'write', permissions = {} } = req.body;

      if (!facultyId || !cycleId) {
        return res.status(400).json({
          success: false,
          message: 'Faculty ID and Cycle ID are required'
        });
      }

      const User = require('../models/User');
      const users = await User.find({
        facultyId: parseInt(facultyId),
        isActive: true,
        deletedAt: null
      });

      const userIds = users.map(u => u._id);

      req.body = {
        userIds,
        cycleId,
        year,
        accessLevel,
        permissions,
        action: 'grant'
      };

      return UserCycleAccessController.bulkUpdateCycleAccess(req, res);

    } catch (error) {
      console.error('Error in bulk grant by faculty:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to grant access by faculty',
        error: error.message
      });
    }
  }
);

// Analytics and reporting routes
/**
 * @route   GET /api/user-access/analytics/access-summary
 * @desc    Get user access analytics summary
 * @access  Private (Admin only)
 * @query   cycleId, timeframe, groupBy
 */
router.get('/analytics/access-summary',
  authorize(UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['filters', 'analytics']),
  async (req, res) => {
    try {
      const { cycleId, timeframe = 30, groupBy = 'role' } = req.query;

      const User = require('../models/User');
      let filter = { deletedAt: null, isActive: true };

      if (cycleId) {
        filter['cycleAccess.currentCycleId'] = parseInt(cycleId);
      }

      const users = await User.find(filter)
        .populate('deptId', 'name')
        .populate('facultyId', 'name')
        .lean();

      const summary = {
        totalUsers: users.length,
        usersWithAccess: users.filter(u => u.cycleAccess?.currentCycleId).length,
        breakdown: {}
      };

      // Group by specified field
      if (groupBy === 'role') {
        summary.breakdown = users.reduce((acc, user) => {
          const role = user.userRole || 'Unknown';
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        }, {});
      } else if (groupBy === 'department') {
        summary.breakdown = users.reduce((acc, user) => {
          const dept = user.deptId?.name || 'Unknown';
          acc[dept] = (acc[dept] || 0) + 1;
          return acc;
        }, {});
      } else if (groupBy === 'faculty') {
        summary.breakdown = users.reduce((acc, user) => {
          const faculty = user.facultyId?.name || 'Unknown';
          acc[faculty] = (acc[faculty] || 0) + 1;
          return acc;
        }, {});
      }

      // Activity metrics
      const activeUsers = users.filter(u => {
        const lastActive = u.activityTracking?.lastActiveAt;
        if (!lastActive) return false;
        const daysSince = (new Date() - new Date(lastActive)) / (1000 * 60 * 60 * 24);
        return daysSince <= parseInt(timeframe);
      });

      summary.activityMetrics = {
        activeUsers: activeUsers.length,
        inactiveUsers: users.length - activeUsers.length,
        activityRate: users.length > 0 ? Math.round((activeUsers.length / users.length) * 100) : 0
      };

      res.status(200).json({
        success: true,
        data: summary
      });

    } catch (error) {
      console.error('Error getting access summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get access summary',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/user-access/analytics/activity-report
 * @desc    Get user activity report
 * @access  Private (Admin only)
 * @query   cycleId, startDate, endDate, includeInactive
 */
router.get('/analytics/activity-report',
  authorize(UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['dateRange', 'filters']),
  async (req, res) => {
    try {
      const { cycleId, startDate, endDate, includeInactive = false } = req.query;

      const User = require('../models/User');
      let filter = { deletedAt: null };

      if (includeInactive === 'false') {
        filter.isActive = true;
      }

      if (cycleId) {
        filter['cycleAccess.currentCycleId'] = parseInt(cycleId);
      }

      const users = await User.find(filter)
        .populate('cycleAccess.currentCycleId', 'name')
        .populate('deptId', 'name')
        .populate('facultyId', 'name')
        .lean();

      // Filter by date range if provided
      let filteredUsers = users;
      if (startDate || endDate) {
        filteredUsers = users.filter(user => {
          const lastActive = user.activityTracking?.lastActiveAt;
          if (!lastActive) return false;

          const activeDate = new Date(lastActive);
          if (startDate && activeDate < new Date(startDate)) return false;
          if (endDate && activeDate > new Date(endDate)) return false;
          return true;
        });
      }

      const report = {
        reportPeriod: {
          startDate: startDate || 'All time',
          endDate: endDate || 'Present',
          cycleId: cycleId || 'All cycles'
        },
        userActivity: filteredUsers.map(user => ({
          userId: user._id,
          userName: user.userName,
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          role: user.userRole,
          department: user.deptId?.name,
          faculty: user.facultyId?.name,
          currentCycle: user.cycleAccess?.currentCycleId?.name,
          lastActiveAt: user.activityTracking?.lastActiveAt,
          totalLogins: user.activityTracking?.totalLogins || 0,
          totalSubmissions: user.activityTracking?.totalSubmissions || 0,
          isCurrentlyActive: user.isCurrentlyActive,
          daysSinceLastLogin: user.daysSinceLastLogin
        })),
        summary: {
          totalUsers: filteredUsers.length,
          usersWithActivity: filteredUsers.filter(u => u.activityTracking?.lastActiveAt).length,
          averageLogins: filteredUsers.reduce((sum, u) => sum + (u.activityTracking?.totalLogins || 0), 0) / filteredUsers.length,
          averageSubmissions: filteredUsers.reduce((sum, u) => sum + (u.activityTracking?.totalSubmissions || 0), 0) / filteredUsers.length
        }
      };

      res.status(200).json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Error getting activity report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get activity report',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/user-access/audit/access-changes
 * @desc    Get audit trail of access changes
 * @access  Private (Admin only)
 * @query   userId, cycleId, startDate, endDate, limit
 */
router.get('/audit/access-changes',
  authorize(UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['dateRange', 'pagination', 'filters']),
  async (req, res) => {
    try {
      const { userId, cycleId, startDate, endDate, limit = 100 } = req.query;

      const User = require('../models/User');
      let filter = { deletedAt: null };

      if (userId) filter._id = parseInt(userId);

      const users = await User.find(filter)
        .populate('cycleAccess.accessHistory.cycleId', 'name')
        .populate('cycleAccess.accessHistory.grantedBy', 'firstName lastName userName')
        .populate('cycleAccess.accessHistory.revokedBy', 'firstName lastName userName')
        .lean();

      let allAccessChanges = [];

      users.forEach(user => {
        const accessHistory = user.cycleAccess?.accessHistory || [];

        accessHistory.forEach(access => {
          // Filter by cycle if specified
          if (cycleId && access.cycleId && access.cycleId._id !== parseInt(cycleId)) {
            return;
          }

          // Filter by date range
          if (startDate && access.accessGrantedAt && new Date(access.accessGrantedAt) < new Date(startDate)) {
            return;
          }
          if (endDate && access.accessGrantedAt && new Date(access.accessGrantedAt) > new Date(endDate)) {
            return;
          }

          allAccessChanges.push({
            userId: user._id,
            userName: user.userName,
            userFullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            action: access.isActive ? 'granted' : 'revoked',
            cycleId: access.cycleId?._id,
            cycleName: access.cycleId?.name,
            cycleYear: access.cycleYear,
            accessLevel: access.accessLevel,
            grantedAt: access.accessGrantedAt,
            revokedAt: access.accessRevokedAt,
            grantedBy: access.grantedBy,
            revokedBy: access.revokedBy,
            isActive: access.isActive
          });
        });
      });

      // Sort by date (newest first) and limit
      allAccessChanges = allAccessChanges
        .sort((a, b) => new Date(b.grantedAt || b.revokedAt) - new Date(a.grantedAt || a.revokedAt))
        .slice(0, parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          accessChanges: allAccessChanges,
          totalChanges: allAccessChanges.length,
          filters: { userId, cycleId, startDate, endDate }
        }
      });

    } catch (error) {
      console.error('Error getting access changes audit:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get access changes audit',
        error: error.message
      });
    }
  }
);

module.exports = router;