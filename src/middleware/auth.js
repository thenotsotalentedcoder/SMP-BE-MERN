const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT Authentication Middleware (exact .NET equivalent)
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
      deletedAt: null 
    });

    if (!user) {
      return res.status(401).json({
        Status: false,
        Message: 'Invalid token - user not found'
      });
    }

    // Attach user to request context
    req.user = user;
    req.userRole = decoded.role;
    req.userName = decoded.name;
    
    next();
  } catch (error) {
    console.error('JWT Authentication Error:', error);
    return res.status(401).json({
      Status: false,
      Message: 'Invalid or expired token'
    });
  }
};

// Authorization Middleware (exact [Authorize] attribute equivalent)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        Status: false,
        Message: 'Authentication required'
      });
    }

    if (roles.length && !roles.includes(req.user.userRole)) {
      return res.status(403).json({
        Status: false,
        Message: 'Insufficient permissions'
      });
    }

    next();
  };
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
  UserRoles
};