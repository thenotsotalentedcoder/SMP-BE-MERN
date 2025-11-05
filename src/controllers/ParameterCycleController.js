const ParameterCycle = require('../models/ParameterCycle');
const Parameter = require('../models/Parameter');
const Cycle = require('../models/Cycle');
const ParameterSubmission = require('../models/ParameterSubmission');

// Parameter-Cycle Association Controller
// 🎯 PURPOSE: Manage parameter inheritance and cycle-specific configurations

class ParameterCycleController {
  // Get all parameter-cycle associations with filtering
  static async getParameterCycles(req, res) {
    try {
      const {
        cycleId,
        parameterId,
        isActive,
        status,
        inherited,
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = { deletedAt: null };

      if (cycleId) filter.cycleId = parseInt(cycleId);
      if (parameterId) filter.parameterId = parseInt(parameterId);
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (status) filter.status = status;
      if (inherited === 'true') filter.inheritedFromCycle = { $ne: null };
      if (inherited === 'false') filter.inheritedFromCycle = null;

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortDirection = sortOrder === 'desc' ? -1 : 1;

      const [associations, totalCount] = await Promise.all([
        ParameterCycle.find(filter)
          .populate('parameterId', 'name description unit measurementType targetValue')
          .populate('cycleId', 'name cycleName currentActiveYear targetYear')
          .populate('inheritedFromCycle', 'name cycleName')
          .sort({ [sortBy]: sortDirection })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        ParameterCycle.countDocuments(filter)
      ]);

      res.status(200).json({
        success: true,
        data: {
          associations,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalItems: totalCount,
            itemsPerPage: parseInt(limit),
            hasNext: skip + associations.length < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      console.error('Error in getParameterCycles:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve parameter-cycle associations',
        error: error.message
      });
    }
  }

  // Get parameters for a specific cycle
  static async getParametersByCycle(req, res) {
    try {
      const { cycleId } = req.params;
      const { activeOnly = false, includeSubmissions = false } = req.query;

      const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });
      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      const filter = { cycleId: parseInt(cycleId), deletedAt: null };
      if (activeOnly === 'true') filter.isActive = true;

      const associations = await ParameterCycle.find(filter)
        .populate('parameterId')
        .populate('inheritedFromCycle', 'name cycleName')
        .lean();

      // Include submission counts if requested
      if (includeSubmissions === 'true') {
        for (let association of associations) {
          try {
            const submissionCount = await ParameterSubmission.countDocuments({
              parameterCycleId: association._id,
              deletedAt: null
            });
            association.submissionCount = submissionCount;
          } catch (error) {
            association.submissionCount = 0;
          }
        }
      }

      res.status(200).json({
        success: true,
        data: {
          cycle: {
            id: cycle._id,
            name: cycle.name,
            currentActiveYear: cycle.currentActiveYear,
            targetYear: cycle.targetYear
          },
          parameters: associations,
          totalParameters: associations.length,
          activeParameters: associations.filter(a => a.isActive).length
        }
      });

    } catch (error) {
      console.error('Error in getParametersByCycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cycle parameters',
        error: error.message
      });
    }
  }

  // Get cycles for a specific parameter
  static async getCyclesByParameter(req, res) {
    try {
      const { parameterId } = req.params;

      const parameter = await Parameter.findOne({ _id: parameterId, deletedAt: null });
      if (!parameter) {
        return res.status(404).json({
          success: false,
          message: 'Parameter not found'
        });
      }

      const associations = await ParameterCycle.find({
        parameterId: parseInt(parameterId),
        deletedAt: null
      })
      .populate('cycleId')
      .populate('inheritedFromCycle', 'name cycleName')
      .sort({ 'cycleId.startYear': -1 })
      .lean();

      res.status(200).json({
        success: true,
        data: {
          parameter: {
            id: parameter._id,
            name: parameter.name,
            description: parameter.description,
            unit: parameter.unit
          },
          cycles: associations,
          totalCycles: associations.length
        }
      });

    } catch (error) {
      console.error('Error in getCyclesByParameter:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve parameter cycles',
        error: error.message
      });
    }
  }

  // Get single parameter-cycle association details
  static async getParameterCycleById(req, res) {
    try {
      const { id } = req.params;

      const association = await ParameterCycle.findOne({ _id: id, deletedAt: null })
        .populate('parameterId')
        .populate('cycleId')
        .populate('inheritedFromCycle', 'name cycleName');

      if (!association) {
        return res.status(404).json({
          success: false,
          message: 'Parameter-cycle association not found'
        });
      }

      res.status(200).json({
        success: true,
        data: association
      });

    } catch (error) {
      console.error('Error in getParameterCycleById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve association details',
        error: error.message
      });
    }
  }

  // Create new parameter-cycle association
  static async createParameterCycle(req, res) {
    try {
      const {
        parameterId,
        cycleId,
        isActive = true,
        cycleSpecificSettings = {}
      } = req.body;

      // Validation
      if (!parameterId || !cycleId) {
        return res.status(400).json({
          success: false,
          message: 'Parameter ID and Cycle ID are required'
        });
      }

      // Check if association already exists
      const existing = await ParameterCycle.findOne({
        parameterId: parseInt(parameterId),
        cycleId: parseInt(cycleId),
        deletedAt: null
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Parameter-cycle association already exists'
        });
      }

      // Verify parameter and cycle exist
      const [parameter, cycle] = await Promise.all([
        Parameter.findOne({ _id: parameterId, deletedAt: null }),
        Cycle.findOne({ _id: cycleId, deletedAt: null })
      ]);

      if (!parameter) {
        return res.status(404).json({
          success: false,
          message: 'Parameter not found'
        });
      }

      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      // Generate new ID
      const lastAssociation = await ParameterCycle.findOne().sort({ _id: -1 });
      const newId = (lastAssociation?._id || 0) + 1;

      // Create association
      const associationData = {
        _id: newId,
        parameterId: parseInt(parameterId),
        cycleId: parseInt(cycleId),
        isActive,
        status: isActive ? 'active' : 'inactive',
        cycleSpecificSettings: {
          targetValue: parameter.targetValue,
          targetDescription: parameter.targetDescription || '',
          ...cycleSpecificSettings
        },
        activatedBy: req.user?.id || 'system',
        lastModifiedBy: req.user?.id || 'system',
        lastModifiedAt: new Date()
      };

      const association = new ParameterCycle(associationData);
      await association.save();

      // Populate response data
      const populatedAssociation = await ParameterCycle.findById(newId)
        .populate('parameterId')
        .populate('cycleId');

      res.status(201).json({
        success: true,
        message: 'Parameter-cycle association created successfully',
        data: populatedAssociation
      });

    } catch (error) {
      console.error('Error in createParameterCycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create parameter-cycle association',
        error: error.message
      });
    }
  }

  // Update parameter-cycle association
  static async updateParameterCycle(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const association = await ParameterCycle.findOne({ _id: id, deletedAt: null });

      if (!association) {
        return res.status(404).json({
          success: false,
          message: 'Parameter-cycle association not found'
        });
      }

      // Update allowed fields
      const allowedUpdates = [
        'isActive',
        'status',
        'cycleSpecificSettings'
      ];

      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      Object.assign(association, filteredUpdates);
      association.lastModifiedAt = new Date();
      association.lastModifiedBy = req.user?.id || 'system';

      await association.save();

      const populatedAssociation = await ParameterCycle.findById(id)
        .populate('parameterId')
        .populate('cycleId');

      res.status(200).json({
        success: true,
        message: 'Parameter-cycle association updated successfully',
        data: populatedAssociation
      });

    } catch (error) {
      console.error('Error in updateParameterCycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update parameter-cycle association',
        error: error.message
      });
    }
  }

  // Update cycle-specific settings
  static async updateCycleSettings(req, res) {
    try {
      const { id } = req.params;
      const { cycleSpecificSettings } = req.body;

      if (!cycleSpecificSettings) {
        return res.status(400).json({
          success: false,
          message: 'Cycle specific settings are required'
        });
      }

      const association = await ParameterCycle.findOne({ _id: id, deletedAt: null });

      if (!association) {
        return res.status(404).json({
          success: false,
          message: 'Parameter-cycle association not found'
        });
      }

      await association.updateCycleSettings(cycleSpecificSettings, req.user?.id || 'system');

      res.status(200).json({
        success: true,
        message: 'Cycle settings updated successfully',
        data: {
          id: association._id,
          cycleSpecificSettings: association.cycleSpecificSettings
        }
      });

    } catch (error) {
      console.error('Error in updateCycleSettings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update cycle settings',
        error: error.message
      });
    }
  }

  // Add yearly override
  static async addYearlyOverride(req, res) {
    try {
      const { id } = req.params;
      const { year, overrides } = req.body;

      if (!year || !overrides) {
        return res.status(400).json({
          success: false,
          message: 'Year and overrides are required'
        });
      }

      const association = await ParameterCycle.findOne({ _id: id, deletedAt: null });

      if (!association) {
        return res.status(404).json({
          success: false,
          message: 'Parameter-cycle association not found'
        });
      }

      await association.addYearlyOverride(year, overrides, req.user?.id || 'system');

      res.status(200).json({
        success: true,
        message: 'Yearly override added successfully',
        data: {
          id: association._id,
          year,
          overrides: association.cycleSpecificSettings.yearlyOverrides
        }
      });

    } catch (error) {
      console.error('Error in addYearlyOverride:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add yearly override',
        error: error.message
      });
    }
  }

  // Inherit parameters from another cycle
  static async inheritParameters(req, res) {
    try {
      const { fromCycleId, toCycleId, options = {} } = req.body;

      if (!fromCycleId || !toCycleId) {
        return res.status(400).json({
          success: false,
          message: 'Source and target cycle IDs are required'
        });
      }

      // Verify both cycles exist
      const [fromCycle, toCycle] = await Promise.all([
        Cycle.findOne({ _id: fromCycleId, deletedAt: null }),
        Cycle.findOne({ _id: toCycleId, deletedAt: null })
      ]);

      if (!fromCycle || !toCycle) {
        return res.status(404).json({
          success: false,
          message: 'One or both cycles not found'
        });
      }

      const inheritedParameters = await ParameterCycle.inheritParametersFromCycle(
        fromCycleId,
        toCycleId,
        req.user?.id || 'system',
        options
      );

      res.status(200).json({
        success: true,
        message: `Successfully inherited ${inheritedParameters.length} parameters`,
        data: {
          fromCycle: { id: fromCycle._id, name: fromCycle.name },
          toCycle: { id: toCycle._id, name: toCycle.name },
          inheritedCount: inheritedParameters.length,
          inheritedParameters: inheritedParameters.map(p => ({
            id: p._id,
            parameterId: p.parameterId,
            inheritedAt: p.createdAt
          }))
        }
      });

    } catch (error) {
      console.error('Error in inheritParameters:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to inherit parameters',
        error: error.message
      });
    }
  }

  // Activate parameter in cycle
  static async activateParameter(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const association = await ParameterCycle.findOne({ _id: id, deletedAt: null });

      if (!association) {
        return res.status(404).json({
          success: false,
          message: 'Parameter-cycle association not found'
        });
      }

      await association.activate(req.user?.id || 'system');

      res.status(200).json({
        success: true,
        message: 'Parameter activated in cycle',
        data: {
          id: association._id,
          isActive: association.isActive,
          activatedAt: association.activatedAt
        }
      });

    } catch (error) {
      console.error('Error in activateParameter:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to activate parameter',
        error: error.message
      });
    }
  }

  // Deactivate parameter in cycle
  static async deactivateParameter(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const association = await ParameterCycle.findOne({ _id: id, deletedAt: null });

      if (!association) {
        return res.status(404).json({
          success: false,
          message: 'Parameter-cycle association not found'
        });
      }

      await association.deactivate(req.user?.id || 'system', reason);

      res.status(200).json({
        success: true,
        message: 'Parameter deactivated in cycle',
        data: {
          id: association._id,
          isActive: association.isActive,
          deactivatedAt: association.deactivatedAt
        }
      });

    } catch (error) {
      console.error('Error in deactivateParameter:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate parameter',
        error: error.message
      });
    }
  }

  // Soft delete parameter-cycle association
  static async deleteParameterCycle(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const association = await ParameterCycle.findOne({ _id: id, deletedAt: null });

      if (!association) {
        return res.status(404).json({
          success: false,
          message: 'Parameter-cycle association not found'
        });
      }

      await association.softDelete(req.user?.id || 'system', reason);

      res.status(200).json({
        success: true,
        message: 'Parameter-cycle association deleted successfully'
      });

    } catch (error) {
      console.error('Error in deleteParameterCycle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete parameter-cycle association',
        error: error.message
      });
    }
  }

  // Get inheritance history for a parameter
  static async getInheritanceHistory(req, res) {
    try {
      const { parameterId } = req.params;

      const associations = await ParameterCycle.find({
        parameterId: parseInt(parameterId),
        deletedAt: null
      })
      .populate('cycleId', 'name cycleName startYear endYear')
      .populate('inheritedFromCycle', 'name cycleName')
      .sort({ createdAt: 1 });

      const inheritanceChain = associations.map(assoc => ({
        id: assoc._id,
        cycle: assoc.cycleId,
        inheritedFrom: assoc.inheritedFromCycle,
        inheritanceHistory: assoc.inheritanceHistory,
        isOriginal: !assoc.inheritedFromCycle,
        createdAt: assoc.createdAt
      }));

      res.status(200).json({
        success: true,
        data: {
          parameterId: parseInt(parameterId),
          inheritanceChain,
          totalCycles: inheritanceChain.length
        }
      });

    } catch (error) {
      console.error('Error in getInheritanceHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve inheritance history',
        error: error.message
      });
    }
  }

  // Get performance metrics for parameter-cycle
  static async getPerformanceMetrics(req, res) {
    try {
      const { id } = req.params;

      const association = await ParameterCycle.findOne({ _id: id, deletedAt: null })
        .populate('parameterId', 'name unit')
        .populate('cycleId', 'name currentActiveYear');

      if (!association) {
        return res.status(404).json({
          success: false,
          message: 'Parameter-cycle association not found'
        });
      }

      // Get submission data (when ParameterSubmission is available)
      const submissionData = await this.getSubmissionMetrics(id);

      // Update performance metrics
      if (submissionData.totalSubmissions > 0) {
        await association.updatePerformanceMetrics(submissionData);
      }

      res.status(200).json({
        success: true,
        data: {
          association: {
            id: association._id,
            parameter: association.parameterId,
            cycle: association.cycleId
          },
          performanceMetrics: association.performanceMetrics,
          submissionData
        }
      });

    } catch (error) {
      console.error('Error in getPerformanceMetrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve performance metrics',
        error: error.message
      });
    }
  }

  // Helper method to get submission metrics
  static async getSubmissionMetrics(parameterCycleId) {
    try {
      // This would use ParameterSubmission model when available
      // For now, return placeholder data
      return {
        totalSubmissions: 0,
        averageValue: 0,
        lastSubmissionDate: null,
        bestPerformingYear: null,
        worstPerformingYear: null,
        yearlyAverages: []
      };
    } catch (error) {
      console.error('Error getting submission metrics:', error);
      return {
        totalSubmissions: 0,
        averageValue: 0,
        yearlyAverages: []
      };
    }
  }
}

module.exports = ParameterCycleController;