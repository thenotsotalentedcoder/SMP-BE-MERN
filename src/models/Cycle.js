const mongoose = require('mongoose');

// Enhanced Cycle Schema with dynamic year management
// ✅ BACKWARD COMPATIBLE: All existing fields preserved
const cycleSchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true
  },

  // ✅ EXISTING FIELDS (preserved for backward compatibility)
  name: {
    type: String,
    required: true,
    unique: true
  },
  startYear: {
    type: Date,
    required: true
  },
  endYear: {
    type: Date,
    required: true
  },
  deletedAt: {
    type: Date,
    default: null // Soft delete pattern
  },

  // 🆕 ENHANCED DYNAMIC CYCLE FIELDS
  cycleName: {
    type: String,
    default: function() {
      // Auto-generate from existing name if not provided
      return this.name || `Strategic Plan ${this.startYear?.getFullYear()}-${this.endYear?.getFullYear()}`;
    }
  },

  // Dynamic Year Management
  cycleYears: {
    type: [Number],
    default: function() {
      if (this.startYear && this.endYear) {
        const start = this.startYear.getFullYear();
        const end = this.endYear.getFullYear();
        const years = [];
        for (let year = start; year <= end; year++) {
          years.push(year);
        }
        return years;
      }
      return [];
    }
  },

  currentActiveYear: {
    type: Number,
    default: function() {
      return this.startYear ? this.startYear.getFullYear() : new Date().getFullYear();
    }
  },

  activatedYears: {
    type: [Number],
    default: function() {
      const activeYear = this.currentActiveYear || (this.startYear ? this.startYear.getFullYear() : new Date().getFullYear());
      return [activeYear];
    }
  },

  // Enhanced Status Management
  isActive: {
    type: Boolean,
    default: false
  },

  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'draft'
  },

  // Target Year Configuration
  targetYear: {
    type: Number,
    default: function() {
      return this.endYear ? this.endYear.getFullYear() : (new Date().getFullYear() + 5);
    }
  },

  targetYearSettings: {
    hasActualSubmission: {
      type: Boolean,
      default: false
    },
    hasProjectedSubmission: {
      type: Boolean,
      default: true
    },
    actualSubmissionEnabled: {
      type: Boolean,
      default: false
    },
    actualSubmissionEnabledAt: Date,
    actualSubmissionEnabledBy: String,

    projectedSubmissionWindow: {
      startYear: Number,
      endYear: Number
    },
    actualSubmissionWindow: {
      startYear: Number,
      endYear: Number
    },

    // Performance Tracking
    totalProjectedSubmissions: {
      type: Number,
      default: 0
    },
    totalActualSubmissions: {
      type: Number,
      default: 0
    },
    averageVariancePercentage: Number,
    parametersExceedingTargets: {
      type: Number,
      default: 0
    },
    parametersMetTargets: {
      type: Number,
      default: 0
    },
    parametersBelowTargets: {
      type: Number,
      default: 0
    }
  },

  // Year Activation History
  yearActivationHistory: [{
    year: Number,
    action: {
      type: String,
      enum: ['activated', 'deactivated']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: String,
    previousActiveYear: Number,
    reason: String
  }],

  // Admin Control & Audit
  createdBy: String,
  activatedAt: Date,
  deactivatedAt: Date,
  lastModifiedAt: Date,
  lastModifiedBy: String,
  isModifiable: {
    type: Boolean,
    default: true
  },

  // Metadata
  totalParameters: {
    type: Number,
    default: 0
  },
  activeParameters: {
    type: Number,
    default: 0
  },

  description: String
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'Cycles',
  _id: false // Disable auto-generated ObjectId
});

// Enhanced Indexes for Performance
cycleSchema.index({ deletedAt: 1 });
cycleSchema.index({ name: 1 });
cycleSchema.index({ startYear: 1, endYear: 1 });

// 🆕 NEW PERFORMANCE INDEXES
cycleSchema.index({ isActive: 1 });
cycleSchema.index({ status: 1 });
cycleSchema.index({ currentActiveYear: 1 });
cycleSchema.index({ targetYear: 1 });

// 🔒 CRITICAL: Only one active cycle constraint
cycleSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// ✅ EXISTING METHODS (preserved)
cycleSchema.query.active = function() {
  return this.where({ deletedAt: null });
};

cycleSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

cycleSchema.methods.restore = function() {
  this.deletedAt = null;
  return this.save();
};

// ✅ EXISTING VIRTUAL (preserved)
cycleSchema.virtual('isCurrent').get(function() {
  const now = new Date();
  return now >= this.startYear && now <= this.endYear;
});

// 🆕 NEW ENHANCED METHODS
cycleSchema.methods.activateYear = function(year, adminId, reason) {
  if (!this.cycleYears.includes(year)) {
    throw new Error(`Year ${year} is not part of this cycle`);
  }

  const previousActiveYear = this.currentActiveYear;
  this.currentActiveYear = year;

  // Add to activated years if not already present
  if (!this.activatedYears.includes(year)) {
    this.activatedYears.push(year);
  }

  // Record activation history
  this.yearActivationHistory.push({
    year: year,
    action: 'activated',
    timestamp: new Date(),
    performedBy: adminId,
    previousActiveYear: previousActiveYear,
    reason: reason
  });

  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;

  return this.save();
};

cycleSchema.methods.enableTargetYearActualSubmissions = function(adminId, reason) {
  this.targetYearSettings.actualSubmissionEnabled = true;
  this.targetYearSettings.actualSubmissionEnabledAt = new Date();
  this.targetYearSettings.actualSubmissionEnabledBy = adminId;

  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;

  return this.save();
};

cycleSchema.methods.isYearActive = function(year) {
  return this.currentActiveYear === year;
};

cycleSchema.methods.isYearEnabled = function(year) {
  return this.activatedYears.includes(year);
};

cycleSchema.methods.isTargetYear = function(year) {
  return this.targetYear === year;
};

// 🆕 NEW ENHANCED VIRTUALS
cycleSchema.virtual('yearRange').get(function() {
  const start = this.startYear ? this.startYear.getFullYear() : 'Unknown';
  const end = this.endYear ? this.endYear.getFullYear() : 'Unknown';
  return `${start}-${end}`;
});

cycleSchema.virtual('progressPercentage').get(function() {
  const currentYear = new Date().getFullYear();
  const startYear = this.startYear ? this.startYear.getFullYear() : currentYear;
  const endYear = this.endYear ? this.endYear.getFullYear() : currentYear + 5;

  if (currentYear < startYear) return 0;
  if (currentYear > endYear) return 100;

  const totalYears = endYear - startYear + 1;
  const completedYears = currentYear - startYear + 1;
  return Math.round((completedYears / totalYears) * 100);
});

cycleSchema.virtual('isInProgress').get(function() {
  const currentYear = new Date().getFullYear();
  const startYear = this.startYear ? this.startYear.getFullYear() : currentYear;
  const endYear = this.endYear ? this.endYear.getFullYear() : currentYear + 5;

  return currentYear >= startYear && currentYear <= endYear;
});

// Pre-save middleware to auto-populate enhanced fields
cycleSchema.pre('save', function(next) {
  // Auto-populate cycleName if not set
  if (!this.cycleName && this.name) {
    this.cycleName = this.name;
  }

  // Auto-populate cycleYears if not set
  if ((!this.cycleYears || this.cycleYears.length === 0) && this.startYear && this.endYear) {
    const start = this.startYear.getFullYear();
    const end = this.endYear.getFullYear();
    const years = [];
    for (let year = start; year <= end; year++) {
      years.push(year);
    }
    this.cycleYears = years;
  }

  // Auto-populate targetYear if not set
  if (!this.targetYear && this.endYear) {
    this.targetYear = this.endYear.getFullYear();
  }

  // Auto-populate currentActiveYear if not set
  if (!this.currentActiveYear && this.startYear) {
    this.currentActiveYear = this.startYear.getFullYear();
  }

  // Ensure activatedYears includes currentActiveYear
  if (this.currentActiveYear && !this.activatedYears.includes(this.currentActiveYear)) {
    this.activatedYears.push(this.currentActiveYear);
  }

  // Auto-populate target year submission windows
  if (!this.targetYearSettings.projectedSubmissionWindow.startYear && this.startYear) {
    this.targetYearSettings.projectedSubmissionWindow.startYear = this.startYear.getFullYear();
    this.targetYearSettings.projectedSubmissionWindow.endYear = this.targetYear - 1;
  }

  if (!this.targetYearSettings.actualSubmissionWindow.startYear && this.targetYear) {
    this.targetYearSettings.actualSubmissionWindow.startYear = this.targetYear;
    this.targetYearSettings.actualSubmissionWindow.endYear = this.targetYear;
  }

  next();
});

// Ensure virtual fields are serialized
cycleSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Cycle', cycleSchema);