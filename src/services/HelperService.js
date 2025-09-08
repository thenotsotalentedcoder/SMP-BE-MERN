const bcrypt = require('bcryptjs');
const User = require('../models/User');

class HelperService {
  // Generate unique ID with prefix (exact replica of .NET method)
  getID(prefix) {
    const generator = Math.floor(Math.random() * 100000);
    const r = generator.toString().padStart(5, '0');
    const timestamp = Math.floor(Date.now() / 1000);
    const id = `${prefix}-${timestamp}-${r}`;
    return id;
  }

  // Get logged user from request context (exact replica)
  async getLoggedUser(context) {
    try {
      if (!context.user) {
        return null;
      }

      // Return the user already attached by auth middleware
      return context.user;
    } catch (error) {
      console.error('Error getting logged user:', error);
      return null;
    }
  }

  // Update user and sync roles (exact replica)
  async updateUser(userData) {
    try {
      if (!userData || !userData._id) {
        return false;
      }

      // Update user data
      const updatedUser = await User.findByIdAndUpdate(
        userData._id,
        {
          email: userData.email,
          userName: userData.userName,
          phoneNumber: userData.phoneNumber,
          firstName: userData.firstName,
          lastName: userData.lastName,
          userRole: userData.userRole,
          facultyId: userData.facultyId,
          deptId: userData.deptId,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!updatedUser) {
        return false;
      }

      // Update user roles (in .NET this syncs with Identity roles)
      await this.updateUserRoles(updatedUser, userData.userRole);
      
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  }

  // Update user password (exact replica)
  async updateUserPassword(user, newPassword) {
    try {
      if (!user || !newPassword) {
        return false;
      }

      // Hash the new password
      const newHash = await bcrypt.hash(newPassword, 10);
      
      // Check if it's the same as current password
      if (user.passwordHash && await bcrypt.compare(newPassword, user.passwordHash)) {
        return false; // Same password
      }

      // Update password hash
      const updated = await User.findByIdAndUpdate(
        user._id,
        { 
          passwordHash: newHash,
          updatedAt: new Date()
        },
        { new: true }
      );

      return !!updated;
    } catch (error) {
      console.error('Error updating user password:', error);
      return false;
    }
  }

  // Update user roles (exact replica - single role assignment)
  async updateUserRoles(user, role) {
    try {
      if (!user || !role) {
        return false;
      }

      // In .NET this removes all roles and adds the new one
      // In our case, we just update the userRole field
      const updated = await User.findByIdAndUpdate(
        user._id,
        { 
          userRole: role,
          updatedAt: new Date()
        },
        { new: true }
      );

      return !!updated;
    } catch (error) {
      console.error('Error updating user roles:', error);
      return false;
    }
  }

  // Helper method to validate user role
  isValidRole(role) {
    const validRoles = ['Admin', 'Chairman', 'Dean', 'VC', 'PVC'];
    return validRoles.includes(role);
  }

  // Helper method to hash password
  async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }

  // Helper method to compare password
  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }
}

module.exports = new HelperService();