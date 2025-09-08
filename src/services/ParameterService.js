const Parameter = require('../models/Parameter');
const Cycle = require('../models/Cycle');
const Counter = require('../models/Counter');
const HelperService = require('./HelperService');

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
}

module.exports = new ParameterService();