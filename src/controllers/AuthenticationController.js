const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HelperService = require('../services/HelperService');
const { UserRoles } = require('../middleware/auth');

class AuthenticationController {
  // POST /api/auth/login (exact replica)
  async login(req, res) {
    try {
      const { Username, Password } = req.body;

      if (!Username || !Password) {
        return res.status(400).json({
          status: 400,
          Message: "Username and password are required"
        });
      }

      // Find user by username
      const user = await User.findOne({ 
        userName: Username,
        deletedAt: null 
      });

      if (!user) {
        return res.status(401).json({
          status: 401,
          Message: "User doesn't exist!"
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(Password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          status: 401,
          Message: "User doesn't exist!"
        });
      }

      // Create JWT token (12 hour expiry matching .NET)
      const token = jwt.sign(
        {
          name: user.userName,
          role: user.userRole,
          jti: require('crypto').randomUUID()
        },
        process.env.JWT_SECRET,
        { 
          expiresIn: process.env.JWT_EXPIRES_IN || '12h',
          issuer: 'SMP-Backend',
          audience: 'SMP-Frontend'
        }
      );

      // Calculate expiration date
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 12);

      return res.json({
        token: token,
        role: [user.userRole], // Return as array to match .NET format
        expiration: expirationDate.toISOString()
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        Status: "Error",
        Message: "Internal server error"
      });
    }
  }

  // POST /api/auth/register (exact replica)
  async register(req, res) {
    try {
      const {
        Username, Email, Password, UserRole, PhoneNumber,
        FacultyId, DeptId, FirstName, LastName
      } = req.body;

      if (!Username || !Email || !Password || !UserRole) {
        return res.status(400).json({
          Status: "Error",
          Message: "Required fields are missing"
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ 
        userName: Username,
        deletedAt: null 
      });

      if (existingUser) {
        return res.status(500).json({
          Status: "Error",
          Message: "User already exists!"
        });
      }

      // Validate role
      if (!Object.values(UserRoles).includes(UserRole)) {
        return res.status(400).json({
          Status: "Error",
          Message: "Invalid user role"
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(Password, 10);

      // Create new user
      const newUser = new User({
        userName: Username,
        email: Email,
        passwordHash: passwordHash,
        userRole: UserRole,
        phoneNumber: PhoneNumber,
        facultyId: FacultyId,
        deptId: DeptId,
        firstName: FirstName,
        lastName: LastName
      });

      await newUser.save();

      return res.json({
        Status: "Success",
        Message: "User created successfully!"
      });

    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({
        Status: "Error",
        Message: "User creation failed! Please check user details and try again."
      });
    }
  }

  // POST /api/auth/register-admin (exact replica)
  async registerAdmin(req, res) {
    try {
      const { Username, Email, Password } = req.body;

      if (!Username || !Email || !Password) {
        return res.status(400).json({
          Status: "Error",
          Message: "Username, email, and password are required"
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ 
        userName: Username,
        deletedAt: null 
      });

      if (existingUser) {
        return res.status(500).json({
          Status: "Error",
          Message: "User already exists!"
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(Password, 10);

      // Create admin user
      const newAdmin = new User({
        userName: Username,
        email: Email,
        passwordHash: passwordHash,
        userRole: UserRoles.Admin
      });

      await newAdmin.save();

      return res.json({
        Status: "Success",
        Message: "User created successfully!"
      });

    } catch (error) {
      console.error('Admin registration error:', error);
      return res.status(500).json({
        Status: "Error",
        Message: "User creation failed! Please check user details and try again."
      });
    }
  }

  // POST /api/auth/update-password (exact replica)
  async updatePassword(req, res) {
    try {
      const { Username, OldPassword, NewPassword } = req.body;

      if (!Username || !OldPassword || !NewPassword) {
        return res.status(400).json({
          Status: "Error",
          Message: "All fields are required"
        });
      }

      // Find user
      const user = await User.findOne({ 
        userName: Username,
        deletedAt: null 
      });

      if (!user) {
        return res.status(500).json({
          Status: "Error",
          Message: "User doesn't exist!"
        });
      }

      // Verify old password
      const isOldPasswordValid = await bcrypt.compare(OldPassword, user.passwordHash);
      if (!isOldPasswordValid) {
        return res.status(500).json({
          Status: "Error",
          Message: "Password update failed! Please check user details and try again."
        });
      }

      // Update password using HelperService
      const result = await HelperService.updateUserPassword(user, NewPassword);
      
      if (!result) {
        return res.status(500).json({
          Status: "Error",
          Message: "Password update failed! Please check user details and try again."
        });
      }

      return res.json({
        Status: "Success",
        Message: "Password updated successfully!"
      });

    } catch (error) {
      console.error('Update password error:', error);
      return res.status(500).json({
        Status: "Error",
        Message: "Password update failed! Please check user details and try again."
      });
    }
  }

  // POST /api/auth/update-user/:username (exact replica)
  async updateUser(req, res) {
    try {
      const { username } = req.params;
      const {
        Email, Username: newUsername, PhoneNumber, FirstName, LastName,
        UserRole, FacultyId, DeptId, Password
      } = req.body;

      // Find user
      const user = await User.findOne({ 
        userName: username,
        deletedAt: null 
      });

      if (!user) {
        return res.status(500).json({
          Status: "Error",
          Message: "User doesn't exist!"
        });
      }

      // Update user data
      const userData = {
        _id: user._id,
        email: Email || user.email,
        userName: newUsername || user.userName,
        phoneNumber: PhoneNumber || user.phoneNumber,
        firstName: FirstName || user.firstName,
        lastName: LastName || user.lastName,
        userRole: UserRole || user.userRole,
        facultyId: FacultyId || user.facultyId,
        deptId: DeptId || user.deptId
      };

      const result = await HelperService.updateUser(userData);
      
      if (!result) {
        return res.status(500).json({
          Status: "Error",
          Message: "User update failed! Please check user details and try again."
        });
      }

      let passwordUpdated = false;
      if (Password) {
        passwordUpdated = await HelperService.updateUserPassword(user, Password);
      }

      return res.json({
        Status: "Success",
        Message: "User updated successfully!",
        passwordUpdated: passwordUpdated
      });

    } catch (error) {
      console.error('Update user error:', error);
      return res.status(500).json({
        Status: "Error",
        Message: "User update failed! Please check user details and try again."
      });
    }
  }

  // GET /api/auth/generate-role (exact replica)
  async generateRole(req, res) {
    try {
      // This endpoint just returns OK (used for role initialization in .NET)
      return res.json({
        Status: "Success",
        Message: "Roles initialized successfully"
      });
    } catch (error) {
      console.error('Generate role error:', error);
      return res.status(500).json({
        Status: "Error",
        Message: "Role generation failed"
      });
    }
  }
}

module.exports = new AuthenticationController();