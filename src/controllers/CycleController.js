const Cycle = require('../models/Cycle');
const ParameterCycle = require('../models/ParameterCycle');
const User = require('../models/User');
const Parameter = require('../models/Parameter');

// Enhanced Cycle Controller with Dynamic Management
// 🎯 PURPOSE: Complete cycle lifecycle management with year activation and inheritance

class CycleController {
  // Get all cycles with filtering and pagination
  static async getAllCycles(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        isActive,
        year,
        search,
        sortBy = 'startYear',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = { deletedAt: null };

      if (status) filter.status = status;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (year) {
        filter.cycleYears = parseInt(year);
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { cycleName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortDirection = sortOrder === 'desc' ? -1 : 1;

      const [cycles, totalCount] = await Promise.all([
        Cycle.find(filter)
          .sort({ [sortBy]: sortDirection })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Cycle.countDocuments(filter)
      ]);

      // Add computed fields
      const enrichedCycles = cycles.map(cycle => ({
        ...cycle,
        yearRange: `${new Date(cycle.startYear).getFullYear()}-${new Date(cycle.endYear).getFullYear()}`,
        totalYears: cycle.cycleYears ? cycle.cycleYears.length : 0,
        progressPercentage: CycleController.calculateProgressPercentage(cycle),
        isInProgress: CycleController.isInProgress(cycle)
      }));

      res.status(200).json({
        success: true,
        data: {
          cycles: enrichedCycles,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalItems: totalCount,
            itemsPerPage: parseInt(limit),
            hasNext: skip + cycles.length < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      console.error('Error in getAllCycles:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cycles',
        error: error.message
      });
    }
  }

  // Get single cycle with detailed information
  static async getCycleById(req, res) {
    try {
      const { id } = req.params;
      const { includeParameters = false, includeStats = false } = req.query;

      const cycle = await Cycle.findOne({ _id: id, deletedAt: null });

      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      let responseData = cycle.toJSON();

      // Include parameters if requested
      if (includeParameters === 'true') {
        const parameters = await ParameterCycle.find({ cycleId: id, deletedAt: null })
          .populate('parameterId')
          .lean();
        responseData.parameters = parameters;
      }

      // Include statistics if requested
      if (includeStats === 'true') {
        const stats = await CycleController.getCycleStatistics(id);
        responseData.statistics = stats;
      }

      res.status(200).json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('Error in getCycleById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cycle',
        error: error.message
      });
    }
  }

  // Get current active cycle
  static async getActiveCycle(req, res) {
    try {
      const { includeParameters = false } = req.query;

      const activeCycle = await Cycle.findOne({ isActive: true, deletedAt: null });

      if (!activeCycle) {
        return res.status(404).json({
          success: false,
          message: 'No active cycle found'
        });
      }

      let responseData = activeCycle.toJSON();

      if (includeParameters === 'true') {
        const parameters = await ParameterCycle.find({
          cycleId: activeCycle._id,
          isActive: true,
          deletedAt: null
        })
        .populate('parameterId')
        .lean();
        responseData.parameters = parameters;
      }

      res.status(200).json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('Error in getActiveCycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve active cycle',
        error: error.message
      });
    }
  }

  // Create new cycle
  static async createCycle(req, res) {
    try {
      const {
        name,
        cycleName,
        startYear,
        endYear,
        description,
        targetYear,
        isActive = false
      } = req.body;

      // Validation
      if (!name || !startYear || !endYear) {
        return res.status(400).json({
          success: false,
          message: 'Name, start year, and end year are required'
        });
      }

      // Check if cycle name already exists
      const existingCycle = await Cycle.findOne({
        name: name,
        deletedAt: null
      });

      if (existingCycle) {
        return res.status(409).json({
          success: false,
          message: 'Cycle with this name already exists'
        });
      }

      // If setting as active, check if another cycle is already active
      if (isActive) {
        const activeCycle = await Cycle.findOne({ isActive: true, deletedAt: null });
        if (activeCycle) {
          return res.status(409).json({
            success: false,
            message: 'Another cycle is already active. Please deactivate it first.'
          });
        }
      }

      // Generate new ID
      const lastCycle = await Cycle.findOne().sort({ _id: -1 });
      const newId = (lastCycle?._id || 0) + 1;

      // Create cycle
      const cycleData = {
        _id: newId,
        name,
        cycleName: cycleName || name,
        startYear: new Date(startYear),
        endYear: new Date(endYear),
        description,
        targetYear: targetYear || new Date(endYear).getFullYear(),
        isActive,
        status: isActive ? 'active' : 'draft',
        createdBy: req.user?.id || 'system',
        lastModifiedBy: req.user?.id || 'system',
        lastModifiedAt: new Date()
      };

      const cycle = new Cycle(cycleData);
      await cycle.save();

      // If active, inherit parameters from previous cycle
      if (isActive) {
        await CycleController.inheritParametersFromPreviousCycle(cycle._id, req.user?.id);
      }

      res.status(201).json({
        success: true,
        message: 'Cycle created successfully',
        data: cycle.toJSON()
      });

    } catch (error) {
      console.error('Error in createCycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create cycle',
        error: error.message
      });
    }
  }

  // Update existing cycle
  static async updateCycle(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const cycle = await Cycle.findOne({ _id: id, deletedAt: null });

      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      // Check if trying to activate cycle when another is already active
      if (updates.isActive === true && !cycle.isActive) {
        const activeCycle = await Cycle.findOne({
          isActive: true,
          deletedAt: null,
          _id: { $ne: id }
        });

        if (activeCycle) {
          return res.status(409).json({
            success: false,
            message: 'Another cycle is already active. Please deactivate it first.'
          });
        }
      }

      // Update fields
      Object.assign(cycle, updates);
      cycle.lastModifiedAt = new Date();
      cycle.lastModifiedBy = req.user?.id || 'system';

      // If activating cycle, update status
      if (updates.isActive === true) {
        cycle.status = 'active';
        cycle.activatedAt = new Date();
        cycle.activatedBy = req.user?.id || 'system';
      } else if (updates.isActive === false) {
        cycle.status = 'completed';
        cycle.deactivatedAt = new Date();
      }

      await cycle.save();

      res.status(200).json({
        success: true,
        message: 'Cycle updated successfully',
        data: cycle.toJSON()
      });

    } catch (error) {
      console.error('Error in updateCycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update cycle',
        error: error.message
      });
    }
  }

  // Activate specific year in cycle
  static async activateYear(req, res) {
    try {
      const { id } = req.params;
      const { year, reason } = req.body;

      if (!year) {
        return res.status(400).json({
          success: false,
          message: 'Year is required'
        });
      }

      const cycle = await Cycle.findOne({ _id: id, deletedAt: null });

      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      if (!cycle.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot activate year in inactive cycle'
        });
      }

      // Activate the year
      await cycle.activateYear(year, req.user?.id || 'system', reason);

      // Update users with access to this cycle
      await User.updateMany(
        { 'cycleAccess.currentCycleId': id },
        {
          $set: {
            'cycleAccess.currentCycleYear': year,
            'activityTracking.lastActiveAt': new Date()
          }
        }
      );

      res.status(200).json({
        success: true,
        message: `Year ${year} activated successfully`,
        data: {
          cycleId: id,
          activeYear: year,
          activationHistory: cycle.yearActivationHistory
        }
      });

    } catch (error) {
      console.error('Error in activateYear:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to activate year',
        error: error.message
      });
    }
  }

  // Batch activate multiple years in cycle
  static async batchActivateYears(req, res) {
    try {
      const { id } = req.params;
      const { years, targetYearProjections, reason } = req.body;

      if (!years || !Array.isArray(years) || years.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Years array is required and must not be empty'
        });
      }

      const cycle = await Cycle.findOne({ _id: id, deletedAt: null });

      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      if (!cycle.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot activate years in inactive cycle'
        });
      }

      // Process batch year activation
      const activationResults = [];
      let lastActiveYear = cycle.currentActiveYear;

      // First, deactivate all years by clearing the activatedYears array
      cycle.activatedYears = [];

      // Then activate the selected years
      for (const year of years) {
        try {
          await cycle.activateYear(year, req.user?.id || 'system', reason);
          lastActiveYear = year;
          activationResults.push({
            year,
            status: 'activated',
            timestamp: new Date()
          });
        } catch (error) {
          activationResults.push({
            year,
            status: 'failed',
            error: error.message
          });
        }
      }

      // Handle target year projections separately if specified
      console.log(`🎯 Target year: ${cycle.targetYear}, targetYearProjections param: ${targetYearProjections}`);

      if (cycle.targetYear && targetYearProjections !== undefined) {
        try {
          // Update target year projection settings in targetYearSettings
          if (!cycle.targetYearSettings) {
            cycle.targetYearSettings = {};
          }

          cycle.targetYearSettings.hasProjectedSubmission = targetYearProjections;
          console.log(`✅ Set hasProjectedSubmission to: ${targetYearProjections} for target year ${cycle.targetYear}`);

          // Mark the nested object as modified so Mongoose knows to save it
          cycle.markModified('targetYearSettings');

          await cycle.save();
          console.log(`💾 Cycle saved successfully`);

          // Verify it was saved by re-reading
          const savedValue = cycle.targetYearSettings.hasProjectedSubmission;
          console.log(`🔍 Verification - saved value is: ${savedValue}`);
        } catch (error) {
          console.error('❌ Error updating target year projections:', error);
        }
      } else {
        console.warn(`⚠️ Skipping target year projection update - targetYear: ${cycle.targetYear}, param: ${targetYearProjections}`);
      }

      // Update users with access to this cycle
      await User.updateMany(
        { 'cycleAccess.currentCycleId': id },
        {
          $set: {
            'cycleAccess.currentCycleYear': lastActiveYear,
            'activityTracking.lastActiveAt': new Date()
          }
        }
      );

      const successfulActivations = activationResults.filter(r => r.status === 'activated');
      const failedActivations = activationResults.filter(r => r.status === 'failed');

      res.status(200).json({
        success: true,
        message: `${successfulActivations.length} year(s) activated successfully`,
        data: {
          cycleId: id,
          activatedYears: cycle.activatedYears,
          currentActiveYear: lastActiveYear,
          activationResults,
          targetYearProjections: cycle.targetYear && cycle.yearActivation?.[cycle.targetYear]?.projectionSubmissionsEnabled,
          summary: {
            total: years.length,
            successful: successfulActivations.length,
            failed: failedActivations.length
          }
        }
      });

    } catch (error) {
      console.error('Error in batchActivateYears:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to batch activate years',
        error: error.message
      });
    }
  }

  // Enable target year actual submissions
  static async enableTargetYearSubmissions(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const cycle = await Cycle.findOne({ _id: id, deletedAt: null });

      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      await cycle.enableTargetYearActualSubmissions(req.user?.id || 'system', reason);

      // Update users to allow actual submissions
      await User.updateMany(
        { 'cycleAccess.currentCycleId': id },
        {
          $set: {
            'cycleAccess.submissionAccess.canSubmitActual': true
          }
        }
      );

      res.status(200).json({
        success: true,
        message: 'Target year actual submissions enabled',
        data: {
          cycleId: id,
          targetYear: cycle.targetYear,
          actualSubmissionEnabled: true,
          enabledAt: cycle.targetYearSettings.actualSubmissionEnabledAt
        }
      });

    } catch (error) {
      console.error('Error in enableTargetYearSubmissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to enable target year submissions',
        error: error.message
      });
    }
  }

  // Soft delete cycle
  static async deleteCycle(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const cycle = await Cycle.findOne({ _id: id, deletedAt: null });

      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      if (cycle.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete active cycle. Please deactivate it first.'
        });
      }

      await cycle.softDelete();

      res.status(200).json({
        success: true,
        message: 'Cycle deleted successfully'
      });

    } catch (error) {
      console.error('Error in deleteCycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete cycle',
        error: error.message
      });
    }
  }

  // Get cycle analytics
  static async getCycleAnalytics(req, res) {
    try {
      const { id } = req.params;

      const cycle = await Cycle.findOne({ _id: id, deletedAt: null });

      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      const analytics = await CycleController.generateCycleAnalytics(id);

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error in getCycleAnalytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cycle analytics',
        error: error.message
      });
    }
  }

  // Inherit parameters from previous cycle
  static async inheritParametersFromPreviousCycle(cycleId, adminId) {
    try {
      // Find most recent previous cycle
      const previousCycle = await Cycle.findOne({
        _id: { $ne: cycleId },
        deletedAt: null
      }).sort({ startYear: -1 });

      if (!previousCycle) {
        // No previous cycle, inherit all parameters
        const allParameters = await Parameter.find({ deletedAt: null });

        for (const parameter of allParameters) {
          await CycleController.createParameterCycleAssociation(parameter._id, cycleId, adminId);
        }
      } else {
        // Inherit from previous cycle
        await ParameterCycle.inheritParametersFromCycle(
          previousCycle._id,
          cycleId,
          adminId
        );
      }
    } catch (error) {
      console.error('Error inheriting parameters:', error);
      throw error;
    }
  }

  // Create parameter-cycle association
  static async createParameterCycleAssociation(parameterId, cycleId, adminId) {
    const lastAssociation = await ParameterCycle.findOne().sort({ _id: -1 });
    const newId = (lastAssociation?._id || 0) + 1;

    const association = new ParameterCycle({
      _id: newId,
      parameterId,
      cycleId,
      activatedBy: adminId,
      lastModifiedBy: adminId
    });

    return await association.save();
  }

  // Helper method to calculate progress percentage
  static calculateProgressPercentage(cycle) {
    const currentYear = new Date().getFullYear();
    const startYear = new Date(cycle.startYear).getFullYear();
    const endYear = new Date(cycle.endYear).getFullYear();

    if (currentYear < startYear) return 0;
    if (currentYear > endYear) return 100;

    const totalYears = endYear - startYear + 1;
    const completedYears = currentYear - startYear + 1;
    return Math.round((completedYears / totalYears) * 100);
  }

  // Helper method to check if cycle is in progress
  static isInProgress(cycle) {
    const currentYear = new Date().getFullYear();
    const startYear = new Date(cycle.startYear).getFullYear();
    const endYear = new Date(cycle.endYear).getFullYear();

    return currentYear >= startYear && currentYear <= endYear;
  }

  // Get cycle statistics
  static async getCycleStatistics(cycleId) {
    try {
      const [
        totalParameters,
        activeParameters,
        totalSubmissions,
        pendingApprovals
      ] = await Promise.all([
        ParameterCycle.countDocuments({ cycleId, deletedAt: null }),
        ParameterCycle.countDocuments({ cycleId, isActive: true, deletedAt: null }),
        CycleController.getTotalSubmissions(cycleId),
        CycleController.getPendingApprovals(cycleId)
      ]);

      return {
        totalParameters,
        activeParameters,
        totalSubmissions,
        pendingApprovals,
        completionRate: totalParameters > 0 ? Math.round((activeParameters / totalParameters) * 100) : 0
      };
    } catch (error) {
      console.error('Error getting cycle statistics:', error);
      return {};
    }
  }

  // Helper methods for statistics
  static async getTotalSubmissions(cycleId) {
    // This would count from ParameterSubmission model when available
    return 0;
  }

  static async getPendingApprovals(cycleId) {
    // This would count pending submissions when ParameterSubmission model is available
    return 0;
  }

  // Generate comprehensive cycle analytics
  static async generateCycleAnalytics(cycleId) {
    try {
      const cycle = await Cycle.findById(cycleId);
      const statistics = await CycleController.getCycleStatistics(cycleId);

      return {
        cycle: {
          id: cycle._id,
          name: cycle.name,
          status: cycle.status,
          yearRange: `${new Date(cycle.startYear).getFullYear()}-${new Date(cycle.endYear).getFullYear()}`,
          currentActiveYear: cycle.currentActiveYear,
          targetYear: cycle.targetYear,
          progressPercentage: CycleController.calculateProgressPercentage(cycle)
        },
        statistics,
        yearlyBreakdown: cycle.cycleYears.map(year => ({
          year,
          isActive: year === cycle.currentActiveYear,
          isCompleted: year < cycle.currentActiveYear,
          isFuture: year > cycle.currentActiveYear
        })),
        performance: {
          parametersExceedingTargets: cycle.targetYearSettings?.parametersExceedingTargets || 0,
          parametersMetTargets: cycle.targetYearSettings?.parametersMetTargets || 0,
          parametersBelowTargets: cycle.targetYearSettings?.parametersBelowTargets || 0
        }
      };
    } catch (error) {
      console.error('Error generating analytics:', error);
      throw error;
    }
  }
}

module.exports = CycleController;