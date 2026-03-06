const RatingService = require('../services/RatingService');

class YearlyRatingController {
  // POST /api/yearly-rating (exact replica)
  async submitRatings(req, res) {
    try {
      const ratingsData = req.body;

      const submitRating = await RatingService.submitRatings(ratingsData, req);

      return res.json({
        Status: true,
        Data: submitRating,
        Message: "Ratings submitted successfully!"
      });

    } catch (error) {
      console.error('Submit ratings error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/yearly-rating/all (new method for ratings report)
  async getAllRatings(req, res) {
    try {
      const { page = 1, pageSize = 10, departmentId, facultyId, cycle, category } = req.query;
      
      const filters = {
        departmentId: departmentId || '',
        facultyId: facultyId || '',
        cycle: cycle || '',
        category: category || ''
      };

      const result = await RatingService.getAllRatings(filters, parseInt(page), parseInt(pageSize), req);

      return res.json({
        Status: true,
        Data: result,
        Message: "Ratings Fetched Successfully!"
      });

    } catch (error) {
      console.error('Get all ratings error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/yearly-rating (exact replica)
  async getPastRatings(req, res) {
    try {
      const { categoryName } = req.query;

      if (!categoryName) {
        return res.status(400).json({
          Status: false,
          Message: "categoryName parameter is required"
        });
      }

      const ratings = await RatingService.getPastRatings(categoryName, req);

      return res.json({
        Status: true,
        Data: ratings,
        Message: "Ratings Fetched!"
      });

    } catch (error) {
      console.error('Get past ratings error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/yearly-rating/by-parameter/:parameterId
  async getRatingsByParameter(req, res) {
    try {
      const { parameterId } = req.params;
      const { category } = req.query;

      const ratings = await RatingService.getRatingsByParameter(parameterId, category, req);

      return res.json({
        Status: true,
        Data: ratings,
        Message: "Ratings Fetched!"
      });

    } catch (error) {
      console.error('Get ratings by parameter error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/yearly-rating/by-department/:deptID (enhanced with cycle and category filters)
  async getRatingsByDepartment(req, res) {
    try {
      const { deptID } = req.params;
      const { cycleId, categoryId } = req.query;

      const deptId = deptID ? parseInt(deptID) : 0;
      const cycle = cycleId ? parseInt(cycleId) : null;
      const category = categoryId ? parseInt(categoryId) : null;

      console.log(`📊 getRatingsByDepartment API - dept: ${deptId}, cycle: ${cycle}, category: ${category}`);

      const ratings = await RatingService.getRatingsByDepartment(deptId, cycle, category, req);

      return res.json({
        Status: true,
        Data: ratings,
        Message: "Ratings Fetched!"
      });

    } catch (error) {
      console.error('Get ratings by department error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // ➕ NEW: POST /api/yearly-rating/submit-parameter - Submit individual parameter
  async submitIndividualParameter(req, res) {
    try {
      const { parameterId, cycle, values } = req.body;
      const user = req.user; // From authentication middleware

      if (!parameterId || !cycle || !values) {
        return res.status(400).json({
          Status: false,
          Message: "Parameter ID, cycle, and values are required"
        });
      }

      if (!user) {
        return res.status(401).json({
          Status: false,
          Message: "User authentication required"
        });
      }

      console.log(`📝 Submitting individual parameter: ${parameterId}, cycle: ${cycle}, user: ${user.userName}`);

      // Submit individual parameter for specific cycle
      const submission = await RatingService.submitIndividualParameter(
        parameterId,
        cycle,
        values,
        user
      );

      return res.json({
        Status: true,
        Data: submission,
        Message: "Parameter submitted successfully!"
      });

    } catch (error) {
      console.error('Submit individual parameter error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }
  // POST /api/yearly-rating/submit-targets - Submit target values for all cycle years
  async submitTargetValues(req, res) {
    try {
      const { parameterId, targetValues, overallTarget } = req.body;
      const user = req.user;

      if (!parameterId || !targetValues || !Array.isArray(targetValues) || targetValues.length === 0) {
        return res.status(400).json({
          Status: false,
          Message: "Parameter ID and targetValues array are required"
        });
      }

      if (!user) {
        return res.status(401).json({
          Status: false,
          Message: "User authentication required"
        });
      }

      const result = await RatingService.submitTargetValues(parameterId, targetValues, overallTarget, user);

      return res.json({
        Status: true,
        Data: result,
        Message: "Target values submitted and locked successfully!"
      });

    } catch (error) {
      console.error('Submit target values error:', error);
      const statusCode = error.message.includes('already been submitted') ? 409 : 500;
      return res.status(statusCode).json({
        Status: false,
        Message: error.message || 'Internal server error'
      });
    }
  }
}

module.exports = new YearlyRatingController();