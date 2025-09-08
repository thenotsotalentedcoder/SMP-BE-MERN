const User = require('../models/User');

class UserController {
  // GET /api/users/get-current-user (exact replica)
  async getCurrentUser(req, res) {
    try {
      // User is already attached by authentication middleware
      if (!req.user) {
        return res.status(401).json({
          Status: "Error",
          Message: "User Not Logged In!"
        });
      }

      return res.json({
        Status: "Success",
        User: req.user
      });

    } catch (error) {
      console.error('Get current user error:', error);
      return res.status(500).json({
        Status: "Error",
        Message: "Internal server error"
      });
    }
  }

  // GET /api/users/get-all-users (exact replica)
  async getAllUsers(req, res) {
    try {
      const { 
        page = 1, 
        pageSize = 10, 
        search = null, 
        type = null 
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(pageSize);
      
      // Build query - exclude admin users like .NET does
      let query = { 
        userRole: { $ne: 'admin' }, // Exclude admin users
        deletedAt: null 
      };

      // Apply search filter
      if (search && search.trim()) {
        query.userName = { $regex: search, $options: 'i' };
      }

      // Apply type (role) filter
      if (type && type.trim()) {
        query.userRole = type;
      }

      // Get total count
      const totalCount = await User.countDocuments(query);

      // Get users with pagination
      const users = await User.find(query)
        .select('-passwordHash') // Exclude password hash
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(pageSize));

      return res.json({
        Status: "Success",
        Data: users,
        TotalCount: totalCount,
        Page: parseInt(page),
        PageSize: parseInt(pageSize),
        Message: "Users retrieved successfully!"
      });

    } catch (error) {
      console.error('Get all users error:', error);
      return res.status(500).json({
        Status: "Error",
        Message: "Internal server error"
      });
    }
  }
}

module.exports = new UserController();