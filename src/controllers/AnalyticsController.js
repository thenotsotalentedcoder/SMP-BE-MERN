const Cycle = require('../models/Cycle');
const ParameterCycle = require('../models/ParameterCycle');
const ParameterSubmission = require('../models/ParameterSubmission');
const User = require('../models/User');
const Parameter = require('../models/Parameter');

// Analytics and Reporting Controller
// 🎯 PURPOSE: Comprehensive analytics for cycles, parameters, submissions, and performance

class AnalyticsController {
  // Get dashboard overview
  static async getDashboardOverview(req, res) {
    try {
      const { cycleId, year } = req.query;

      // Get user's accessible cycles
      let accessibleCycles = [];
      if (req.user?.role === 'Admin') {
        accessibleCycles = await Cycle.find({ deletedAt: null }).select('_id');
      } else {
        // Get cycles user has access to
        const user = await User.findById(req.user?.id);
        if (user?.cycleAccess?.currentCycleId) {
          accessibleCycles = [{ _id: user.cycleAccess.currentCycleId }];
        }
      }

      if (accessibleCycles.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            message: 'No accessible cycles found',
            overview: {}
          }
        });
      }

      const targetCycleId = cycleId ? parseInt(cycleId) : accessibleCycles[0]._id;

      // Get overview data
      const [
        cycleOverview,
        parameterStats,
        submissionStats,
        userStats,
        performanceMetrics
      ] = await Promise.all([
        this.getCycleOverview(targetCycleId),
        this.getParameterStats(targetCycleId),
        this.getSubmissionStats(targetCycleId, year),
        this.getUserStats(targetCycleId),
        this.getPerformanceMetrics(targetCycleId, year)
      ]);

      const dashboard = {
        cycleOverview,
        parameterStats,
        submissionStats,
        userStats,
        performanceMetrics,
        accessibleCycles: accessibleCycles.map(c => c._id),
        generatedAt: new Date()
      };

      res.status(200).json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      console.error('Error in getDashboardOverview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate dashboard overview',
        error: error.message
      });
    }
  }

  // Get detailed cycle analytics
  static async getCycleAnalytics(req, res) {
    try {
      const { cycleId } = req.params;
      const { includeComparisons = false } = req.query;

      const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });
      if (!cycle) {
        return res.status(404).json({
          success: false,
          message: 'Cycle not found'
        });
      }

      // Check access permissions
      const hasAccess = await this.checkCycleAccess(req.user, cycleId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this cycle'
        });
      }

      const analytics = {
        cycle: {
          id: cycle._id,
          name: cycle.name,
          cycleName: cycle.cycleName,
          status: cycle.status,
          isActive: cycle.isActive,
          yearRange: cycle.yearRange,
          currentActiveYear: cycle.currentActiveYear,
          targetYear: cycle.targetYear,
          progressPercentage: cycle.progressPercentage,
          isInProgress: cycle.isInProgress,
          cycleYears: cycle.cycleYears
        },
        yearlyBreakdown: await this.getYearlyBreakdown(cycleId),
        parameterAnalytics: await this.getParameterAnalytics(cycleId),
        submissionAnalytics: await this.getSubmissionAnalytics(cycleId),
        performanceAnalytics: await this.getDetailedPerformanceAnalytics(cycleId),
        trendAnalysis: await this.getTrendAnalysis(cycleId),
        userEngagement: await this.getUserEngagementAnalytics(cycleId)
      };

      // Include comparisons with previous cycles if requested
      if (includeComparisons === 'true') {
        analytics.comparisons = await this.getCycleComparisons(cycleId);
      }

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error in getCycleAnalytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate cycle analytics',
        error: error.message
      });
    }
  }

  // Get parameter performance analytics
  static async getParameterAnalytics(req, res) {
    try {
      const {
        cycleId,
        parameterId,
        year,
        departmentId,
        facultyId,
        performanceStatus,
        includeHistory = false
      } = req.query;

      let filter = {};
      if (cycleId) filter.cycleId = parseInt(cycleId);
      if (parameterId) filter.parameterId = parseInt(parameterId);

      // Build submission filter
      let submissionFilter = { deletedAt: null, isLatestVersion: true };
      if (cycleId) submissionFilter.cycleId = parseInt(cycleId);
      if (parameterId) submissionFilter.parameterId = parseInt(parameterId);
      if (year) submissionFilter.submissionYear = parseInt(year);
      if (performanceStatus) submissionFilter.performanceStatus = performanceStatus;

      // Add user-based filtering for department/faculty
      if (departmentId || facultyId) {
        const userFilter = {};
        if (departmentId) userFilter.deptId = parseInt(departmentId);
        if (facultyId) userFilter.facultyId = parseInt(facultyId);

        const users = await User.find(userFilter).select('_id');
        submissionFilter.userId = { $in: users.map(u => u._id) };
      }

      const [parameterCycles, submissions] = await Promise.all([
        ParameterCycle.find(filter)
          .populate('parameterId', 'name description unit measurementType category')
          .populate('cycleId', 'name currentActiveYear')
          .lean(),
        ParameterSubmission.find(submissionFilter)
          .populate('parameterId', 'name')
          .populate('userId', 'firstName lastName deptId facultyId')
          .lean()
      ]);

      // Analyze parameter performance
      const analytics = {
        totalParameters: parameterCycles.length,
        activeParameters: parameterCycles.filter(pc => pc.isActive).length,
        totalSubmissions: submissions.length,
        performanceBreakdown: this.analyzePerformanceBreakdown(submissions),
        categoryAnalysis: this.analyzeByCategoryOrDepartment(submissions, 'category'),
        departmentAnalysis: this.analyzeByCategoryOrDepartment(submissions, 'department'),
        yearlyTrends: this.analyzeYearlyTrends(submissions),
        topPerformers: this.getTopPerformers(submissions),
        underperformers: this.getUnderperformers(submissions)
      };

      // Include historical data if requested
      if (includeHistory === 'true' && parameterId) {
        analytics.historicalData = await this.getParameterHistory(parameterId);
      }

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error in getParameterAnalytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate parameter analytics',
        error: error.message
      });
    }
  }

  // Get submission analytics
  static async getSubmissionAnalytics(req, res) {
    try {
      const { cycleId, year, submissionType, timeframe = '30' } = req.query;

      const filter = { deletedAt: null };
      if (cycleId) filter.cycleId = parseInt(cycleId);
      if (year) filter.submissionYear = parseInt(year);
      if (submissionType) filter.submissionType = submissionType;

      // Time-based filtering
      const daysBack = parseInt(timeframe);
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      filter['submissionTimeline.finalSubmittedAt'] = { $gte: startDate };

      const submissions = await ParameterSubmission.find(filter)
        .populate('parameterId', 'name category')
        .populate('userId', 'firstName lastName userRole deptId facultyId')
        .lean();

      const analytics = {
        totalSubmissions: submissions.length,
        submissionsByType: this.groupByField(submissions, 'submissionType'),
        submissionsByStatus: this.groupByField(submissions, 'approvalStatus'),
        submissionsByPerformance: this.groupByField(submissions, 'performanceStatus'),
        submissionTimeline: this.analyzeSubmissionTimeline(submissions),
        approvalWorkflow: this.analyzeApprovalWorkflow(submissions),
        evidenceAnalysis: this.analyzeEvidence(submissions),
        qualityMetrics: this.analyzeQualityMetrics(submissions),
        userSubmissionPatterns: this.analyzeUserSubmissionPatterns(submissions)
      };

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error in getSubmissionAnalytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate submission analytics',
        error: error.message
      });
    }
  }

  // Get user performance analytics
  static async getUserAnalytics(req, res) {
    try {
      const { cycleId, departmentId, facultyId, role, includeActivity = false } = req.query;

      const userFilter = { deletedAt: null, isActive: true };
      if (cycleId) userFilter['cycleAccess.currentCycleId'] = parseInt(cycleId);
      if (departmentId) userFilter.deptId = parseInt(departmentId);
      if (facultyId) userFilter.facultyId = parseInt(facultyId);
      if (role) userFilter.userRole = role;

      const users = await User.find(userFilter)
        .populate('deptId', 'name')
        .populate('facultyId', 'name')
        .lean();

      // Get submission data for these users
      const userIds = users.map(u => u._id);
      const submissionFilter = { userId: { $in: userIds }, deletedAt: null };
      if (cycleId) submissionFilter.cycleId = parseInt(cycleId);

      const submissions = await ParameterSubmission.find(submissionFilter).lean();

      const analytics = {
        totalUsers: users.length,
        usersByRole: this.groupByField(users, 'userRole'),
        usersByDepartment: this.groupUsersByOrganization(users, 'deptId'),
        usersByFaculty: this.groupUsersByOrganization(users, 'facultyId'),
        activeUsers: users.filter(u => u.isCurrentlyActive).length,
        submissionStatistics: this.analyzeUserSubmissions(users, submissions),
        engagementMetrics: this.analyzeUserEngagement(users),
        accessPatterns: this.analyzeAccessPatterns(users)
      };

      // Include detailed activity if requested
      if (includeActivity === 'true') {
        analytics.detailedActivity = await this.getDetailedUserActivity(userIds, cycleId);
      }

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error in getUserAnalytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate user analytics',
        error: error.message
      });
    }
  }

  // Get comparative analytics
  static async getComparativeAnalytics(req, res) {
    try {
      const { cycleIds, years, departments, parameters } = req.query;

      if (!cycleIds && !years && !departments && !parameters) {
        return res.status(400).json({
          success: false,
          message: 'At least one comparison dimension is required'
        });
      }

      const comparisons = {};

      // Cycle comparisons
      if (cycleIds) {
        const cycleIdArray = cycleIds.split(',').map(id => parseInt(id));
        comparisons.cycles = await this.compareCycles(cycleIdArray);
      }

      // Year-over-year comparisons
      if (years) {
        const yearArray = years.split(',').map(year => parseInt(year));
        comparisons.years = await this.compareYears(yearArray);
      }

      // Department comparisons
      if (departments) {
        const deptArray = departments.split(',').map(id => parseInt(id));
        comparisons.departments = await this.compareDepartments(deptArray);
      }

      // Parameter comparisons
      if (parameters) {
        const paramArray = parameters.split(',').map(id => parseInt(id));
        comparisons.parameters = await this.compareParameters(paramArray);
      }

      res.status(200).json({
        success: true,
        data: {
          comparisons,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Error in getComparativeAnalytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate comparative analytics',
        error: error.message
      });
    }
  }

  // Export analytics data
  static async exportAnalytics(req, res) {
    try {
      const { type, format = 'json', cycleId, filters = {} } = req.query;

      const supportedTypes = ['dashboard', 'cycle', 'parameter', 'submission', 'user'];
      const supportedFormats = ['json', 'csv'];

      if (!supportedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported analytics type. Supported types: ${supportedTypes.join(', ')}`
        });
      }

      if (!supportedFormats.includes(format)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported format. Supported formats: ${supportedFormats.join(', ')}`
        });
      }

      let data;
      let filename;

      switch (type) {
        case 'dashboard':
          data = await this.generateDashboardExport(cycleId, filters);
          filename = `dashboard-${cycleId || 'all'}-${new Date().toISOString().split('T')[0]}`;
          break;
        case 'cycle':
          data = await this.generateCycleExport(cycleId, filters);
          filename = `cycle-${cycleId}-${new Date().toISOString().split('T')[0]}`;
          break;
        case 'parameter':
          data = await this.generateParameterExport(cycleId, filters);
          filename = `parameters-${cycleId || 'all'}-${new Date().toISOString().split('T')[0]}`;
          break;
        case 'submission':
          data = await this.generateSubmissionExport(cycleId, filters);
          filename = `submissions-${cycleId || 'all'}-${new Date().toISOString().split('T')[0]}`;
          break;
        case 'user':
          data = await this.generateUserExport(cycleId, filters);
          filename = `users-${cycleId || 'all'}-${new Date().toISOString().split('T')[0]}`;
          break;
      }

      if (format === 'csv') {
        const csv = this.convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json({
          success: true,
          data,
          exportedAt: new Date(),
          type,
          format
        });
      }

    } catch (error) {
      console.error('Error in exportAnalytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export analytics data',
        error: error.message
      });
    }
  }

  // Helper methods for analytics calculations
  static async getCycleOverview(cycleId) {
    const cycle = await Cycle.findById(cycleId);
    if (!cycle) return null;

    return {
      id: cycle._id,
      name: cycle.name,
      status: cycle.status,
      isActive: cycle.isActive,
      currentActiveYear: cycle.currentActiveYear,
      targetYear: cycle.targetYear,
      progressPercentage: cycle.progressPercentage,
      totalYears: cycle.cycleYears ? cycle.cycleYears.length : 0,
      yearRange: cycle.yearRange
    };
  }

  static async getParameterStats(cycleId) {
    const total = await ParameterCycle.countDocuments({ cycleId, deletedAt: null });
    const active = await ParameterCycle.countDocuments({ cycleId, isActive: true, deletedAt: null });
    const inherited = await ParameterCycle.countDocuments({ cycleId, inheritedFromCycle: { $ne: null }, deletedAt: null });

    return {
      total,
      active,
      inactive: total - active,
      inherited,
      original: total - inherited,
      activationRate: total > 0 ? Math.round((active / total) * 100) : 0
    };
  }

  static async getSubmissionStats(cycleId, year) {
    const filter = { cycleId, deletedAt: null };
    if (year) filter.submissionYear = parseInt(year);

    const total = await ParameterSubmission.countDocuments(filter);
    const approved = await ParameterSubmission.countDocuments({ ...filter, approvalStatus: 'approved' });
    const pending = await ParameterSubmission.countDocuments({ ...filter, approvalStatus: 'pending' });
    const projected = await ParameterSubmission.countDocuments({ ...filter, submissionType: 'projected' });
    const actual = await ParameterSubmission.countDocuments({ ...filter, submissionType: 'actual' });

    return {
      total,
      approved,
      pending,
      rejected: total - approved - pending,
      projected,
      actual,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
    };
  }

  static async getUserStats(cycleId) {
    const total = await User.countDocuments({ 'cycleAccess.currentCycleId': cycleId, deletedAt: null });
    const active = await User.countDocuments({
      'cycleAccess.currentCycleId': cycleId,
      isActive: true,
      deletedAt: null
    });

    return {
      total,
      active,
      inactive: total - active
    };
  }

  static async getPerformanceMetrics(cycleId, year) {
    const filter = { cycleId, deletedAt: null, approvalStatus: 'approved' };
    if (year) filter.submissionYear = parseInt(year);

    const submissions = await ParameterSubmission.find(filter, 'performanceStatus variancePercentage');

    const exceeding = submissions.filter(s => s.performanceStatus === 'exceeds_target').length;
    const meeting = submissions.filter(s => s.performanceStatus === 'meets_target').length;
    const below = submissions.filter(s => s.performanceStatus === 'below_target').length;

    const total = submissions.length;
    const avgVariance = total > 0 ? submissions.reduce((sum, s) => sum + (s.variancePercentage || 0), 0) / total : 0;

    return {
      totalEvaluated: total,
      exceedingTargets: exceeding,
      meetingTargets: meeting,
      belowTargets: below,
      averageVariancePercentage: Math.round(avgVariance * 100) / 100,
      successRate: total > 0 ? Math.round(((exceeding + meeting) / total) * 100) : 0
    };
  }

  // Additional helper methods for complex analytics...
  static groupByField(array, field) {
    return array.reduce((acc, item) => {
      const key = item[field] || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  static analyzePerformanceBreakdown(submissions) {
    return this.groupByField(submissions, 'performanceStatus');
  }

  static analyzeByCategoryOrDepartment(submissions, type) {
    // Implementation would depend on specific requirements
    return {};
  }

  static analyzeYearlyTrends(submissions) {
    return this.groupByField(submissions, 'submissionYear');
  }

  static getTopPerformers(submissions) {
    return submissions
      .filter(s => s.performanceStatus === 'exceeds_target')
      .slice(0, 10);
  }

  static getUnderperformers(submissions) {
    return submissions
      .filter(s => s.performanceStatus === 'below_target')
      .slice(0, 10);
  }

  static async checkCycleAccess(user, cycleId) {
    if (user?.role === 'Admin') return true;

    const userDoc = await User.findById(user?.id);
    return userDoc?.hasAccessToCycle(cycleId) || false;
  }

  static convertToCSV(data) {
    // Basic CSV conversion - would need more sophisticated implementation
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(item => Object.values(item).join(','));
      return [headers, ...rows].join('\n');
    }
    return '';
  }

  // Placeholder methods for complex analytics that would need full implementation
  static async getYearlyBreakdown(cycleId) { return {}; }
  static async getSubmissionAnalytics(cycleId) { return {}; }
  static async getDetailedPerformanceAnalytics(cycleId) { return {}; }
  static async getTrendAnalysis(cycleId) { return {}; }
  static async getUserEngagementAnalytics(cycleId) { return {}; }
  static async getCycleComparisons(cycleId) { return {}; }
  static async getParameterHistory(parameterId) { return {}; }
  static analyzeSubmissionTimeline(submissions) { return {}; }
  static analyzeApprovalWorkflow(submissions) { return {}; }
  static analyzeEvidence(submissions) { return {}; }
  static analyzeQualityMetrics(submissions) { return {}; }
  static analyzeUserSubmissionPatterns(submissions) { return {}; }
  static groupUsersByOrganization(users, field) { return {}; }
  static analyzeUserSubmissions(users, submissions) { return {}; }
  static analyzeUserEngagement(users) { return {}; }
  static analyzeAccessPatterns(users) { return {}; }
  static async getDetailedUserActivity(userIds, cycleId) { return {}; }
  static async compareCycles(cycleIds) { return {}; }
  static async compareYears(years) { return {}; }
  static async compareDepartments(deptIds) { return {}; }
  static async compareParameters(paramIds) { return {}; }
  static async generateDashboardExport(cycleId, filters) { return {}; }
  static async generateCycleExport(cycleId, filters) { return {}; }
  static async generateParameterExport(cycleId, filters) { return {}; }
  static async generateSubmissionExport(cycleId, filters) { return {}; }
  static async generateUserExport(cycleId, filters) { return {}; }
}

module.exports = AnalyticsController;