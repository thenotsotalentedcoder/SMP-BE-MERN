const express = require('express');
const router = express.Router();

const AnalyticsController = require('../controllers/AnalyticsController');
const ValidationMiddleware = require('../middleware/validation');
const {
  authenticateToken,
  authorize,
  requireCycleAccess,
  UserRoles
} = require('../middleware/auth');

// Analytics and Reporting Routes
// 🎯 PURPOSE: Comprehensive analytics for dashboard, performance, and reporting

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard overview
 * @access  Private (All authenticated users)
 * @query   cycleId, year
 */
router.get('/dashboard',
  ValidationMiddleware.buildValidationChain(['filters']),
  AnalyticsController.getDashboardOverview
);

/**
 * @route   GET /api/analytics/cycle/:cycleId
 * @desc    Get detailed cycle analytics
 * @access  Private (Users with cycle access)
 * @params  cycleId - Cycle ID
 * @query   includeComparisons
 */
router.get('/cycle/:cycleId',
  requireCycleAccess('cycleId'),
  ValidationMiddleware.buildValidationChain(['analytics']),
  AnalyticsController.getCycleAnalytics
);

/**
 * @route   GET /api/analytics/parameters
 * @desc    Get parameter performance analytics
 * @access  Private (All authenticated users)
 * @query   cycleId, parameterId, year, departmentId, facultyId, performanceStatus, includeHistory
 */
router.get('/parameters',
  ValidationMiddleware.buildValidationChain(['filters', 'analytics']),
  AnalyticsController.getParameterAnalytics
);

/**
 * @route   GET /api/analytics/submissions
 * @desc    Get submission analytics
 * @access  Private (All authenticated users)
 * @query   cycleId, year, submissionType, timeframe
 */
router.get('/submissions',
  ValidationMiddleware.buildValidationChain(['filters', 'analytics']),
  AnalyticsController.getSubmissionAnalytics
);

/**
 * @route   GET /api/analytics/users
 * @desc    Get user performance analytics
 * @access  Private (Dean, VC, PVC, Admin)
 * @query   cycleId, departmentId, facultyId, role, includeActivity
 */
router.get('/users',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['filters', 'analytics']),
  AnalyticsController.getUserAnalytics
);

/**
 * @route   GET /api/analytics/comparative
 * @desc    Get comparative analytics
 * @access  Private (Dean, VC, PVC, Admin)
 * @query   cycleIds, years, departments, parameters
 */
router.get('/comparative',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['filters']),
  AnalyticsController.getComparativeAnalytics
);

// Export routes
/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics data
 * @access  Private (Dean, VC, PVC, Admin)
 * @query   type, format, cycleId, filters
 */
router.get('/export',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.validateExportParams(),
  ValidationMiddleware.handleValidationErrors,
  AnalyticsController.exportAnalytics
);

// Specialized analytics routes
/**
 * @route   GET /api/analytics/performance/overview
 * @desc    Get performance overview across all cycles
 * @access  Private (Dean, VC, PVC, Admin)
 * @query   timeframe, groupBy
 */
router.get('/performance/overview',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['analytics']),
  async (req, res) => {
    try {
      const { timeframe = 365, groupBy = 'cycle' } = req.query;

      const ParameterSubmission = require('../models/ParameterSubmission');
      const Cycle = require('../models/Cycle');

      // Get data from the specified timeframe
      const startDate = new Date(Date.now() - parseInt(timeframe) * 24 * 60 * 60 * 1000);

      const submissions = await ParameterSubmission.find({
        'submissionTimeline.finalSubmittedAt': { $gte: startDate },
        approvalStatus: 'approved',
        deletedAt: null
      })
      .populate('cycleId', 'name')
      .populate('parameterId', 'name category')
      .populate('userId', 'deptId facultyId')
      .lean();

      const overview = {
        totalSubmissions: submissions.length,
        performanceBreakdown: {
          exceeds_target: submissions.filter(s => s.performanceStatus === 'exceeds_target').length,
          meets_target: submissions.filter(s => s.performanceStatus === 'meets_target').length,
          below_target: submissions.filter(s => s.performanceStatus === 'below_target').length,
          insufficient_data: submissions.filter(s => s.performanceStatus === 'insufficient_data').length
        },
        averageVariance: 0,
        trends: {},
        groupedData: {}
      };

      // Calculate average variance
      const submissionsWithVariance = submissions.filter(s => s.variancePercentage !== null);
      if (submissionsWithVariance.length > 0) {
        overview.averageVariance = Math.round(
          submissionsWithVariance.reduce((sum, s) => sum + s.variancePercentage, 0) / submissionsWithVariance.length
        );
      }

      // Group data based on groupBy parameter
      if (groupBy === 'cycle') {
        overview.groupedData = submissions.reduce((acc, submission) => {
          const cycleName = submission.cycleId?.name || 'Unknown';
          if (!acc[cycleName]) {
            acc[cycleName] = {
              total: 0,
              performance: { exceeds_target: 0, meets_target: 0, below_target: 0, insufficient_data: 0 }
            };
          }
          acc[cycleName].total++;
          acc[cycleName].performance[submission.performanceStatus]++;
          return acc;
        }, {});
      } else if (groupBy === 'category') {
        overview.groupedData = submissions.reduce((acc, submission) => {
          const category = submission.parameterId?.category || 'Unknown';
          if (!acc[category]) {
            acc[category] = {
              total: 0,
              performance: { exceeds_target: 0, meets_target: 0, below_target: 0, insufficient_data: 0 }
            };
          }
          acc[category].total++;
          acc[category].performance[submission.performanceStatus]++;
          return acc;
        }, {});
      }

      res.status(200).json({
        success: true,
        data: overview
      });

    } catch (error) {
      console.error('Error getting performance overview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get performance overview',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/analytics/trends/:cycleId
 * @desc    Get trend analysis for specific cycle
 * @access  Private (Users with cycle access)
 * @params  cycleId - Cycle ID
 * @query   parameterId, timeframe
 */
router.get('/trends/:cycleId',
  requireCycleAccess('cycleId'),
  ValidationMiddleware.buildValidationChain(['filters', 'analytics']),
  async (req, res) => {
    try {
      const { cycleId } = req.params;
      const { parameterId, timeframe = 365 } = req.query;

      const ParameterSubmission = require('../models/ParameterSubmission');

      let filter = {
        cycleId: parseInt(cycleId),
        approvalStatus: 'approved',
        deletedAt: null
      };

      if (parameterId) {
        filter.parameterId = parseInt(parameterId);
      }

      // Get submissions for trend analysis
      const submissions = await ParameterSubmission.find(filter)
        .populate('parameterId', 'name')
        .sort({ submissionYear: 1, 'submissionTimeline.finalSubmittedAt': 1 })
        .lean();

      // Group by year and calculate trends
      const yearlyData = submissions.reduce((acc, submission) => {
        const year = submission.submissionYear;
        if (!acc[year]) {
          acc[year] = {
            year,
            total: 0,
            averageValue: 0,
            averageVariance: 0,
            performance: { exceeds_target: 0, meets_target: 0, below_target: 0 },
            submissions: []
          };
        }

        acc[year].submissions.push(submission);
        acc[year].total++;
        acc[year].performance[submission.performanceStatus]++;
        return acc;
      }, {});

      // Calculate averages for each year
      Object.values(yearlyData).forEach(yearData => {
        const validSubmissions = yearData.submissions.filter(s => s.submittedValue !== null);
        const validVariances = yearData.submissions.filter(s => s.variancePercentage !== null);

        yearData.averageValue = validSubmissions.length > 0
          ? Math.round(validSubmissions.reduce((sum, s) => sum + s.submittedValue, 0) / validSubmissions.length)
          : 0;

        yearData.averageVariance = validVariances.length > 0
          ? Math.round(validVariances.reduce((sum, s) => sum + s.variancePercentage, 0) / validVariances.length)
          : 0;

        delete yearData.submissions; // Remove detailed submissions for cleaner response
      });

      const trends = {
        cycleId: parseInt(cycleId),
        parameterId: parameterId ? parseInt(parameterId) : null,
        yearlyTrends: Object.values(yearlyData),
        overallTrend: this.calculateOverallTrend(Object.values(yearlyData)),
        summary: {
          totalYears: Object.keys(yearlyData).length,
          totalSubmissions: submissions.length,
          trendDirection: this.determineTrendDirection(Object.values(yearlyData))
        }
      };

      res.status(200).json({
        success: true,
        data: trends
      });

    } catch (error) {
      console.error('Error getting trend analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trend analysis',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/analytics/benchmarks
 * @desc    Get benchmark comparisons
 * @access  Private (Dean, VC, PVC, Admin)
 * @query   cycleId, parameterId, benchmarkType
 */
router.get('/benchmarks',
  authorize(UserRoles.Dean, UserRoles.VC, UserRoles.PVC, UserRoles.Admin),
  ValidationMiddleware.buildValidationChain(['filters']),
  async (req, res) => {
    try {
      const { cycleId, parameterId, benchmarkType = 'department' } = req.query;

      const ParameterSubmission = require('../models/ParameterSubmission');
      const User = require('../models/User');

      let filter = {
        approvalStatus: 'approved',
        deletedAt: null
      };

      if (cycleId) filter.cycleId = parseInt(cycleId);
      if (parameterId) filter.parameterId = parseInt(parameterId);

      const submissions = await ParameterSubmission.find(filter)
        .populate('parameterId', 'name category')
        .populate('userId', 'deptId facultyId')
        .lean();

      const benchmarks = {};

      if (benchmarkType === 'department') {
        // Group by department
        submissions.forEach(submission => {
          const deptId = submission.userId?.deptId || 'Unknown';
          if (!benchmarks[deptId]) {
            benchmarks[deptId] = {
              departmentId: deptId,
              submissions: [],
              averageValue: 0,
              averageVariance: 0,
              performanceScore: 0
            };
          }
          benchmarks[deptId].submissions.push(submission);
        });
      } else if (benchmarkType === 'faculty') {
        // Group by faculty
        submissions.forEach(submission => {
          const facId = submission.userId?.facultyId || 'Unknown';
          if (!benchmarks[facId]) {
            benchmarks[facId] = {
              facultyId: facId,
              submissions: [],
              averageValue: 0,
              averageVariance: 0,
              performanceScore: 0
            };
          }
          benchmarks[facId].submissions.push(submission);
        });
      } else if (benchmarkType === 'parameter') {
        // Group by parameter
        submissions.forEach(submission => {
          const paramId = submission.parameterId?._id || 'Unknown';
          if (!benchmarks[paramId]) {
            benchmarks[paramId] = {
              parameterId: paramId,
              parameterName: submission.parameterId?.name,
              category: submission.parameterId?.category,
              submissions: [],
              averageValue: 0,
              averageVariance: 0,
              performanceScore: 0
            };
          }
          benchmarks[paramId].submissions.push(submission);
        });
      }

      // Calculate metrics for each benchmark group
      Object.values(benchmarks).forEach(benchmark => {
        const validValues = benchmark.submissions.filter(s => s.submittedValue !== null);
        const validVariances = benchmark.submissions.filter(s => s.variancePercentage !== null);

        benchmark.averageValue = validValues.length > 0
          ? Math.round(validValues.reduce((sum, s) => sum + s.submittedValue, 0) / validValues.length)
          : 0;

        benchmark.averageVariance = validVariances.length > 0
          ? Math.round(validVariances.reduce((sum, s) => sum + s.variancePercentage, 0) / validVariances.length)
          : 0;

        // Calculate performance score (percentage of meets/exceeds target)
        const goodPerformance = benchmark.submissions.filter(s =>
          s.performanceStatus === 'meets_target' || s.performanceStatus === 'exceeds_target'
        ).length;

        benchmark.performanceScore = benchmark.submissions.length > 0
          ? Math.round((goodPerformance / benchmark.submissions.length) * 100)
          : 0;

        benchmark.totalSubmissions = benchmark.submissions.length;
        delete benchmark.submissions; // Remove detailed submissions
      });

      res.status(200).json({
        success: true,
        data: {
          benchmarkType,
          benchmarks: Object.values(benchmarks),
          summary: {
            totalGroups: Object.keys(benchmarks).length,
            averagePerformanceScore: Object.values(benchmarks).reduce((sum, b) => sum + b.performanceScore, 0) / Object.keys(benchmarks).length
          }
        }
      });

    } catch (error) {
      console.error('Error getting benchmarks:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get benchmarks',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/analytics/real-time/dashboard
 * @desc    Get real-time dashboard data
 * @access  Private (All authenticated users)
 * @query   cycleId
 */
router.get('/real-time/dashboard',
  ValidationMiddleware.buildValidationChain(['filters']),
  async (req, res) => {
    try {
      const { cycleId } = req.query;

      // Get current active cycle if not specified
      let targetCycleId = cycleId;
      if (!targetCycleId) {
        const Cycle = require('../models/Cycle');
        const activeCycle = await Cycle.findOne({ isActive: true, deletedAt: null });
        targetCycleId = activeCycle?._id;
      }

      if (!targetCycleId) {
        return res.status(200).json({
          success: true,
          data: {
            message: 'No active cycle found',
            realTimeData: {}
          }
        });
      }

      const [
        ParameterSubmission,
        ParameterCycle,
        User
      ] = [
        require('../models/ParameterSubmission'),
        require('../models/ParameterCycle'),
        require('../models/User')
      ];

      // Get real-time metrics
      const today = new Date();
      const last24Hours = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalActiveParameters,
        submissionsToday,
        submissionsLast7Days,
        pendingApprovals,
        activeUsers,
        recentActivity
      ] = await Promise.all([
        ParameterCycle.countDocuments({
          cycleId: parseInt(targetCycleId),
          isActive: true,
          deletedAt: null
        }),
        ParameterSubmission.countDocuments({
          cycleId: parseInt(targetCycleId),
          'submissionTimeline.finalSubmittedAt': { $gte: last24Hours },
          deletedAt: null
        }),
        ParameterSubmission.countDocuments({
          cycleId: parseInt(targetCycleId),
          'submissionTimeline.finalSubmittedAt': { $gte: last7Days },
          deletedAt: null
        }),
        ParameterSubmission.countDocuments({
          cycleId: parseInt(targetCycleId),
          approvalStatus: 'pending',
          deletedAt: null
        }),
        User.countDocuments({
          'cycleAccess.currentCycleId': parseInt(targetCycleId),
          'activityTracking.lastActiveAt': { $gte: last24Hours },
          isActive: true,
          deletedAt: null
        }),
        ParameterSubmission.find({
          cycleId: parseInt(targetCycleId),
          'submissionTimeline.finalSubmittedAt': { $gte: last24Hours },
          deletedAt: null
        })
        .populate('parameterId', 'name')
        .populate('userId', 'firstName lastName')
        .sort({ 'submissionTimeline.finalSubmittedAt': -1 })
        .limit(10)
        .lean()
      ]);

      const realTimeData = {
        cycleId: parseInt(targetCycleId),
        timestamp: new Date(),
        metrics: {
          totalActiveParameters,
          submissionsToday,
          submissionsLast7Days,
          pendingApprovals,
          activeUsers
        },
        recentActivity: recentActivity.map(submission => ({
          id: submission._id,
          parameterName: submission.parameterId?.name,
          submittedBy: `${submission.userId?.firstName || ''} ${submission.userId?.lastName || ''}`.trim(),
          submittedValue: submission.submittedValue,
          submissionType: submission.submissionType,
          submittedAt: submission.submissionTimeline.finalSubmittedAt,
          status: submission.approvalStatus
        })),
        trends: {
          submissionTrend: submissionsToday > 0 ? 'up' : 'stable',
          approvalBacklog: pendingApprovals,
          userEngagement: activeUsers > 0 ? 'active' : 'low'
        }
      };

      res.status(200).json({
        success: true,
        data: realTimeData
      });

    } catch (error) {
      console.error('Error getting real-time dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get real-time dashboard data',
        error: error.message
      });
    }
  }
);

// ─── NEW: Real analytics dashboard endpoints ───────────────────────────────
const AnalyticsDashboardController = require('../controllers/AnalyticsDashboardController');

/**
 * @route   GET /api/analytics/scorecard
 * @desc    University pulse + 12 pillar scorecard — powers the VC analytics dashboard
 * @access  Private (All authenticated users)
 * @query   cycleId, year
 */
router.get('/scorecard', AnalyticsDashboardController.getScorecard);

/**
 * @route   GET /api/analytics/drill
 * @desc    Parameter-level detail + department league table (drill-down)
 * @access  Private (All authenticated users)
 * @query   cycleId, year, categoryId, deptId
 */
router.get('/drill', AnalyticsDashboardController.getDrillDown);

module.exports = router;