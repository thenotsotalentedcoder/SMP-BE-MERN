const AnalyticsService = require('../services/AnalyticsService');

class AnalyticsDashboardController {

  // GET /api/analytics/scorecard?cycleId=X&year=Y
  static async getScorecard(req, res) {
    try {
      const { cycleId, year } = req.query;

      if (!cycleId) {
        // Try to find the active cycle
        const Cycle = require('../models/Cycle');
        const activeCycle = await Cycle.findOne({ isActive: true, deletedAt: null });
        if (!activeCycle) {
          return res.status(404).json({ success: false, message: 'No active cycle found. Please activate a cycle first.' });
        }
        req.query.cycleId = activeCycle._id.toString();
      }

      const data = await AnalyticsService.getScorecard(req.query.cycleId, year);

      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getScorecard:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /api/analytics/drill?cycleId=X&year=Y&categoryId=Z&deptId=W
  static async getDrillDown(req, res) {
    try {
      const { cycleId, year, categoryId, deptId } = req.query;

      if (!cycleId) {
        const Cycle = require('../models/Cycle');
        const activeCycle = await Cycle.findOne({ isActive: true, deletedAt: null });
        if (!activeCycle) {
          return res.status(404).json({ success: false, message: 'No active cycle found.' });
        }
        req.query.cycleId = activeCycle._id.toString();
      }

      const data = await AnalyticsService.getDrillDown(req.query.cycleId, year, categoryId, deptId);

      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error in getDrillDown:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = AnalyticsDashboardController;
