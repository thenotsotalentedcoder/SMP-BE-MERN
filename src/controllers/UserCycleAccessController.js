const User = require('../models/User');
const Cycle = require('../models/Cycle');
const ParameterSubmission = require('../models/ParameterSubmission');

// User Cycle Access Management Controller
// 🎯 PURPOSE: Manage user access to cycles, permissions, and activity tracking

class UserCycleAccessController {
  // Get user's cycle access information
  static async getUserCycleAccess(req, res) {
    try {
      const { userId } = req.params;

      // Access control - users can only view their own access or admins can view any
      if (parseInt(userId) !== req.user?.id && req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own cycle access'
        });
      }

      const user = await User.findOne({ _id: userId, deletedAt: null })
        .populate('cycleAccess.currentCycleId', 'name cycleName currentActiveYear targetYear')
        .populate('cycleAccess.accessHistory.cycleId', 'name cycleName')
        .populate('cycleAccess.accessHistory.grantedBy', 'firstName lastName userName')
        .populate('cycleAccess.accessHistory.revokedBy', 'firstName lastName userName');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const cycleAccess = {
        userId: user._id,
        userName: user.userName,
        fullName: user.fullName,
        role: user.userRole,
        currentCycleAccess: {
          cycleId: user.cycleAccess?.currentCycleId || null,
          cycleYear: user.cycleAccess?.currentCycleYear || null,
          cycle: user.cycleAccess?.currentCycleId ? user.cycleAccess.currentCycleId : null
        },
        permissions: user.cycleAccess?.permissions || {},
        submissionAccess: user.cycleAccess?.submissionAccess || {},
        accessHistory: user.cycleAccess?.accessHistory || [],
        activityTracking: user.activityTracking || {}
      };

      res.status(200).json({
        success: true,
        data: cycleAccess
      });

    } catch (error) {
      console.error('Error in getUserCycleAccess:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user cycle access',
        error: error.message
      });
    }
  }

  // Grant cycle access to user
  static async grantCycleAccess(req, res) {
    try {
      const { userId } = req.params;
      const { cycleId, year, accessLevel = 'write', permissions = {} } = req.body;

      // Only admins can grant cycle access
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can grant cycle access'
        });
      }

      if (!cycleId) {
        return res.status(400).json({
          success: false,
          message: 'Cycle ID is required'
        });
      }

      // Verify user and cycle exist
      const [user, cycle] = await Promise.all([
        User.findOne({ _id: userId, deletedAt: null }),
        Cycle.findOne({ _id: cycleId, deletedAt: null })
      ]);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      // Grant access
      const activeYear = year || cycle.currentActiveYear;
      await user.grantCycleAccess(cycleId, activeYear, req.user.id, accessLevel);

      // Update permissions if provided
      if (Object.keys(permissions).length > 0) {
        await user.updatePermissions(permissions, req.user.id);
      }

      res.status(200).json({
        success: true,
        message: 'Cycle access granted successfully',
        data: {
          userId: user._id,
          cycleId,
          year: activeYear,
          accessLevel,
          grantedAt: new Date(),
          grantedBy: req.user.id
        }
      });

    } catch (error) {
      console.error('Error in grantCycleAccess:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to grant cycle access',
        error: error.message
      });
    }
  }

  // Revoke cycle access from user
  static async revokeCycleAccess(req, res) {
    try {
      const { userId } = req.params;
      const { cycleId, reason } = req.body;

      // Only admins can revoke cycle access
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can revoke cycle access'
        });
      }

      if (!cycleId) {
        return res.status(400).json({
          success: false,
          message: 'Cycle ID is required'
        });
      }

      const user = await User.findOne({ _id: userId, deletedAt: null });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await user.revokeCycleAccess(cycleId, req.user.id, reason);

      res.status(200).json({
        success: true,
        message: 'Cycle access revoked successfully',
        data: {
          userId: user._id,
          cycleId,
          revokedAt: new Date(),
          revokedBy: req.user.id,
          reason
        }
      });

    } catch (error) {
      console.error('Error in revokeCycleAccess:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to revoke cycle access',
        error: error.message
      });
    }
  }

  // Update user permissions
  static async updateUserPermissions(req, res) {
    try {
      const { userId } = req.params;
      const { permissions } = req.body;

      // Only admins can update permissions
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can update user permissions'
        });
      }

      if (!permissions || typeof permissions !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Valid permissions object is required'
        });
      }

      const user = await User.findOne({ _id: userId, deletedAt: null });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await user.updatePermissions(permissions, req.user.id);

      res.status(200).json({
        success: true,
        message: 'User permissions updated successfully',
        data: {
          userId: user._id,
          permissions: user.cycleAccess.permissions,
          updatedAt: user.lastModifiedAt,
          updatedBy: req.user.id
        }
      });

    } catch (error) {
      console.error('Error in updateUserPermissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user permissions',
        error: error.message
      });
    }
  }

  // Update submission access settings
  static async updateSubmissionAccess(req, res) {
    try {
      const { userId } = req.params;
      const { submissionAccess } = req.body;

      // Only admins can update submission access
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can update submission access'
        });
      }

      if (!submissionAccess || typeof submissionAccess !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Valid submission access object is required'
        });
      }

      const user = await User.findOne({ _id: userId, deletedAt: null });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await user.updateSubmissionAccess(submissionAccess, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Submission access updated successfully',
        data: {
          userId: user._id,
          submissionAccess: user.cycleAccess.submissionAccess,
          updatedAt: user.lastModifiedAt,
          updatedBy: req.user.id
        }
      });

    } catch (error) {
      console.error('Error in updateSubmissionAccess:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update submission access',
        error: error.message
      });
    }
  }

  // Get users by cycle
  static async getUsersByCycle(req, res) {
    try {
      const { cycleId } = req.params;
      const { includeActivity = false, activeOnly = true } = req.query;

      // Verify cycle exists
      const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });
      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      // Build filter
      const filter = {
        'cycleAccess.currentCycleId': parseInt(cycleId),
        deletedAt: null
      };

      if (activeOnly === 'true') {
        filter.isActive = true;
      }

      const users = await User.find(filter)
        .select('_id userName firstName lastName userRole deptId facultyId cycleAccess activityTracking')
        .populate('deptId', 'name')
        .populate('facultyId', 'name')
        .lean();

      // Include activity data if requested
      if (includeActivity === 'true') {
        for (let user of users) {
          try {
            const submissionCount = await ParameterSubmission.countDocuments({
              userId: user._id,
              cycleId: parseInt(cycleId),
              deletedAt: null
            });
            user.submissionCount = submissionCount;
          } catch (error) {
            user.submissionCount = 0;
          }
        }
      }

      res.status(200).json({
        success: true,
        data: {
          cycle: {
            id: cycle._id,
            name: cycle.name,
            currentActiveYear: cycle.currentActiveYear
          },
          users,
          totalUsers: users.length
        }
      });

    } catch (error) {
      console.error('Error in getUsersByCycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users by cycle',
        error: error.message
      });
    }
  }

  // Record user activity
  static async recordUserActivity(req, res) {
    try {
      const { userId } = req.params;
      const { cycleId, year } = req.body;

      // Users can only record their own activity
      if (parseInt(userId) !== req.user?.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only record your own activity'
        });
      }

      const user = await User.findOne({ _id: userId, deletedAt: null });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await user.recordActivity(cycleId, year);

      res.status(200).json({
        success: true,
        message: 'Activity recorded successfully',
        data: {
          userId: user._id,
          lastActiveAt: user.activityTracking.lastActiveAt,
          lastCycleAccessed: user.activityTracking.lastCycleAccessed,
          lastYearAccessed: user.activityTracking.lastYearAccessed
        }
      });

    } catch (error) {
      console.error('Error in recordUserActivity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record user activity',
        error: error.message
      });
    }
  }

  // Get user activity summary
  static async getUserActivitySummary(req, res) {
    try {
      const { userId } = req.params;
      const { cycleId, days = 30 } = req.query;

      // Access control
      if (parseInt(userId) !== req.user?.id && req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own activity summary'
        });
      }

      const user = await User.findOne({ _id: userId, deletedAt: null })
        .populate('activityTracking.lastCycleAccessed', 'name cycleName');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get submission activity
      const submissionFilter = {
        userId: parseInt(userId),
        deletedAt: null,
        'submissionTimeline.finalSubmittedAt': {
          $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
        }
      };

      if (cycleId) {
        submissionFilter.cycleId = parseInt(cycleId);
      }

      const recentSubmissions = await ParameterSubmission.find(submissionFilter)
        .select('submissionYear submissionType submittedValue submissionTimeline.finalSubmittedAt')
        .populate('parameterId', 'name')
        .sort({ 'submissionTimeline.finalSubmittedAt': -1 })
        .limit(10);

      const activitySummary = {
        user: {
          id: user._id,
          userName: user.userName,
          fullName: user.fullName,
          role: user.userRole
        },
        activityTracking: user.activityTracking,
        currentAccess: {
          cycleId: user.cycleAccess?.currentCycleId,
          cycleYear: user.cycleAccess?.currentCycleYear,
          hasAccess: user.hasCurrentCycleAccess
        },
        recentActivity: {
          recentSubmissions,
          submissionsInPeriod: recentSubmissions.length,
          lastActiveAt: user.activityTracking?.lastActiveAt,
          daysSinceLastLogin: user.daysSinceLastLogin,
          isCurrentlyActive: user.isCurrentlyActive
        }
      };

      res.status(200).json({
        success: true,
        data: activitySummary
      });

    } catch (error) {
      console.error('Error in getUserActivitySummary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user activity summary',
        error: error.message
      });
    }
  }

  // Bulk update user cycle access
  static async bulkUpdateCycleAccess(req, res) {
    try {
      const {
        userIds,
        cycleId,
        year,
        accessLevel = 'write',
        permissions = {},
        action = 'grant'
      } = req.body;

      // Only admins can perform bulk operations
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can perform bulk operations'
        });
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required'
        });
      }

      if (!cycleId) {
        return res.status(400).json({
          success: false,
          message: 'Cycle ID is required'
        });
      }

      // Verify cycle exists
      const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });
      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      const results = {
        successful: [],
        failed: [],
        totalProcessed: 0
      };

      for (const userId of userIds) {
        try {
          const user = await User.findOne({ _id: userId, deletedAt: null });

          if (!user) {
            results.failed.push({
              userId,
              error: 'User not found'
            });
            continue;
          }

          if (action === 'grant') {
            const activeYear = year || cycle.currentActiveYear;
            await user.grantCycleAccess(cycleId, activeYear, req.user.id, accessLevel);

            if (Object.keys(permissions).length > 0) {
              await user.updatePermissions(permissions, req.user.id);
            }
          } else if (action === 'revoke') {
            await user.revokeCycleAccess(cycleId, req.user.id, 'Bulk revocation');
          }

          results.successful.push({
            userId,
            action: action === 'grant' ? 'granted' : 'revoked'
          });

        } catch (error) {
          results.failed.push({
            userId,
            error: error.message
          });
        }

        results.totalProcessed++;
      }

      res.status(200).json({
        success: true,
        message: `Bulk ${action} operation completed`,
        data: results
      });

    } catch (error) {
      console.error('Error in bulkUpdateCycleAccess:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk cycle access update',
        error: error.message
      });
    }
  }

  // Get access history for user
  static async getAccessHistory(req, res) {
    try {
      const { userId } = req.params;
      const { cycleId, limit = 50 } = req.query;

      // Access control
      if (parseInt(userId) !== req.user?.id && req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own access history'
        });
      }

      const user = await User.findOne({ _id: userId, deletedAt: null })
        .populate('cycleAccess.accessHistory.cycleId', 'name cycleName startYear endYear')
        .populate('cycleAccess.accessHistory.grantedBy', 'firstName lastName userName')
        .populate('cycleAccess.accessHistory.revokedBy', 'firstName lastName userName');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      let accessHistory = user.cycleAccess?.accessHistory || [];

      // Filter by cycle if specified
      if (cycleId) {
        accessHistory = accessHistory.filter(access =>
          access.cycleId && access.cycleId._id.toString() === cycleId
        );
      }

      // Limit results
      accessHistory = accessHistory
        .sort((a, b) => new Date(b.accessGrantedAt) - new Date(a.accessGrantedAt))
        .slice(0, parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          userId: user._id,
          userName: user.userName,
          accessHistory,
          totalRecords: accessHistory.length
        }
      });

    } catch (error) {
      console.error('Error in getAccessHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve access history',
        error: error.message
      });
    }
  }
}

module.exports = UserCycleAccessController;