const mongoose = require('mongoose');

// User Schema (exact ApplicationUser replica with numeric ID)
const userSchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true
  },
  userName: { 
    type: String, 
    required: true, 
    unique: true 
  },
  email: { 
    type: String, 
    required: true 
  },
  firstName: String,
  lastName: String,
  userRole: { 
    type: String, 
    enum: ['Admin', 'Chairman', 'Dean', 'VC', 'PVC'],
    required: true
  },
  deptId: Number, // Keep as number for exact .NET compatibility
  facultyId: Number, // Keep as number for exact .NET compatibility
  passwordHash: String,
  phoneNumber: String,
  // Identity fields for compatibility
  emailConfirmed: {
    type: Boolean,
    default: false
  },
  lockoutEnabled: {
    type: Boolean,
    default: false
  },
  accessFailedCount: {
    type: Number,
    default: 0
  },

  // ✅ EXISTING FIELDS (preserved for backward compatibility)
  deletedAt: {
    type: Date,
    default: null // Soft delete pattern
  },

  // 🆕 ENHANCED CYCLE ACCESS MANAGEMENT
  cycleAccess: {
    // Current active cycle access
    currentCycleId: {
      type: Number,
      ref: 'Cycle',
      default: null
    },
    currentCycleYear: {
      type: Number,
      default: null
    },

    // Historical cycle access
    accessHistory: [{
      cycleId: {
        type: Number,
        ref: 'Cycle'
      },
      cycleYear: Number,
      accessGrantedAt: Date,
      accessRevokedAt: Date,
      grantedBy: {
        type: Number,
        ref: 'User'
      },
      revokedBy: {
        type: Number,
        ref: 'User'
      },
      accessLevel: {
        type: String,
        enum: ['read', 'write', 'admin'],
        default: 'write'
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],

    // Role-based cycle permissions
    permissions: {
      canViewAllCycles: {
        type: Boolean,
        default: false
      },
      canEditActiveYear: {
        type: Boolean,
        default: true
      },
      canViewPreviousYears: {
        type: Boolean,
        default: true
      },
      canAccessTargetYear: {
        type: Boolean,
        default: false
      },
      restrictedToDepartment: {
        type: Boolean,
        default: true
      },
      restrictedToFaculty: {
        type: Boolean,
        default: true
      }
    },

    // Submission tracking
    submissionAccess: {
      canSubmitProjected: {
        type: Boolean,
        default: true
      },
      canSubmitActual: {
        type: Boolean,
        default: false
      },
      canEditSubmissions: {
        type: Boolean,
        default: true
      },
      canDeleteSubmissions: {
        type: Boolean,
        default: false
      },
      submissionWindowStart: Date,
      submissionWindowEnd: Date
    }
  },

  // Enhanced User Activity Tracking
  activityTracking: {
    lastLoginAt: Date,
    lastActiveAt: Date,
    lastCycleAccessed: {
      type: Number,
      ref: 'Cycle'
    },
    lastYearAccessed: Number,
    totalLogins: {
      type: Number,
      default: 0
    },
    totalSubmissions: {
      type: Number,
      default: 0
    },
    lastSubmissionAt: Date,
    averageSubmissionTime: Number, // in minutes
    sessionsThisMonth: {
      type: Number,
      default: 0
    }
  },

  // User Preferences & Settings
  userPreferences: {
    preferredLanguage: {
      type: String,
      enum: ['en', 'ur'],
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'Asia/Karachi'
    },
    notificationSettings: {
      emailNotifications: {
        type: Boolean,
        default: true
      },
      submissionReminders: {
        type: Boolean,
        default: true
      },
      cycleUpdates: {
        type: Boolean,
        default: true
      },
      deadlineAlerts: {
        type: Boolean,
        default: true
      }
    },
    dashboardSettings: {
      defaultView: {
        type: String,
        enum: ['summary', 'detailed', 'analytics'],
        default: 'summary'
      },
      showCompletedTasks: {
        type: Boolean,
        default: false
      },
      chartsPreference: {
        type: String,
        enum: ['bar', 'line', 'pie'],
        default: 'bar'
      }
    }
  },

  // Admin Control Fields
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'archived'],
    default: 'active'
  },
  lastModifiedAt: Date,
  lastModifiedBy: {
    type: Number,
    ref: 'User'
  },
  createdBy: {
    type: Number,
    ref: 'User'
  },

  // Security & Audit
  securitySettings: {
    mustChangePassword: {
      type: Boolean,
      default: false
    },
    passwordLastChanged: Date,
    invalidLoginAttempts: {
      type: Number,
      default: 0
    },
    lastInvalidLoginAt: Date,
    accountLockedUntil: Date,
    twoFactorEnabled: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'Users',
  _id: false // Disable auto-generated ObjectId
});

// Enhanced Indexes for Performance
userSchema.index({ deletedAt: 1 });
userSchema.index({ userName: 1 });
userSchema.index({ email: 1 });
userSchema.index({ userRole: 1 });
userSchema.index({ deptId: 1 });
userSchema.index({ facultyId: 1 });

// 🆕 NEW PERFORMANCE INDEXES
userSchema.index({ isActive: 1 });
userSchema.index({ status: 1 });
userSchema.index({ 'cycleAccess.currentCycleId': 1 });
userSchema.index({ 'cycleAccess.currentCycleYear': 1 });
userSchema.index({ 'activityTracking.lastActiveAt': 1 });

// Query Helpers
userSchema.query.active = function() {
  return this.where({ deletedAt: null, isActive: true });
};

userSchema.query.byRole = function(role) {
  return this.where({ userRole: role, deletedAt: null });
};

userSchema.query.byDepartment = function(deptId) {
  return this.where({ deptId: deptId, deletedAt: null });
};

userSchema.query.byFaculty = function(facultyId) {
  return this.where({ facultyId: facultyId, deletedAt: null });
};

userSchema.query.withCycleAccess = function(cycleId) {
  return this.where({
    'cycleAccess.currentCycleId': cycleId,
    deletedAt: null,
    isActive: true
  });
};

// Instance Methods
userSchema.methods.softDelete = function(adminId, reason) {
  this.deletedAt = new Date();
  this.isActive = false;
  this.status = 'archived';
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

userSchema.methods.restore = function(adminId) {
  this.deletedAt = null;
  this.isActive = true;
  this.status = 'active';
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

userSchema.methods.grantCycleAccess = function(cycleId, year, adminId, accessLevel = 'write') {
  // Update current cycle access
  this.cycleAccess.currentCycleId = cycleId;
  this.cycleAccess.currentCycleYear = year;

  // Add to access history
  this.cycleAccess.accessHistory.push({
    cycleId: cycleId,
    cycleYear: year,
    accessGrantedAt: new Date(),
    grantedBy: adminId,
    accessLevel: accessLevel,
    isActive: true
  });

  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

userSchema.methods.revokeCycleAccess = function(cycleId, adminId, reason) {
  // Find and update access history
  const accessRecord = this.cycleAccess.accessHistory.find(
    access => access.cycleId === cycleId && access.isActive
  );

  if (accessRecord) {
    accessRecord.isActive = false;
    accessRecord.accessRevokedAt = new Date();
    accessRecord.revokedBy = adminId;
  }

  // Clear current cycle if it matches
  if (this.cycleAccess.currentCycleId === cycleId) {
    this.cycleAccess.currentCycleId = null;
    this.cycleAccess.currentCycleYear = null;
  }

  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

userSchema.methods.updatePermissions = function(permissions, adminId) {
  Object.assign(this.cycleAccess.permissions, permissions);
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

userSchema.methods.updateSubmissionAccess = function(submissionSettings, adminId) {
  Object.assign(this.cycleAccess.submissionAccess, submissionSettings);
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

userSchema.methods.recordLogin = function() {
  this.activityTracking.lastLoginAt = new Date();
  this.activityTracking.lastActiveAt = new Date();
  this.activityTracking.totalLogins += 1;
  this.activityTracking.sessionsThisMonth += 1;
  return this.save();
};

userSchema.methods.recordActivity = function(cycleId = null, year = null) {
  this.activityTracking.lastActiveAt = new Date();
  if (cycleId) this.activityTracking.lastCycleAccessed = cycleId;
  if (year) this.activityTracking.lastYearAccessed = year;
  return this.save();
};

userSchema.methods.recordSubmission = function(submissionTime = null) {
  this.activityTracking.totalSubmissions += 1;
  this.activityTracking.lastSubmissionAt = new Date();

  if (submissionTime) {
    const currentAvg = this.activityTracking.averageSubmissionTime || 0;
    const totalSubmissions = this.activityTracking.totalSubmissions;
    this.activityTracking.averageSubmissionTime =
      ((currentAvg * (totalSubmissions - 1)) + submissionTime) / totalSubmissions;
  }

  return this.save();
};

userSchema.methods.hasAccessToCycle = function(cycleId) {
  return this.cycleAccess.currentCycleId === cycleId ||
         this.cycleAccess.permissions.canViewAllCycles ||
         this.userRole === 'Admin';
};

userSchema.methods.hasAccessToYear = function(year) {
  return this.cycleAccess.currentCycleYear === year ||
         this.cycleAccess.permissions.canViewPreviousYears ||
         this.userRole === 'Admin';
};

userSchema.methods.canSubmitForType = function(submissionType) {
  if (submissionType === 'projected') {
    return this.cycleAccess.submissionAccess.canSubmitProjected;
  }
  if (submissionType === 'actual') {
    return this.cycleAccess.submissionAccess.canSubmitActual;
  }
  return false;
};

// Virtuals
userSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

userSchema.virtual('isCurrentlyActive').get(function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.activityTracking.lastActiveAt &&
         this.activityTracking.lastActiveAt > fiveMinutesAgo;
});

userSchema.virtual('hasCurrentCycleAccess').get(function() {
  return this.cycleAccess.currentCycleId !== null;
});

userSchema.virtual('daysSinceLastLogin').get(function() {
  if (!this.activityTracking.lastLoginAt) return null;
  return Math.floor((new Date() - this.activityTracking.lastLoginAt) / (1000 * 60 * 60 * 24));
});

// Static Methods
userSchema.statics.getActiveUsers = function() {
  return this.find({ isActive: true, deletedAt: null })
             .sort({ 'activityTracking.lastActiveAt': -1 });
};

userSchema.statics.getUsersByCycle = function(cycleId) {
  return this.find({
    'cycleAccess.currentCycleId': cycleId,
    isActive: true,
    deletedAt: null
  });
};

userSchema.statics.getUsersByRole = function(role) {
  return this.find({ userRole: role, isActive: true, deletedAt: null });
};

userSchema.statics.getUsersByDepartment = function(deptId) {
  return this.find({ deptId: deptId, isActive: true, deletedAt: null });
};

// Pre-save middleware to set defaults and handle role-based permissions
userSchema.pre('save', function(next) {
  // Set role-based default permissions
  if (this.isNew || this.isModified('userRole')) {
    switch (this.userRole) {
      case 'Admin':
        this.cycleAccess.permissions.canViewAllCycles = true;
        this.cycleAccess.permissions.canAccessTargetYear = true;
        this.cycleAccess.permissions.restrictedToDepartment = false;
        this.cycleAccess.permissions.restrictedToFaculty = false;
        this.cycleAccess.submissionAccess.canSubmitActual = true;
        this.cycleAccess.submissionAccess.canDeleteSubmissions = true;
        break;
      case 'VC':
      case 'PVC':
        this.cycleAccess.permissions.canViewAllCycles = true;
        this.cycleAccess.permissions.canAccessTargetYear = true;
        this.cycleAccess.permissions.restrictedToDepartment = false;
        this.cycleAccess.permissions.restrictedToFaculty = false;
        break;
      case 'Dean':
        this.cycleAccess.permissions.restrictedToDepartment = false;
        this.cycleAccess.permissions.restrictedToFaculty = true;
        break;
      case 'Chairman':
        this.cycleAccess.permissions.restrictedToDepartment = true;
        this.cycleAccess.permissions.restrictedToFaculty = true;
        break;
    }
  }

  next();
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('User', userSchema);