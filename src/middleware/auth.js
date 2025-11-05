const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Cycle = require('../models/Cycle');

// Enhanced JWT Authentication Middleware with Cycle Access
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        Status: false,
        Message: 'Access token is required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and attach to request (similar to .NET's HttpContext.User)
    const user = await User.findOne({
      userName: decoded.name,
      deletedAt: null,
      isActive: true
    })
    .populate('cycleAccess.currentCycleId', 'name cycleName currentActiveYear isActive')
    .lean();

    if (!user) {
      return res.status(401).json({
        Status: false,
        Message: 'Invalid token - user not found or inactive'
      });
    }

    // Check account status
    if (user.status !== 'active') {
      return res.status(401).json({
        Status: false,
        Message: 'Account is suspended or inactive'
      });
    }

    // Check account lockout
    if (user.securitySettings?.accountLockedUntil &&
        new Date() < user.securitySettings.accountLockedUntil) {
      return res.status(401).json({
        Status: false,
        Message: 'Account is temporarily locked'
      });
    }

    // Attach enhanced user context to request
    req.user = {
      id: user._id,
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      role: user.userRole,
      email: user.email,
      deptId: user.deptId,
      facultyId: user.facultyId,
      cycleAccess: user.cycleAccess,
      permissions: user.cycleAccess?.permissions || {},
      submissionAccess: user.cycleAccess?.submissionAccess || {},
      isActive: user.isActive,
      status: user.status
    };

    // Legacy compatibility
    req.userRole = user.userRole;
    req.userName = user.userName;

    // Record user activity
    try {
      await User.findByIdAndUpdate(user._id, {
        'activityTracking.lastActiveAt': new Date(),
        $inc: { 'activityTracking.sessionsThisMonth': 0 } // Don't increment on every request
      });
    } catch (activityError) {
      console.warn('Failed to record user activity:', activityError.message);
    }

    next();
  } catch (error) {
    console.error('JWT Authentication Error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        Status: false,
        Message: 'Token has expired',
        Code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      Status: false,
      Message: 'Invalid or malformed token'
    });
  }
};

// Enhanced Authorization Middleware with Role and Permission Checks
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        Status: false,
        Message: 'Authentication required'
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        Status: false,
        Message: 'Insufficient role permissions',
        RequiredRoles: roles,
        UserRole: req.user.role
      });
    }

    next();
  };
};

// Cycle Access Authorization Middleware
const requireCycleAccess = (cycleIdParam = 'cycleId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          Status: false,
          Message: 'Authentication required'
        });
      }

      // Admin users have access to all cycles
      if (req.user.role === 'Admin') {
        return next();
      }

      // Get cycle ID from params, query, or body
      const cycleId = req.params[cycleIdParam] ||
                     req.query.cycleId ||
                     req.body.cycleId;

      if (!cycleId) {
        return res.status(400).json({
          Status: false,
          Message: 'Cycle ID is required'
        });
      }

      // Check if user has access to this cycle
      const hasAccess = req.user.cycleAccess?.currentCycleId === parseInt(cycleId) ||
                       req.user.permissions?.canViewAllCycles === true;

      if (!hasAccess) {
        return res.status(403).json({
          Status: false,
          Message: 'Access denied to this cycle',
          CycleId: cycleId,
          UserCycleAccess: req.user.cycleAccess?.currentCycleId
        });
      }

      next();
    } catch (error) {
      console.error('Cycle access authorization error:', error);
      res.status(500).json({
        Status: false,
        Message: 'Error checking cycle access'
      });
    }
  };
};

// Year Access Authorization Middleware
const requireYearAccess = (yearParam = 'year') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          Status: false,
          Message: 'Authentication required'
        });
      }

      // Admin users have access to all years
      if (req.user.role === 'Admin') {
        return next();
      }

      // Get year from params, query, or body
      const year = req.params[yearParam] ||
                  req.query.year ||
                  req.body.submissionYear ||
                  req.body.year;

      if (!year) {
        return res.status(400).json({
          Status: false,
          Message: 'Year is required'
        });
      }

      const requestedYear = parseInt(year);
      const currentYear = req.user.cycleAccess?.currentCycleYear;

      // Check year access permissions
      const canAccessYear = requestedYear === currentYear ||
                           req.user.permissions?.canViewPreviousYears === true ||
                           (req.user.permissions?.canAccessTargetYear === true &&
                            await isTargetYear(requestedYear, req.user.cycleAccess?.currentCycleId));

      if (!canAccessYear) {
        return res.status(403).json({
          Status: false,
          Message: 'Access denied to this year',
          RequestedYear: requestedYear,
          UserCurrentYear: currentYear
        });
      }

      next();
    } catch (error) {
      console.error('Year access authorization error:', error);
      res.status(500).json({
        Status: false,
        Message: 'Error checking year access'
      });
    }
  };
};

// Submission Permission Middleware
const requireSubmissionPermission = (submissionType, action = 'create') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        Status: false,
        Message: 'Authentication required'
      });
    }

    // Admin users have all permissions
    if (req.user.role === 'Admin') {
      return next();
    }

    const submissionAccess = req.user.submissionAccess || {};

    let hasPermission = false;

    switch (action) {
      case 'create':
      case 'submit':
        if (submissionType === 'projected') {
          hasPermission = submissionAccess.canSubmitProjected !== false;
        } else if (submissionType === 'actual') {
          hasPermission = submissionAccess.canSubmitActual === true;
        }
        break;
      case 'edit':
        hasPermission = submissionAccess.canEditSubmissions !== false;
        break;
      case 'delete':
        hasPermission = submissionAccess.canDeleteSubmissions === true;
        break;
      case 'approve':
        hasPermission = ['Admin', 'Dean', 'VC', 'PVC'].includes(req.user.role);
        break;
      default:
        hasPermission = false;
    }

    if (!hasPermission) {
      return res.status(403).json({
        Status: false,
        Message: `Insufficient permissions for ${action} ${submissionType} submissions`,
        RequiredAction: action,
        SubmissionType: submissionType,
        UserPermissions: submissionAccess
      });
    }

    next();
  };
};

// Department/Faculty Access Middleware
const requireDepartmentAccess = (deptIdParam = 'deptId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        Status: false,
        Message: 'Authentication required'
      });
    }

    // Admin users have access to all departments
    if (req.user.role === 'Admin' || req.user.permissions?.restrictedToDepartment === false) {
      return next();
    }

    const deptId = req.params[deptIdParam] || req.query.deptId || req.body.deptId;

    if (deptId && parseInt(deptId) !== req.user.deptId) {
      return res.status(403).json({
        Status: false,
        Message: 'Access denied to this department',
        RequestedDepartment: deptId,
        UserDepartment: req.user.deptId
      });
    }

    next();
  };
};

const requireFacultyAccess = (facultyIdParam = 'facultyId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        Status: false,
        Message: 'Authentication required'
      });
    }

    // Admin users and those not restricted to faculty have access
    if (req.user.role === 'Admin' || req.user.permissions?.restrictedToFaculty === false) {
      return next();
    }

    const facultyId = req.params[facultyIdParam] || req.query.facultyId || req.body.facultyId;

    if (facultyId && parseInt(facultyId) !== req.user.facultyId) {
      return res.status(403).json({
        Status: false,
        Message: 'Access denied to this faculty',
        RequestedFaculty: facultyId,
        UserFaculty: req.user.facultyId
      });
    }

    next();
  };
};

// Helper function to check if a year is the target year for a cycle
const isTargetYear = async (year, cycleId) => {
  try {
    if (!cycleId) return false;
    const cycle = await Cycle.findById(cycleId);
    return cycle && cycle.targetYear === year;
  } catch (error) {
    console.error('Error checking target year:', error);
    return false;
  }
};

// User Roles Constants (matching .NET UserRoles)
const UserRoles = {
  Admin: 'Admin',
  Chairman: 'Chairman',
  Dean: 'Dean',
  VC: 'VC',
  PVC: 'PVC'
};

module.exports = {
  authenticateToken,
  authorize,
  requireCycleAccess,
  requireYearAccess,
  requireSubmissionPermission,
  requireDepartmentAccess,
  requireFacultyAccess,
  UserRoles
};