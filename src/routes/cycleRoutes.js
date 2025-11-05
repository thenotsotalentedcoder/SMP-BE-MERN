const express = require('express');
const router = express.Router();

const CycleController = require('../controllers/CycleController');
const ValidationMiddleware = require('../middleware/validation');
const {
  authenticateToken,
  authorize,
  requireCycleAccess,
  requireYearAccess,
  UserRoles
} = require('../middleware/auth');

// Enhanced Cycle Management Routes
// 🎯 PURPOSE: Complete cycle lifecycle management with dynamic year activation

// Public routes (with authentication)
router.use(authenticateToken);

/**
 * @route   GET /api/cycles
 * @desc    Get all cycles with filtering and pagination
 * @access  Private (All authenticated users)
 * @query   page, limit, status, isActive, year, search, sortBy, sortOrder
 */
router.get('/',
  ValidationMiddleware.buildValidationChain(['pagination', 'filters']),
  CycleController.getAllCycles
);

/**
 * @route   GET /api/cycles/active
 * @desc    Get current active cycle
 * @access  Private (All authenticated users)
 * @query   includeParameters
 */
router.get('/active',
  CycleController.getActiveCycle
);

/**
 * @route   GET /api/cycles/:id
 * @desc    Get single cycle by ID
 * @access  Private (Users with cycle access)
 * @params  id - Cycle ID
 * @query   includeParameters, includeStats
 */
router.get('/:id',
  ValidationMiddleware.buildValidationChain(['sanitize']),
  requireCycleAccess('id'),
  CycleController.getCycleById
);

/**
 * @route   GET /api/cycles/:id/analytics
 * @desc    Get detailed cycle analytics
 * @access  Private (Users with cycle access)
 * @params  id - Cycle ID
 * @query   includeComparisons
 */
router.get('/:id/analytics',
  ValidationMiddleware.buildValidationChain(['sanitize']),
  requireCycleAccess('id'),
  ValidationMiddleware.validateAnalyticsParams(),
  ValidationMiddleware.handleValidationErrors,
  CycleController.getCycleAnalytics
);

// Admin-only routes
/**
 * @route   POST /api/cycles
 * @desc    Create new cycle
 * @access  Private (Admin only)
 * @body    name, cycleName, startYear, endYear, description, targetYear, isActive
 */
router.post('/',
  authorize(UserRoles.Admin),
  ValidationMiddleware.validateCreateCycle(),
  ValidationMiddleware.handleValidationErrors,
  CycleController.createCycle
);

/**
 * @route   PUT /api/cycles/:id
 * @desc    Update existing cycle
 * @access  Private (Admin only)
 * @params  id - Cycle ID
 * @body    name, cycleName, startYear, endYear, description, isActive, status
 */
router.put('/:id',
  authorize(UserRoles.Admin),
  ValidationMiddleware.validateUpdateCycle(),
  ValidationMiddleware.handleValidationErrors,
  CycleController.updateCycle
);

/**
 * @route   POST /api/cycles/:id/activate-year
 * @desc    Activate specific year in cycle
 * @access  Private (Admin only)
 * @params  id - Cycle ID
 * @body    year, reason
 */
router.post('/:id/activate-year',
  authorize(UserRoles.Admin),
  ValidationMiddleware.validateActivateYear(),
  ValidationMiddleware.handleValidationErrors,
  CycleController.activateYear
);

/**
 * @route   POST /api/cycles/:id/batch-activate-years
 * @desc    Batch activate multiple years in cycle
 * @access  Private (Admin only)
 * @params  id - Cycle ID
 * @body    years, targetYearProjections, reason
 */
router.post('/:id/batch-activate-years',
  authorize(UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ValidationMiddleware.handleValidationErrors,
  CycleController.batchActivateYears
);

/**
 * @route   POST /api/cycles/:id/enable-target-submissions
 * @desc    Enable target year actual submissions
 * @access  Private (Admin only)
 * @params  id - Cycle ID
 * @body    reason
 */
router.post('/:id/enable-target-submissions',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  CycleController.enableTargetYearSubmissions
);

/**
 * @route   DELETE /api/cycles/:id
 * @desc    Soft delete cycle
 * @access  Private (Admin only)
 * @params  id - Cycle ID
 * @body    reason
 */
router.delete('/:id',
  authorize(UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['sanitize']),
  CycleController.deleteCycle
);

// Management routes for higher-level roles
/**
 * @route   GET /api/cycles/:id/statistics
 * @desc    Get cycle statistics (for management)
 * @access  Private (Dean, VC, PVC, Admin)
 * @params  id - Cycle ID
 */
router.get('/:id/statistics',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  requireCycleAccess('id'),
  async (req, res) => {
    try {
      const statistics = await CycleController.getCycleStatistics(req.params.id);
      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error getting cycle statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cycle statistics',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/cycles/:id/performance
 * @desc    Get cycle performance metrics
 * @access  Private (Dean, VC, PVC, Admin)
 * @params  id - Cycle ID
 * @query   year
 */
router.get('/:id/performance',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  requireCycleAccess('id'),
  ValidationMiddleware.buildValidationChain(['filters']),
  async (req, res) => {
    try {
      const { year } = req.query;
      const metrics = await CycleController.getPerformanceMetrics(req.params.id, year);
      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve performance metrics',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/cycles/:id/duplicate
 * @desc    Duplicate cycle with all parameters
 * @access  Private (Admin only)
 * @params  id - Source Cycle ID
 * @body    name, startYear, endYear, copyParameters
 */
router.post('/:id/duplicate',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.validateCreateCycle(),
    ValidationMiddleware.handleValidationErrors
  ],
  async (req, res) => {
    try {
      const sourceCycleId = req.params.id;
      const { copyParameters = true } = req.body;

      // Create new cycle
      const newCycle = await CycleController.createCycle(req, res);

      // If successful and copyParameters is true, inherit parameters
      if (copyParameters && newCycle) {
        await CycleController.inheritParametersFromPreviousCycle(
          newCycle._id,
          req.user?.id || 'system'
        );
      }
    } catch (error) {
      console.error('Error duplicating cycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to duplicate cycle',
        error: error.message
      });
    }
  }
);

/**
 * @route   PUT /api/cycles/:id/archive
 * @desc    Archive completed cycle
 * @access  Private (Admin only)
 * @params  id - Cycle ID
 * @body    reason
 */
router.put('/:id/archive',
  authorize(UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['sanitize']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const cycle = await require('../models/Cycle').findById(id);
      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      if (cycle.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot archive active cycle'
        });
      }

      cycle.status = 'archived';
      cycle.lastModifiedAt = new Date();
      cycle.lastModifiedBy = req.user?.id || 'system';
      await cycle.save();

      res.status(200).json({
        success: true,
        message: 'Cycle archived successfully',
        data: {
          id: cycle._id,
          status: cycle.status,
          archivedAt: cycle.lastModifiedAt
        }
      });

    } catch (error) {
      console.error('Error archiving cycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to archive cycle',
        error: error.message
      });
    }
  }
);

/**
 * @route   PUT /api/cycles/:id/restore
 * @desc    Restore archived cycle
 * @access  Private (Admin only)
 * @params  id - Cycle ID
 */
router.put('/:id/restore',
  authorize(UserRoles.Admin),
  async (req, res) => {
    try {
      const { id } = req.params;

      const cycle = await require('../models/Cycle').findById(id);
      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      if (cycle.status !== 'archived') {
        return res.status(400).json({
          success: false,
          message: 'Only archived cycles can be restored'
        });
      }

      cycle.status = 'completed';
      cycle.lastModifiedAt = new Date();
      cycle.lastModifiedBy = req.user?.id || 'system';
      await cycle.save();

      res.status(200).json({
        success: true,
        message: 'Cycle restored successfully',
        data: {
          id: cycle._id,
          status: cycle.status,
          restoredAt: cycle.lastModifiedAt
        }
      });

    } catch (error) {
      console.error('Error restoring cycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore cycle',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/cycles/:id/audit
 * @desc    Get cycle audit trail
 * @access  Private (Admin only)
 * @params  id - Cycle ID
 * @query   limit, startDate, endDate
 */
router.get('/:id/audit',
  authorize(UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['dateRange', 'pagination']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = 50, startDate, endDate } = req.query;

      const cycle = await require('../models/Cycle').findById(id);
      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      // Build audit trail from year activation history
      let auditTrail = cycle.yearActivationHistory || [];

      // Filter by date range if provided
      if (startDate || endDate) {
        auditTrail = auditTrail.filter(entry => {
          const entryDate = new Date(entry.timestamp);
          if (startDate && entryDate < new Date(startDate)) return false;
          if (endDate && entryDate > new Date(endDate)) return false;
          return true;
        });
      }

      // Sort by timestamp (newest first) and limit
      auditTrail = auditTrail
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          cycleId: id,
          cycleName: cycle.name,
          auditTrail,
          totalEntries: auditTrail.length
        }
      });

    } catch (error) {
      console.error('Error getting cycle audit trail:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit trail',
        error: error.message
      });
    }
  }
);

module.exports = router;