const ParameterSubmission = require('../models/ParameterSubmission');
const ParameterCycle = require('../models/ParameterCycle');
const Parameter = require('../models/Parameter');
const Cycle = require('../models/Cycle');
const User = require('../models/User');

// Enhanced Parameter Submission Controller
// 🎯 PURPOSE: Dual submission system with projected/actual values and comprehensive workflow

class ParameterSubmissionController {
  // Get submissions with advanced filtering
  static async getSubmissions(req, res) {
    try {
      const {
        cycleId,
        parameterId,
        userId,
        submissionYear,
        submissionType,
        approvalStatus,
        performanceStatus,
        latestOnly = true,
        page = 1,
        limit = 20,
        sortBy = 'submissionTimeline.finalSubmittedAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = { deletedAt: null };

      if (cycleId) filter.cycleId = parseInt(cycleId);
      if (parameterId) filter.parameterId = parseInt(parameterId);
      if (userId) filter.userId = parseInt(userId);
      if (submissionYear) filter.submissionYear = parseInt(submissionYear);
      if (submissionType) filter.submissionType = submissionType;
      if (approvalStatus) filter.approvalStatus = approvalStatus;
      if (performanceStatus) filter.performanceStatus = performanceStatus;
      if (latestOnly === 'true') filter.isLatestVersion = true;

      // User access control
      if (req.user && req.user.role !== 'Admin') {
        // Non-admin users can only see their own submissions or department/faculty submissions
        if (!userId) {
          const userFilter = await this.buildUserAccessFilter(req.user);
          Object.assign(filter, userFilter);
        }
      }

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortDirection = sortOrder === 'desc' ? -1 : 1;

      const [submissions, totalCount] = await Promise.all([
        ParameterSubmission.find(filter)
          .populate('parameterId', 'name description unit measurementType')
          .populate('cycleId', 'name cycleName currentActiveYear')
          .populate('userId', 'firstName lastName userName userRole deptId facultyId')
          .populate('parameterCycleId')
          .sort({ [sortBy]: sortDirection })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        ParameterSubmission.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        data: {
          submissions,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalItems: totalCount,
            itemsPerPage: parseInt(limit),
            hasNext: skip + submissions.length < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      console.error('Error in getSubmissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve submissions',
        error: error.message
      });
    }
  }

  // Get single submission details
  static async getSubmissionById(req, res) {
    try {
      const { id } = req.params;
      const { includeHistory = false } = req.query;

      const submission = await ParameterSubmission.findOne({ _id: id, deletedAt: null })
        .populate('parameterId')
        .populate('cycleId')
        .populate('userId', 'firstName lastName userName userRole')
        .populate('parameterCycleId')
        .populate('approvedBy', 'firstName lastName userName')
        .populate('dataQuality.verifiedBy', 'firstName lastName userName');

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check access permissions
      const hasAccess = await this.checkSubmissionAccess(req.user, submission);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this submission'
        });
      }

      let responseData = submission.toJSON();

      // Include revision history if requested
      if (includeHistory === 'true' && submission.revisionHistory.length > 0) {
        const revisionHistory = await ParameterSubmission.find({
          $or: [
            { _id: submission.previousVersionId },
            { previousVersionId: submission._id }
          ],
          deletedAt: null
        })
        .populate('userId', 'firstName lastName userName')
        .sort({ version: 1 });

        responseData.revisionHistory = revisionHistory;
      }

      res.status(200).json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('Error in getSubmissionById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve submission',
        error: error.message
      });
    }
  }

  // Create new submission
  static async createSubmission(req, res) {
    try {
      const {
        parameterId,
        cycleId,
        submissionYear,
        submissionType,
        submittedValue,
        evidence = [],
        remarks,
        submissionNotes
      } = req.body;

      // Validation
      if (!parameterId || !cycleId || !submissionYear || !submissionType || submittedValue === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: parameterId, cycleId, submissionYear, submissionType, submittedValue'
        });
      }

      // Verify parameter-cycle association exists
      const parameterCycle = await ParameterCycle.findOne({
        parameterId: parseInt(parameterId),
        cycleId: parseInt(cycleId),
        isActive: true,
        deletedAt: null
      });

      if (!parameterCycle) {
        return res.status(404).json({
          success: false,
          message: 'Active parameter-cycle association not found'
        });
      }

      // Check if submission already exists
      const existingSubmission = await ParameterSubmission.findOne({
        parameterId: parseInt(parameterId),
        cycleId: parseInt(cycleId),
        submissionYear: parseInt(submissionYear),
        submissionType,
        deletedAt: null
      });

      if (existingSubmission) {
        return res.status(409).json({
          success: false,
          message: 'Submission already exists for this parameter, cycle, year, and type'
        });
      }

      // Check user permissions
      const canSubmit = await this.checkSubmissionPermissions(req.user, submissionType, cycleId);
      if (!canSubmit) {
        return res.status(403).json({
          success: false,
          message: `You don't have permission to submit ${submissionType} values`
        });
      }

      // Generate new ID
      const lastSubmission = await ParameterSubmission.findOne().sort({ _id: -1 });
      const newId = (lastSubmission?._id || 0) + 1;

      // Create submission
      const submissionData = {
        _id: newId,
        parameterId: parseInt(parameterId),
        parameterCycleId: parameterCycle._id,
        cycleId: parseInt(cycleId),
        userId: req.user?.id || 1,
        submissionYear: parseInt(submissionYear),
        submissionType,
        submittedValue: parseFloat(submittedValue),
        targetValue: parameterCycle.cycleSpecificSettings?.targetValue || null,
        evidence,
        remarks,
        submissionNotes,
        status: 'draft',
        approvalStatus: 'pending',
        submissionTimeline: {
          draftSavedAt: new Date(),
          lastModifiedAt: new Date()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        submissionSource: 'web'
      };

      const submission = new ParameterSubmission(submissionData);

      // Calculate variance automatically
      submission.calculateVariance();

      await submission.save();

      // Populate response data
      const populatedSubmission = await ParameterSubmission.findById(newId)
        .populate('parameterId', 'name description unit')
        .populate('cycleId', 'name cycleName')
        .populate('userId', 'firstName lastName userName');

      res.status(201).json({
        success: true,
        message: 'Submission created successfully',
        data: populatedSubmission
      });

    } catch (error) {
      console.error('Error in createSubmission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create submission',
        error: error.message
      });
    }
  }

  // Update existing submission
  static async updateSubmission(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const submission = await ParameterSubmission.findOne({ _id: id, deletedAt: null });

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check access permissions
      const canEdit = await this.checkEditPermissions(req.user, submission);
      if (!canEdit) {
        return res.status(403).json({
          success: false,
          message: 'You cannot edit this submission'
        });
      }

      // Check if submission is editable
      if (submission.status === 'approved' && req.user?.role !== 'Admin') {
        return res.status(400).json({
          success: false,
          message: 'Cannot edit approved submission'
        });
      }

      // Update allowed fields
      const allowedUpdates = [
        'submittedValue',
        'evidence',
        'remarks',
        'submissionNotes'
      ];

      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      Object.assign(submission, filteredUpdates);
      submission.submissionTimeline.lastModifiedAt = new Date();

      // Recalculate variance if value changed
      if (updates.submittedValue !== undefined) {
        submission.calculateVariance();
      }

      await submission.save();

      const populatedSubmission = await ParameterSubmission.findById(id)
        .populate('parameterId', 'name description unit')
        .populate('cycleId', 'name cycleName')
        .populate('userId', 'firstName lastName userName');

      res.status(200).json({
        success: true,
        message: 'Submission updated successfully',
        data: populatedSubmission
      });

    } catch (error) {
      console.error('Error in updateSubmission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update submission',
        error: error.message
      });
    }
  }

  // Submit for approval
  static async submitForApproval(req, res) {
    try {
      const { id } = req.params;

      const submission = await ParameterSubmission.findOne({ _id: id, deletedAt: null });

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check ownership
      if (submission.userId !== req.user?.id && req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'You can only submit your own submissions'
        });
      }

      if (submission.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Only draft submissions can be submitted for approval'
        });
      }

      await submission.submit(req.user?.id);

      // Update user submission tracking
      const user = await User.findById(req.user?.id);
      if (user) {
        await user.recordSubmission();
      }

      res.status(200).json({
        success: true,
        message: 'Submission submitted for approval',
        data: {
          id: submission._id,
          status: submission.status,
          approvalStatus: submission.approvalStatus,
          submittedAt: submission.submissionTimeline.finalSubmittedAt
        }
      });

    } catch (error) {
      console.error('Error in submitForApproval:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit for approval',
        error: error.message
      });
    }
  }

  // Approve submission
  static async approveSubmission(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const submission = await ParameterSubmission.findOne({ _id: id, deletedAt: null });

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check approval permissions
      if (!this.canApprove(req.user)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to approve submissions'
        });
      }

      if (submission.approvalStatus !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending submissions can be approved'
        });
      }

      await submission.approve(req.user?.id, notes);

      res.status(200).json({
        success: true,
        message: 'Submission approved successfully',
        data: {
          id: submission._id,
          approvalStatus: submission.approvalStatus,
          approvedAt: submission.approvedAt,
          approvedBy: req.user?.id
        }
      });

    } catch (error) {
      console.error('Error in approveSubmission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve submission',
        error: error.message
      });
    }
  }

  // Reject submission
  static async rejectSubmission(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required'
        });
      }

      const submission = await ParameterSubmission.findOne({ _id: id, deletedAt: null });

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check approval permissions
      if (!this.canApprove(req.user)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to reject submissions'
        });
      }

      await submission.reject(req.user?.id, reason);

      res.status(200).json({
        success: true,
        message: 'Submission rejected',
        data: {
          id: submission._id,
          approvalStatus: submission.approvalStatus,
          rejectionReason: submission.rejectionReason
        }
      });

    } catch (error) {
      console.error('Error in rejectSubmission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject submission',
        error: error.message
      });
    }
  }

  // Request revision
  static async requestRevision(req, res) {
    try {
      const { id } = req.params;
      const { revisionNotes } = req.body;

      if (!revisionNotes) {
        return res.status(400).json({
          success: false,
          message: 'Revision notes are required'
        });
      }

      const submission = await ParameterSubmission.findOne({ _id: id, deletedAt: null });

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check approval permissions
      if (!this.canApprove(req.user)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to request revisions'
        });
      }

      await submission.requestRevision(req.user?.id, revisionNotes);

      res.status(200).json({
        success: true,
        message: 'Revision requested',
        data: {
          id: submission._id,
          approvalStatus: submission.approvalStatus,
          revisionRequested: submission.revisionRequested
        }
      });

    } catch (error) {
      console.error('Error in requestRevision:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to request revision',
        error: error.message
      });
    }
  }

  // Create revision
  static async createRevision(req, res) {
    try {
      const { id } = req.params;
      const { revisionData, revisionReason } = req.body;

      const originalSubmission = await ParameterSubmission.findOne({ _id: id, deletedAt: null });

      if (!originalSubmission) {
        return res.status(404).json({
          success: false,
          message: 'Original submission not found'
        });
      }

      // Check ownership
      if (originalSubmission.userId !== req.user?.id && req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'You can only revise your own submissions'
        });
      }

      if (originalSubmission.approvalStatus !== 'needs_revision') {
        return res.status(400).json({
          success: false,
          message: 'Only submissions needing revision can be revised'
        });
      }

      const newRevision = await originalSubmission.createRevision({
        ...revisionData,
        revisionReason,
        changesDescription: revisionData.changesDescription || 'Submission revised'
      }, req.user?.id);

      const populatedRevision = await ParameterSubmission.findById(newRevision._id)
        .populate('parameterId', 'name description unit')
        .populate('cycleId', 'name cycleName')
        .populate('userId', 'firstName lastName userName');

      res.status(201).json({
        success: true,
        message: 'Revision created successfully',
        data: populatedRevision
      });

    } catch (error) {
      console.error('Error in createRevision:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create revision',
        error: error.message
      });
    }
  }

  // Flag submission
  static async flagSubmission(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Flag reason is required'
        });
      }

      const submission = await ParameterSubmission.findOne({ _id: id, deletedAt: null });

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Only admins and reviewers can flag submissions
      if (!['Admin', 'Dean', 'VC', 'PVC'].includes(req.user?.role)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to flag submissions'
        });
      }

      await submission.flag(req.user?.id, reason);

      res.status(200).json({
        success: true,
        message: 'Submission flagged successfully',
        data: {
          id: submission._id,
          isFlagged: submission.isFlagged,
          flagReason: submission.flagReason,
          flaggedAt: submission.flaggedAt
        }
      });

    } catch (error) {
      console.error('Error in flagSubmission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to flag submission',
        error: error.message
      });
    }
  }

  // Get user's submissions for a cycle
  static async getUserSubmissions(req, res) {
    try {
      const { userId, cycleId } = req.params;
      const { year, submissionType } = req.query;

      // Check access permissions
      if (parseInt(userId) !== req.user?.id && req.user?.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own submissions'
        });
      }

      const submissions = await ParameterSubmission.getUserSubmissions(
        parseInt(userId),
        cycleId ? parseInt(cycleId) : null,
        year ? parseInt(year) : null
      );

      // Filter by submission type if specified
      const filteredSubmissions = submissionType
        ? submissions.filter(s => s.submissionType === submissionType)
        : submissions;

      res.status(200).json({
        success: true,
        data: {
          userId: parseInt(userId),
          cycleId: cycleId ? parseInt(cycleId) : null,
          year: year ? parseInt(year) : null,
          submissionType,
          submissions: filteredSubmissions,
          totalSubmissions: filteredSubmissions.length
        }
      });

    } catch (error) {
      console.error('Error in getUserSubmissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user submissions',
        error: error.message
      });
    }
  }

  // Get performance analytics for submissions
  static async getPerformanceAnalytics(req, res) {
    try {
      const { cycleId } = req.params;
      const { year } = req.query;

      const analytics = await ParameterSubmission.getPerformanceAnalytics(
        parseInt(cycleId),
        year ? parseInt(year) : null
      );

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error in getPerformanceAnalytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve performance analytics',
        error: error.message
      });
    }
  }

  // Soft delete submission
  static async deleteSubmission(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const submission = await ParameterSubmission.findOne({ _id: id, deletedAt: null });

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check delete permissions
      const canDelete = submission.userId === req.user?.id || req.user?.role === 'Admin';
      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: 'You cannot delete this submission'
        });
      }

      if (submission.approvalStatus === 'approved' && req.user?.role !== 'Admin') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete approved submission'
        });
      }

      await submission.softDelete(req.user?.id, reason);

      res.status(200).json({
        success: true,
        message: 'Submission deleted successfully'
      });

    } catch (error) {
      console.error('Error in deleteSubmission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete submission',
        error: error.message
      });
    }
  }

  // Helper methods
  static async buildUserAccessFilter(user) {
    const filter = {};

    switch (user.role) {
      case 'Chairman':
        filter.userId = { $in: await this.getUsersByDepartment(user.deptId) };
        break;
      case 'Dean':
        filter.userId = { $in: await this.getUsersByFaculty(user.facultyId) };
        break;
      case 'VC':
      case 'PVC':
        // Can see all submissions
        break;
      default:
        filter.userId = user.id;
    }

    return filter;
  }

  static async getUsersByDepartment(deptId) {
    const users = await User.find({ deptId, isActive: true }, '_id');
    return users.map(u => u._id);
  }

  static async getUsersByFaculty(facultyId) {
    const users = await User.find({ facultyId, isActive: true }, '_id');
    return users.map(u => u._id);
  }

  static async checkSubmissionAccess(user, submission) {
    if (user.role === 'Admin') return true;
    if (submission.userId === user.id) return true;

    // Check department/faculty access
    const submissionUser = await User.findById(submission.userId);
    if (!submissionUser) return false;

    if (user.role === 'Chairman' && user.deptId === submissionUser.deptId) return true;
    if (user.role === 'Dean' && user.facultyId === submissionUser.facultyId) return true;
    if (['VC', 'PVC'].includes(user.role)) return true;

    return false;
  }

  static async checkSubmissionPermissions(user, submissionType, cycleId) {
    const userDoc = await User.findById(user.id);
    if (!userDoc) return false;

    if (submissionType === 'projected') {
      return userDoc.cycleAccess?.submissionAccess?.canSubmitProjected !== false;
    }

    if (submissionType === 'actual') {
      return userDoc.cycleAccess?.submissionAccess?.canSubmitActual === true;
    }

    return false;
  }

  static async checkEditPermissions(user, submission) {
    if (user.role === 'Admin') return true;
    if (submission.userId === user.id) return true;
    return false;
  }

  static canApprove(user) {
    return ['Admin', 'Dean', 'VC', 'PVC'].includes(user?.role);
  }
}

module.exports = ParameterSubmissionController;