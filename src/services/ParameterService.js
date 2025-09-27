const Parameter = require('../models/Parameter');
const Cycle = require('../models/Cycle');
const Counter = require('../models/Counter');
const HelperService = require('./HelperService');
const UserGroupService = require('./UserGroupService'); // ➕ NEW: Import UserGroupService

class ParameterService {
  // Get parameters with pagination and search (exact replica)
  async getParametersAsync(page = 1, pageSize = 10, search = null) {
    try {
      const skip = (page - 1) * pageSize;
      
      // Build query
      let query = { deletedAt: null, isActive: true };
      
      if (search && search.trim()) {
        query.$or = [
          { parameterName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } }
        ];
      }

      // Get total count
      const totalCount = await Parameter.countDocuments(query);
      
      // Get parameters with pagination
      const parameters = await Parameter.find(query)
        .populate('cycle')
        .sort({ sortOrder: 1, parameterName: 1 })
        .skip(skip)
        .limit(pageSize);

      return {
        List: parameters,
        Count: totalCount
      };
    } catch (error) {
      console.error('Error getting parameters:', error);
      throw error;
    }
  }

  // Get cycles with pagination and search (exact replica)
  async getCyclesAsync(page = 1, pageSize = 10, search = null) {
    try {
      const skip = (page - 1) * pageSize;
      
      // Build query
      let query = { deletedAt: null };
      
      if (search && search.trim()) {
        query.name = { $regex: search, $options: 'i' };
      }

      // Get total count
      const totalCount = await Cycle.countDocuments(query);
      
      // Get cycles with pagination
      const cycles = await Cycle.find(query)
        .sort({ startYear: -1, name: 1 })
        .skip(skip)
        .limit(pageSize);

      return {
        List: cycles,
        Count: totalCount
      };
    } catch (error) {
      console.error('Error getting cycles:', error);
      throw error;
    }
  }

  // Get parameters by category (exact replica)
  async getParametersByCategoryAsync(category, context) {
    try {
      const currentUser = await HelperService.getLoggedUser(context);
      
      let query = { 
        category: category,
        deletedAt: null, 
        isActive: true 
      };

      // Filter by user role if parameterRoles is specified
      const parameters = await Parameter.find(query)
        .populate('cycle')
        .sort({ sortOrder: 1, parameterName: 1 });

      // Filter by user role (if parameterRoles contains user's role)
      const filteredParameters = parameters.filter(param => {
        if (!param.parameterRoles || param.parameterRoles.trim() === '') {
          return true; // No role restriction
        }
        
        if (!currentUser || !currentUser.userRole) {
          return false; // No user or role
        }

        const allowedRoles = param.parameterRoles.split(',').map(r => r.trim());
        return allowedRoles.includes(currentUser.userRole);
      });

      return {
        List: filteredParameters,
        Count: filteredParameters.length
      };
    } catch (error) {
      console.error('Error getting parameters by category:', error);
      throw error;
    }
  }

  // Get single parameter by ID (exact replica)
  async getParameterAsync(id) {
    try {
      const parameter = await Parameter.findOne({
        _id: id,
        deletedAt: null
      }).populate('cycle');

      return parameter;
    } catch (error) {
      console.error('Error getting parameter:', error);
      throw error;
    }
  }

  // Create parameter (exact replica with auto-increment ID)
  async createParameterAsync(parameterData) {
    try {
      // Generate auto-increment ID
      const parameterId = await Counter.getNextSequence('parameter');
      
      const newParameter = new Parameter({
        _id: parameterId,
        parameterName: parameterData.ParameterName || parameterData.parameterName,
        parameterType: parameterData.ParameterType || parameterData.parameterType,
        description: parameterData.Description || parameterData.description,
        year: parameterData.Year || parameterData.year,
        isActive: parameterData.IsActive !== undefined ? 
          parameterData.IsActive : (parameterData.isActive !== undefined ? parameterData.isActive : true),
        category: parameterData.Category || parameterData.category,
        cycle: parameterData.Cycle || parameterData.cycle,
        parameterRoles: parameterData.ParameterRoles || parameterData.parameterRoles || '',
        // ➕ NEW: Handle group access fields
        accessibleToGroups: parameterData.accessibleToGroups || ['Academic Departments'],
        restrictedAccess: parameterData.restrictedAccess !== undefined ? parameterData.restrictedAccess : true,
        sortOrder: parameterData.SortOrder || parameterData.sortOrder || 0
      });

      const savedParameter = await newParameter.save();
      await savedParameter.populate('cycle');
      
      return savedParameter;
    } catch (error) {
      console.error('Error creating parameter:', error);
      throw error;
    }
  }

  // Update parameter (exact replica)
  async updateParameterAsync(parameter, parameterData) {
    try {
      if (!parameter) {
        throw new Error('Parameter not found');
      }

      // Update fields
      parameter.parameterName = parameterData.ParameterName || parameterData.parameterName || parameter.parameterName;
      parameter.parameterType = parameterData.ParameterType || parameterData.parameterType || parameter.parameterType;
      parameter.description = parameterData.Description || parameterData.description || parameter.description;
      parameter.year = parameterData.Year !== undefined ? 
        parameterData.Year : (parameterData.year !== undefined ? parameterData.year : parameter.year);
      parameter.isActive = parameterData.IsActive !== undefined ? 
        parameterData.IsActive : (parameterData.isActive !== undefined ? parameterData.isActive : parameter.isActive);
      parameter.category = parameterData.Category || parameterData.category || parameter.category;
      parameter.cycle = parameterData.Cycle || parameterData.cycle || parameter.cycle;
      parameter.parameterRoles = parameterData.ParameterRoles || parameterData.parameterRoles || parameter.parameterRoles;
      // ➕ NEW: Handle group access fields in updates
      if (parameterData.accessibleToGroups !== undefined) {
        parameter.accessibleToGroups = parameterData.accessibleToGroups;
      }
      if (parameterData.restrictedAccess !== undefined) {
        parameter.restrictedAccess = parameterData.restrictedAccess;
      }
      parameter.sortOrder = parameterData.SortOrder !== undefined ?
        parameterData.SortOrder : (parameterData.sortOrder !== undefined ? parameterData.sortOrder : parameter.sortOrder);
      parameter.updatedAt = new Date();

      const updatedParameter = await parameter.save();
      await updatedParameter.populate('cycle');
      
      return updatedParameter;
    } catch (error) {
      console.error('Error updating parameter:', error);
      throw error;
    }
  }

  // Delete parameter (soft delete - exact replica)
  async deleteParameterAsync(parameter) {
    try {
      if (!parameter) {
        return false;
      }

      // Soft delete
      parameter.deletedAt = new Date();
      parameter.isActive = false;
      await parameter.save();
      
      return true;
    } catch (error) {
      console.error('Error deleting parameter:', error);
      return false;
    }
  }

  // Create cycle (for production completeness)
  async createCycleAsync(cycleData) {
    try {
      // Generate auto-increment ID
      const cycleId = await Counter.getNextSequence('cycle');

      const newCycle = new Cycle({
        _id: cycleId,
        name: cycleData.Name || cycleData.name,
        startYear: new Date(cycleData.StartYear || cycleData.startYear),
        endYear: new Date(cycleData.EndYear || cycleData.endYear)
      });

      const savedCycle = await newCycle.save();
      return savedCycle;
    } catch (error) {
      console.error('Error creating cycle:', error);
      throw error;
    }
  }

  // ➕ NEW: Get parameters filtered by user's group access
  async getParametersForUserAsync(user, page = 1, pageSize = 10, search = null) {
    try {
      const skip = (page - 1) * pageSize;

      // Build base query
      let query = { deletedAt: null, isActive: true };

      if (search && search.trim()) {
        query.$or = [
          { parameterName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } }
        ];
      }

      // Get all parameters matching base criteria
      const allParameters = await Parameter.find(query)
        .populate('cycle')
        .sort({ sortOrder: 1, parameterName: 1 });

      // Filter by user's group access
      const filteredParameters = UserGroupService.filterParametersForUser(allParameters, user);

      // Apply pagination to filtered results
      const totalCount = filteredParameters.length;
      const paginatedParameters = filteredParameters.slice(skip, skip + pageSize);

      return {
        List: paginatedParameters,
        Count: totalCount
      };
    } catch (error) {
      console.error('Error getting parameters for user:', error);
      throw error;
    }
  }

  // ➕ NEW: Get parameters by category filtered by user's group access
  async getParametersByCategoryForUserAsync(category, user) {
    try {
      let query = {
        category: category,
        deletedAt: null,
        isActive: true
      };

      const allParameters = await Parameter.find(query)
        .populate('cycle')
        .sort({ sortOrder: 1, parameterName: 1 });

      // Filter by user's group access
      const filteredParameters = UserGroupService.filterParametersForUser(allParameters, user);

      return {
        List: filteredParameters,
        Count: filteredParameters.length
      };
    } catch (error) {
      console.error('Error getting parameters by category for user:', error);
      throw error;
    }
  }

  // ➕ NEW: Get available user groups for dropdown
  async getAvailableUserGroups() {
    try {
      return UserGroupService.getAvailableGroups();
    } catch (error) {
      console.error('Error getting available user groups:', error);
      throw error;
    }
  }

  // ➕ NEW: Get parameter list for category (minimal data for list view)
  async getParameterListByCategory(categoryName, user) {
    try {
      let query = {
        category: categoryName,
        deletedAt: null
      };

      // Apply group access control (reuse existing logic from UserGroupService)
      if (!UserGroupService.isAdmin(user)) {
        const userGroup = UserGroupService.getUserGroup(user);
        console.log(`🔐 Applying group access control for user group: ${userGroup}`);

        query.$or = [
          { restrictedAccess: false },
          { restrictedAccess: { $exists: false } }, // Legacy parameters without access control
          { accessibleToGroups: { $in: [userGroup] } }
        ];
      } else {
        console.log(`👑 Admin user - no access control applied`);
      }

      // Get only essential fields for list view (performance optimization)
      const parameters = await Parameter.find(query, {
        _id: 1,
        parameterName: 1,
        parameterType: 1,
        description: 1
      }).sort({ sortOrder: 1 });

      console.log(`📋 Found ${parameters.length} parameters for category: ${categoryName}`);

      // Map to consistent format
      return parameters.map(param => ({
        id: param._id,
        name: param.parameterName,
        parameterType: param.parameterType,
        description: param.description || ''
      }));

    } catch (error) {
      console.error('Error getting parameter list by category:', error);
      throw error;
    }
  }

  // ➕ NEW: Get complete parameter details for expansion
  async getParameterDetails(parameterId, userId) {
    try {
      console.log(`📊 Getting parameter details for ID: ${parameterId}, User: ${userId}`);

      // Get complete parameter data
      const parameter = await Parameter.findOne({
        _id: parameterId,
        deletedAt: null
      }).populate('cycle');

      if (!parameter) {
        throw new Error('Parameter not found');
      }

      // Get cycle information (for now, hardcoded - will be dynamic with cycle management)
      const cycles = [
        { year: 2024, enabled: true, isTarget: false },
        { year: 2025, enabled: false, isTarget: false },
        { year: 2026, enabled: false, isTarget: false },
        { year: 2027, enabled: false, isTarget: false },
        { year: 2028, enabled: false, isTarget: false },
        { year: 2029, enabled: true, isTarget: true }
      ];

      // Get submitted values for this parameter and user
      const submittedValues = await YearlyRating.find({
        parameterId: parameterId,
        userId: userId,
        deletedAt: null
      });

      console.log(`📈 Found ${submittedValues.length} submitted values for parameter ${parameterId}`);

      // Map submitted values by cycle year
      const submittedValuesMap = {};
      submittedValues.forEach(submission => {
        if (submission.ratingValues && submission.ratingValues.length > 0) {
          submission.ratingValues.forEach(value => {
            submittedValuesMap[value.year] = {
              actualValue: value.actualValue,
              projectedValue: value.projectedValue,
              textValue: value.textValue,
              submittedAt: submission.createdAt,
              isReadOnly: true
            };
          });
        }
      });

      return {
        parameter: {
          id: parameter._id,
          name: parameter.parameterName,
          parameterType: parameter.parameterType,
          description: parameter.description,
          maxValue: parameter.maxValue || 100,
          category: parameter.category
        },
        cycles: cycles,
        submittedValues: submittedValuesMap
      };

    } catch (error) {
      console.error('Error getting parameter details:', error);
      throw error;
    }
  }
}

module.exports = new ParameterService();