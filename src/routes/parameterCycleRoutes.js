const express = require('express');
const router = express.Router();

const ParameterCycleController = require('../controllers/ParameterCycleController');
const ValidationMiddleware = require('../middleware/validation');
const {
  authenticateToken,
  authorize,
  requireCycleAccess,
  UserRoles
} = require('../middleware/auth');

// Parameter-Cycle Association Routes
// 🎯 PURPOSE: Manage parameter inheritance and cycle-specific configurations

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/parameter-cycles
 * @desc    Get all parameter-cycle associations with filtering
 * @access  Private (All authenticated users)
 * @query   cycleId, parameterId, isActive, status, inherited, page, limit, sortBy, sortOrder
 */
router.get('/',
  ValidationMiddleware.buildValidationChain(['pagination', 'filters']),
  ParameterCycleController.getParameterCycles
);

/**
 * @route   GET /api/parameter-cycles/:id
 * @desc    Get single parameter-cycle association details
 * @access  Private (Users with cycle access)
 * @params  id - Parameter-Cycle association ID
 */
router.get('/:id',
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ParameterCycleController.getParameterCycleById
);

/**
 * @route   GET /api/parameter-cycles/cycle/:cycleId
 * @desc    Get parameters for a specific cycle
 * @access  Private (Users with cycle access)
 * @params  cycleId - Cycle ID
 * @query   activeOnly, includeSubmissions
 */
router.get('/cycle/:cycleId',
  requireCycleAccess('cycleId'),
  ValidationMiddleware.buildValidationChain(['filters']),
  ParameterCycleController.getParametersByCycle
);

/**
 * @route   GET /api/parameter-cycles/parameter/:parameterId
 * @desc    Get cycles for a specific parameter
 * @access  Private (All authenticated users)
 * @params  parameterId - Parameter ID
 */
router.get('/parameter/:parameterId',
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ParameterCycleController.getCyclesByParameter
);

/**
 * @route   GET /api/parameter-cycles/parameter/:parameterId/history
 * @desc    Get inheritance history for a parameter
 * @access  Private (All authenticated users)
 * @params  parameterId - Parameter ID
 */
router.get('/parameter/:parameterId/history',
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ParameterCycleController.getInheritanceHistory
);

/**
 * @route   GET /api/parameter-cycles/:id/performance
 * @desc    Get performance metrics for parameter-cycle
 * @access  Private (Dean, VC, PVC, Admin)
 * @params  id - Parameter-Cycle association ID
 */
router.get('/:id/performance',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ParameterCycleController.getPerformanceMetrics
);

// Admin and Management routes
/**
 * @route   POST /api/parameter-cycles
 * @desc    Create new parameter-cycle association
 * @access  Private (Admin only)
 * @body    parameterId, cycleId, isActive, cycleSpecificSettings
 */
router.post('/',
  authorize(UserRoles.Admin),
  ValidationMiddleware.validateCreateParameterCycle(),
  ValidationMiddleware.handleValidationErrors,
  ParameterCycleController.createParameterCycle
);

/**
 * @route   PUT /api/parameter-cycles/:id
 * @desc    Update parameter-cycle association
 * @access  Private (Admin only)
 * @params  id - Parameter-Cycle association ID
 * @body    isActive, status, cycleSpecificSettings
 */
router.put('/:id',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  ParameterCycleController.updateParameterCycle
);

/**
 * @route   PUT /api/parameter-cycles/:id/settings
 * @desc    Update cycle-specific settings
 * @access  Private (Admin only)
 * @params  id - Parameter-Cycle association ID
 * @body    cycleSpecificSettings
 */
router.put('/:id/settings',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  ParameterCycleController.updateCycleSettings
);

/**
 * @route   POST /api/parameter-cycles/:id/yearly-override
 * @desc    Add yearly override for parameter
 * @access  Private (Admin only)
 * @params  id - Parameter-Cycle association ID
 * @body    year, overrides
 */
router.post('/:id/yearly-override',
  authorize(UserRoles.Admin),
  ValidationMiddleware.validateYearlyOverride(),
  ValidationMiddleware.handleValidationErrors,
  ParameterCycleController.addYearlyOverride
);

/**
 * @route   POST /api/parameter-cycles/inherit
 * @desc    Inherit parameters from another cycle
 * @access  Private (Admin only)
 * @body    fromCycleId, toCycleId, options
 */
router.post('/inherit',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  ParameterCycleController.inheritParameters
);

/**
 * @route   POST /api/parameter-cycles/:id/activate
 * @desc    Activate parameter in cycle
 * @access  Private (Admin only)
 * @params  id - Parameter-Cycle association ID
 * @body    reason
 */
router.post('/:id/activate',
  authorize(UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ParameterCycleController.activateParameter
);

/**
 * @route   POST /api/parameter-cycles/:id/deactivate
 * @desc    Deactivate parameter in cycle
 * @access  Private (Admin only)
 * @params  id - Parameter-Cycle association ID
 * @body    reason
 */
router.post('/:id/deactivate',
  authorize(UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ParameterCycleController.deactivateParameter
);

/**
 * @route   DELETE /api/parameter-cycles/:id
 * @desc    Soft delete parameter-cycle association
 * @access  Private (Admin only)
 * @params  id - Parameter-Cycle association ID
 * @body    reason
 */
router.delete('/:id',
  authorize(UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['sanitize']),
  ParameterCycleController.deleteParameterCycle
);

// Bulk operations
/**
 * @route   POST /api/parameter-cycles/bulk/activate
 * @desc    Bulk activate parameters in cycle
 * @access  Private (Admin only)
 * @body    cycleId, parameterIds, reason
 */
router.post('/bulk/activate',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { cycleId, parameterIds, reason } = req.body;

      if (!cycleId || !parameterIds || !Array.isArray(parameterIds)) {
        return res.status(400).json({
          success: false,
          message: 'Cycle ID and parameter IDs array are required'
        });
      }

      const results = {
        successful: [],
        failed: [],
        totalProcessed: 0
      };

      for (const parameterId of parameterIds) {
        try {
          const ParameterCycle = require('../models/ParameterCycle');
          const association = await ParameterCycle.findOne({
            parameterId: parseInt(parameterId),
            cycleId: parseInt(cycleId),
            deletedAt: null
          });

          if (association) {
            await association.activate(req.user?.id || 'system');
            results.successful.push({
              parameterId,
              associationId: association._id
            });
          } else {
            results.failed.push({
              parameterId,
              error: 'Association not found'
            });
          }
        } catch (error) {
          results.failed.push({
            parameterId,
            error: error.message
          });
        }
        results.totalProcessed++;
      }

      res.status(200).json({
        success: true,
        message: 'Bulk activation completed',
        data: results
      });

    } catch (error) {
      console.error('Error in bulk activate:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk activation',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/parameter-cycles/bulk/deactivate
 * @desc    Bulk deactivate parameters in cycle
 * @access  Private (Admin only)
 * @body    cycleId, parameterIds, reason
 */
router.post('/bulk/deactivate',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { cycleId, parameterIds, reason } = req.body;

      if (!cycleId || !parameterIds || !Array.isArray(parameterIds)) {
        return res.status(400).json({
          success: false,
          message: 'Cycle ID and parameter IDs array are required'
        });
      }

      const results = {
        successful: [],
        failed: [],
        totalProcessed: 0
      };

      for (const parameterId of parameterIds) {
        try {
          const ParameterCycle = require('../models/ParameterCycle');
          const association = await ParameterCycle.findOne({
            parameterId: parseInt(parameterId),
            cycleId: parseInt(cycleId),
            deletedAt: null
          });

          if (association) {
            await association.deactivate(req.user?.id || 'system', reason);
            results.successful.push({
              parameterId,
              associationId: association._id
            });
          } else {
            results.failed.push({
              parameterId,
              error: 'Association not found'
            });
          }
        } catch (error) {
          results.failed.push({
            parameterId,
            error: error.message
          });
        }
        results.totalProcessed++;
      }

      res.status(200).json({
        success: true,
        message: 'Bulk deactivation completed',
        data: results
      });

    } catch (error) {
      console.error('Error in bulk deactivate:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk deactivation',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/parameter-cycles/bulk/update-settings
 * @desc    Bulk update cycle-specific settings
 * @access  Private (Admin only)
 * @body    associations, settings
 */
router.post('/bulk/update-settings',
  authorize(UserRoles.Admin),
  [
    ValidationMiddleware.buildValidationChain(['sanitize']),
    ValidationMiddleware.handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { associations, settings } = req.body;

      if (!associations || !Array.isArray(associations) || !settings) {
        return res.status(400).json({
          success: false,
          message: 'Associations array and settings object are required'
        });
      }

      const results = {
        successful: [],
        failed: [],
        totalProcessed: 0
      };

      for (const associationId of associations) {
        try {
          const ParameterCycle = require('../models/ParameterCycle');
          const association = await ParameterCycle.findOne({
            _id: associationId,
            deletedAt: null
          });

          if (association) {
            await association.updateCycleSettings(settings, req.user?.id || 'system');
            results.successful.push({
              associationId,
              updatedSettings: settings
            });
          } else {
            results.failed.push({
              associationId,
              error: 'Association not found'
            });
          }
        } catch (error) {
          results.failed.push({
            associationId,
            error: error.message
          });
        }
        results.totalProcessed++;
      }

      res.status(200).json({
        success: true,
        message: 'Bulk settings update completed',
        data: results
      });

    } catch (error) {
      console.error('Error in bulk update settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk settings update',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/parameter-cycles/analytics/summary
 * @desc    Get parameter-cycle analytics summary
 * @access  Private (Dean, VC, PVC, Admin)
 * @query   cycleId, parameterId, timeframe
 */
router.get('/analytics/summary',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['filters', 'analytics']),
  async (req, res) => {
    try {
      const { cycleId, parameterId, timeframe = 30 } = req.query;

      const ParameterCycle = require('../models/ParameterCycle');
      const filter = { deletedAt: null };

      if (cycleId) filter.cycleId = parseInt(cycleId);
      if (parameterId) filter.parameterId = parseInt(parameterId);

      const associations = await ParameterCycle.find(filter)
        .populate('parameterId', 'name category')
        .populate('cycleId', 'name currentActiveYear')
        .lean();

      const summary = {
        totalAssociations: associations.length,
        activeAssociations: associations.filter(a => a.isActive).length,
        inheritedAssociations: associations.filter(a => a.inheritedFromCycle).length,
        categoryBreakdown: {},
        statusBreakdown: {
          active: 0,
          inactive: 0,
          archived: 0,
          migrated: 0
        },
        performanceOverview: {
          avgTargetValue: 0,
          totalParametersWithTargets: 0,
          parametersWithYearlyOverrides: 0
        }
      };

      // Calculate breakdowns
      associations.forEach(assoc => {
        // Status breakdown
        summary.statusBreakdown[assoc.status] = (summary.statusBreakdown[assoc.status] || 0) + 1;

        // Category breakdown
        const category = assoc.parameterId?.category || 'Unknown';
        summary.categoryBreakdown[category] = (summary.categoryBreakdown[category] || 0) + 1;

        // Performance metrics
        if (assoc.cycleSpecificSettings?.targetValue) {
          summary.performanceOverview.totalParametersWithTargets++;
          summary.performanceOverview.avgTargetValue += assoc.cycleSpecificSettings.targetValue;
        }

        if (assoc.cycleSpecificSettings?.yearlyOverrides?.length > 0) {
          summary.performanceOverview.parametersWithYearlyOverrides++;
        }
      });

      // Calculate averages
      if (summary.performanceOverview.totalParametersWithTargets > 0) {
        summary.performanceOverview.avgTargetValue = Math.round(
          (summary.performanceOverview.avgTargetValue / summary.performanceOverview.totalParametersWithTargets) * 100
        ) / 100;
      }

      res.status(200).json({
        success: true,
        data: summary
      });

    } catch (error) {
      console.error('Error getting analytics summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics summary',
        error: error.message
      });
    }
  }
);

module.exports = router;