const mongoose = require('mongoose');

// ParameterCycle Association Model - Manages parameter inheritance across cycles
// 🎯 PURPOSE: Enable parameter carry-forward between cycles with cycle-specific configuration
const parameterCycleSchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true
  },

  // Core Associations
  parameterId: {
    type: Number,
    required: true,
    ref: 'Parameter'
  },
  cycleId: {
    type: Number,
    required: true,
    ref: 'Cycle'
  },

  // Parameter Status in Cycle
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived', 'migrated'],
    default: 'active'
  },

  // Inheritance Tracking
  inheritedFromCycle: {
    type: Number,
    ref: 'Cycle',
    default: null // null means original parameter creation
  },
  inheritanceHistory: [{
    fromCycleId: {
      type: Number,
      ref: 'Cycle'
    },
    toCycleId: {
      type: Number,
      ref: 'Cycle'
    },
    inheritedAt: {
      type: Date,
      default: Date.now
    },
    inheritedBy: String, // Admin ID who performed inheritance
    preservedSettings: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],

  // Cycle-Specific Parameter Configuration
  cycleSpecificSettings: {
    // Target values can be different for each cycle
    targetValue: {
      type: Number,
      default: null
    },
    targetDescription: String,
    targetCategory: {
      type: String,
      enum: ['minimum', 'maximum', 'exact', 'range'],
      default: 'minimum'
    },

    // Weight/Priority in this specific cycle
    weightInCycle: {
      type: Number,
      default: 1.0,
      min: 0,
      max: 10
    },
    priorityLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },

    // Submission configuration
    submissionRequirements: {
      isRequired: {
        type: Boolean,
        default: true
      },
      requiresEvidence: {
        type: Boolean,
        default: false
      },
      evidenceTypes: [{
        type: String,
        enum: ['document', 'image', 'url', 'text']
      }],
      minimumSubmissions: {
        type: Number,
        default: 1
      }
    },

    // Year-specific overrides
    yearlyOverrides: [{
      year: Number,
      targetValue: Number,
      isRequired: Boolean,
      notes: String,
      modifiedAt: Date,
      modifiedBy: String
    }]
  },

  // Performance Tracking
  performanceMetrics: {
    totalSubmissions: {
      type: Number,
      default: 0
    },
    averageValue: {
      type: Number,
      default: 0
    },
    lastSubmissionDate: Date,
    bestPerformingYear: Number,
    worstPerformingYear: Number,
    trendDirection: {
      type: String,
      enum: ['improving', 'declining', 'stable', 'insufficient_data'],
      default: 'insufficient_data'
    }
  },

  // Admin Control
  activatedAt: Date,
  activatedBy: String,
  deactivatedAt: Date,
  deactivatedBy: String,
  lastModifiedAt: Date,
  lastModifiedBy: String,

  // Soft Delete
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: String,
  deletionReason: String,

  // Metadata
  notes: String,
  customProperties: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'ParameterCycles',
  _id: false
});

// Performance Indexes
parameterCycleSchema.index({ parameterId: 1, cycleId: 1 }, { unique: true });
parameterCycleSchema.index({ cycleId: 1, isActive: 1 });
parameterCycleSchema.index({ parameterId: 1 });
parameterCycleSchema.index({ deletedAt: 1 });
parameterCycleSchema.index({ status: 1 });
parameterCycleSchema.index({ inheritedFromCycle: 1 });

// Query Helpers
parameterCycleSchema.query.active = function() {
  return this.where({ deletedAt: null, isActive: true });
};

parameterCycleSchema.query.byCycle = function(cycleId) {
  return this.where({ cycleId: cycleId, deletedAt: null });
};

parameterCycleSchema.query.byParameter = function(parameterId) {
  return this.where({ parameterId: parameterId, deletedAt: null });
};

parameterCycleSchema.query.inherited = function() {
  return this.where({ inheritedFromCycle: { $ne: null } });
};

parameterCycleSchema.query.original = function() {
  return this.where({ inheritedFromCycle: null });
};

// Instance Methods
parameterCycleSchema.methods.softDelete = function(adminId, reason) {
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  this.deletionReason = reason;
  this.isActive = false;
  this.status = 'archived';
  return this.save();
};

parameterCycleSchema.methods.restore = function(adminId) {
  this.deletedAt = null;
  this.deletedBy = null;
  this.deletionReason = null;
  this.isActive = true;
  this.status = 'active';
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

parameterCycleSchema.methods.activate = function(adminId) {
  this.isActive = true;
  this.status = 'active';
  this.activatedAt = new Date();
  this.activatedBy = adminId;
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

parameterCycleSchema.methods.deactivate = function(adminId, reason) {
  this.isActive = false;
  this.status = 'inactive';
  this.deactivatedAt = new Date();
  this.deactivatedBy = adminId;
  this.notes = reason || this.notes;
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

parameterCycleSchema.methods.updateCycleSettings = function(settings, adminId) {
  Object.assign(this.cycleSpecificSettings, settings);
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

parameterCycleSchema.methods.addYearlyOverride = function(year, overrides, adminId) {
  // Remove existing override for this year
  this.cycleSpecificSettings.yearlyOverrides =
    this.cycleSpecificSettings.yearlyOverrides.filter(o => o.year !== year);

  // Add new override
  this.cycleSpecificSettings.yearlyOverrides.push({
    year: year,
    ...overrides,
    modifiedAt: new Date(),
    modifiedBy: adminId
  });

  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

parameterCycleSchema.methods.recordInheritance = function(fromCycleId, adminId, preservedSettings = {}) {
  this.inheritedFromCycle = fromCycleId;
  this.inheritanceHistory.push({
    fromCycleId: fromCycleId,
    toCycleId: this.cycleId,
    inheritedAt: new Date(),
    inheritedBy: adminId,
    preservedSettings: preservedSettings
  });

  this.lastModifiedAt = new Date();
  this.lastModifiedBy = adminId;
  return this.save();
};

parameterCycleSchema.methods.updatePerformanceMetrics = function(submissionData) {
  const metrics = this.performanceMetrics;

  metrics.totalSubmissions = submissionData.totalSubmissions || 0;
  metrics.averageValue = submissionData.averageValue || 0;
  metrics.lastSubmissionDate = submissionData.lastSubmissionDate;
  metrics.bestPerformingYear = submissionData.bestPerformingYear;
  metrics.worstPerformingYear = submissionData.worstPerformingYear;

  // Calculate trend direction
  if (submissionData.yearlyAverages && submissionData.yearlyAverages.length >= 2) {
    const recent = submissionData.yearlyAverages.slice(-2);
    if (recent[1] > recent[0]) {
      metrics.trendDirection = 'improving';
    } else if (recent[1] < recent[0]) {
      metrics.trendDirection = 'declining';
    } else {
      metrics.trendDirection = 'stable';
    }
  }

  return this.save();
};

// Virtuals
parameterCycleSchema.virtual('isInherited').get(function() {
  return this.inheritedFromCycle !== null;
});

parameterCycleSchema.virtual('isOriginal').get(function() {
  return this.inheritedFromCycle === null;
});

parameterCycleSchema.virtual('hasYearlyOverrides').get(function() {
  return this.cycleSpecificSettings.yearlyOverrides &&
         this.cycleSpecificSettings.yearlyOverrides.length > 0;
});

parameterCycleSchema.virtual('inheritanceDepth').get(function() {
  return this.inheritanceHistory.length;
});

// Static Methods
parameterCycleSchema.statics.inheritParametersFromCycle = async function(fromCycleId, toCycleId, adminId, options = {}) {
  const sourceParameters = await this.find({
    cycleId: fromCycleId,
    deletedAt: null,
    isActive: true
  }).populate('parameterId');

  const inheritedParameters = [];

  for (const sourceParam of sourceParameters) {
    // Check if parameter already exists in target cycle
    const existing = await this.findOne({
      parameterId: sourceParam.parameterId._id,
      cycleId: toCycleId
    });

    if (!existing) {
      // Generate new ID for the inherited parameter-cycle association
      const lastDoc = await this.findOne().sort({ _id: -1 });
      const newId = (lastDoc?._id || 0) + 1;

      const inheritedParam = new this({
        _id: newId,
        parameterId: sourceParam.parameterId._id,
        cycleId: toCycleId,
        inheritedFromCycle: fromCycleId,
        isActive: options.activateInherited !== false,
        status: 'active',
        cycleSpecificSettings: {
          ...sourceParam.cycleSpecificSettings,
          yearlyOverrides: [] // Reset yearly overrides for new cycle
        },
        inheritanceHistory: [{
          fromCycleId: fromCycleId,
          toCycleId: toCycleId,
          inheritedAt: new Date(),
          inheritedBy: adminId,
          preservedSettings: sourceParam.cycleSpecificSettings
        }],
        activatedAt: new Date(),
        activatedBy: adminId,
        lastModifiedAt: new Date(),
        lastModifiedBy: adminId
      });

      await inheritedParam.save();
      inheritedParameters.push(inheritedParam);
    }
  }

  return inheritedParameters;
};

parameterCycleSchema.statics.getActiveByCycle = function(cycleId) {
  return this.find({ cycleId: cycleId, isActive: true, deletedAt: null })
             .populate('parameterId');
};

parameterCycleSchema.statics.getParameterCycles = function(parameterId) {
  return this.find({ parameterId: parameterId, deletedAt: null })
             .populate('cycleId')
             .sort({ 'cycleId.startYear': -1 });
};

// Ensure virtual fields are serialized
parameterCycleSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('ParameterCycle', parameterCycleSchema);