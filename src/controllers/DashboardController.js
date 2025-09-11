const Category = require('../models/Category');
const Parameter = require('../models/Parameter');
const YearlyRating = require('../models/YearlyRating');
const HelperService = require('../services/HelperService');

class DashboardController {
  // GET /api/dashboard/statistics
  async getDashboardStatistics(req, res) {
    try {
      const currentUser = await HelperService.getLoggedUser(req);
      if (!currentUser) {
        return res.status(401).json({
          Status: false,
          Message: "User not found or not logged in"
        });
      }

      // Get all active categories
      const categories = await Category.find({ deletedAt: null }).sort({ sortOrder: 1 });
      
      // Get parameter counts per category
      const categoryStats = await Promise.all(
        categories.map(async (category) => {
          // Count parameters in this category
          const parameterCount = await Parameter.countDocuments({
            category: category.name,
            deletedAt: null
          });

          // Count submitted ratings for this category by current user
          const submittedCount = await YearlyRating.countDocuments({
            categoryId: category._id,
            userId: currentUser._id,
            deletedAt: null
          });

          return {
            id: category._id,
            _id: category._id,
            name: category.name,
            description: category.description,
            sortOrder: category.sortOrder,
            parameterCount: parameterCount,
            submittedCount: submittedCount,
            TotalCount: parameterCount,
            SubmittedCount: submittedCount,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt
          };
        })
      );

      // Calculate overall statistics
      const totalParameters = categoryStats.reduce((sum, cat) => sum + cat.parameterCount, 0);
      const totalSubmitted = categoryStats.reduce((sum, cat) => sum + cat.submittedCount, 0);
      const overallProgress = totalParameters > 0 ? (totalSubmitted / totalParameters) * 100 : 0;

      return res.json({
        Status: true,
        Data: {
          categories: categoryStats,
          overall: {
            totalParameters,
            totalSubmitted,
            progressPercentage: Math.round(overallProgress * 100) / 100
          }
        },
        Message: "Dashboard statistics fetched successfully"
      });

    } catch (error) {
      console.error('Dashboard statistics error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/dashboard/overview
  async getDashboardOverview(req, res) {
    try {
      const currentUser = await HelperService.getLoggedUser(req);
      if (!currentUser) {
        return res.status(401).json({
          Status: false,
          Message: "User not found or not logged in"
        });
      }

      // Get counts
      const totalCategories = await Category.countDocuments({ deletedAt: null });
      const totalParameters = await Parameter.countDocuments({ deletedAt: null });
      const userSubmissions = await YearlyRating.countDocuments({ 
        userId: currentUser._id,
        deletedAt: null 
      });

      return res.json({
        Status: true,
        Data: {
          totalCategories,
          totalParameters,
          userSubmissions,
          completionRate: totalParameters > 0 ? (userSubmissions / totalParameters) * 100 : 0
        },
        Message: "Dashboard overview fetched successfully"
      });

    } catch (error) {
      console.error('Dashboard overview error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }
}

module.exports = new DashboardController();