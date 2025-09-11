const ParameterService = require('../services/ParameterService');

class ParameterController {
  // GET /api/parameters (exact replica)
  async getParameters(req, res) {
    try {
      const { page = 1, pageSize = 10, search = null } = req.query;

      const parameters = await ParameterService.getParametersAsync(
        parseInt(page), 
        parseInt(pageSize), 
        search
      );

      return res.json({
        Status: true,
        Data: parameters.List,
        TotalCount: parameters.Count,
        Page: parseInt(page),
        PageSize: parseInt(pageSize),
        Message: "parameters Fetched!"
      });

    } catch (error) {
      console.error('Get parameters error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/parameters/cycles (exact replica)
  async getCycles(req, res) {
    try {
      const { page = 1, pageSize = 10, search = null } = req.query;

      const cycles = await ParameterService.getCyclesAsync(
        parseInt(page), 
        parseInt(pageSize), 
        search
      );

      return res.json({
        Status: true,
        Data: cycles.List,
        TotalCount: cycles.Count,
        Page: parseInt(page),
        PageSize: parseInt(pageSize),
        Message: "Cycles Fetched!"
      });

    } catch (error) {
      console.error('Get cycles error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/parameters/by-category (exact replica)
  async getParametersByCategory(req, res) {
    try {
      const { category } = req.query;

      if (!category) {
        return res.status(400).json({
          Status: false,
          Message: "Category parameter is required"
        });
      }

      const parameters = await ParameterService.getParametersByCategoryAsync(category, req);

      // Map _id to id for frontend compatibility
      const mappedParameters = parameters.List.map(param => {
        const paramObj = param.toObject ? param.toObject() : param;
        return {
          ...paramObj,
          id: paramObj._id
        };
      });

      return res.json({
        Status: true,
        Data: mappedParameters,
        TotalCount: parameters.Count,
        Message: "parameters Fetched!"
      });

    } catch (error) {
      console.error('Get parameters by category error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/parameters/:id (exact replica)
  async getParameter(req, res) {
    try {
      const { id } = req.params;

      const parameter = await ParameterService.getParameterAsync(id);

      if (!parameter) {
        return res.status(404).json({
          Status: false,
          Message: "Parameter not found"
        });
      }

      return res.json({
        Status: true,
        Data: parameter
      });

    } catch (error) {
      console.error('Get parameter error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // POST /api/parameters (exact replica)
  async createParameter(req, res) {
    try {
      const parameterData = req.body;

      const createdParameter = await ParameterService.createParameterAsync(parameterData);

      return res.json({
        Status: true,
        Data: createdParameter,
        Message: "Parameter created successfully!"
      });

    } catch (error) {
      console.error('Create parameter error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // PUT /api/parameters/:id (exact replica)
  async updateParameter(req, res) {
    try {
      const { id } = req.params;
      const parameterData = req.body;

      const parameter = await ParameterService.getParameterAsync(id);
      if (!parameter) {
        return res.status(404).json({
          Status: false,
          Message: "Parameter not found"
        });
      }

      const updatedParameter = await ParameterService.updateParameterAsync(parameter, parameterData);

      return res.json({
        Status: true,
        Data: updatedParameter,
        Message: "Parameter updated successfully!"
      });

    } catch (error) {
      console.error('Update parameter error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // DELETE /api/parameters/:id (exact replica)
  async deleteParameter(req, res) {
    try {
      const { id } = req.params;

      const parameter = await ParameterService.getParameterAsync(id);
      if (!parameter) {
        return res.status(404).json({
          Status: false,
          Message: "Parameter not found"
        });
      }

      const deleted = await ParameterService.deleteParameterAsync(parameter);
      
      if (deleted) {
        return res.status(204).send(); // No content
      } else {
        return res.status(500).json({
          Status: false,
          Message: "Failed to delete parameter"
        });
      }

    } catch (error) {
      console.error('Delete parameter error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }
}

module.exports = new ParameterController();