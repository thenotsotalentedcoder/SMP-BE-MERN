const mongoose = require('mongoose');

// Enhanced ParameterSubmission Model - Tracks all parameter submissions across cycles and years
// 🎯 PURPOSE: Complete submission tracking with cycle awareness and dual submission support
const parameterSubmissionSchema = new mongoose.Schema({
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
  parameterCycleId: {
    type: Number,
    required: true,
    ref: 'ParameterCycle'
  },
  cycleId: {
    type: Number,
    required: true,
    ref: 'Cycle'
  },
  userId: {
    type: Number,
    required: true,
    ref: 'User'
  },

  // Submission Context
  submissionYear: {
    type: Number,
    required: true
  },
  submissionType: {
    type: String,
    enum: ['projected', 'actual'],
    required: true
  },
  submissionPeriod: {
    type: String,
    enum: ['annual', 'mid_year', 'quarterly', 'final'],
    default: 'annual'
  },

  // Submission Data
  submittedValue: {
    type: Number,
    required: true
  },
  targetValue: Number, // Snapshot of target at submission time
  varianceFromTarget: Number, // Calculated field
  variancePercentage: Number, // Calculated field

  // Performance Classification
  performanceStatus: {
    type: String,
    enum: ['exceeds_target', 'meets_target', 'below_target', 'insufficient_data'],
    default: 'insufficient_data'
  },
  achievementLevel: {
    type: String,
    enum: ['outstanding', 'good', 'satisfactory', 'needs_improvement', 'poor'],
    default: 'satisfactory'
  },

  // Evidence and Documentation
  evidence: [{
    type: {
      type: String,
      enum: ['document', 'image', 'url', 'text'],
      required: true
    },
    title: String,
    description: String,
    filePath: String, // For documents and images
    url: String, // For URL evidence
    textContent: String, // For text evidence
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    fileSize: Number,
    mimeType: String
  }],

  // Submission Metadata
  remarks: String,
  submissionNotes: String,
  internalNotes: String, // Admin only

  // Approval Workflow
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'needs_revision'],
    default: 'pending'
  },
  approvedBy: {
    type: Number,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  revisionRequested: String,

  // Version Control
  version: {
    type: Number,
    default: 1
  },
  isLatestVersion: {
    type: Boolean,
    default: true
  },
  previousVersionId: {
    type: Number,
    ref: 'ParameterSubmission'
  },
  revisionHistory: [{
    version: Number,
    submittedValue: Number,
    revisedAt: Date,
    revisedBy: {
      type: Number,
      ref: 'User'
    },
    revisionReason: String,
    changesDescription: String
  }],

  // Quality Assurance
  dataQuality: {
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: Number,
      ref: 'User'
    },
    verifiedAt: Date,
    qualityScore: {
      type: Number,
      min: 0,
      max: 100
    },
    qualityNotes: String,
    hasDiscrepancies: {
      type: Boolean,
      default: false
    },
    discrepancyDetails: String
  },

  // Comparison Data
  comparisonMetrics: {
    previousYearValue: Number,
    yearOverYearChange: Number,
    yearOverYearPercentage: Number,
    trendDirection: {
      type: String,
      enum: ['improving', 'declining', 'stable', 'no_data']
    },
    departmentAverage: Number,
    facultyAverage: Number,
    universityAverage: Number,
    ranking: {
      departmentRank: Number,
      facultyRank: Number,
      universityRank: Number,
      totalDepartments: Number,
      totalFaculties: Number
    }
  },

  // Timeline Tracking
  submissionTimeline: {
    draftSavedAt: Date,
    firstSubmittedAt: Date,
    lastModifiedAt: Date,
    approvalRequestedAt: Date,
    finalSubmittedAt: Date,
    deadlineDate: Date,
    isLateSubmission: {
      type: Boolean,
      default: false
    },
    daysAfterDeadline: Number
  },

  // Status and Control
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'archived'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFlagged: {
    type: Boolean,
    default: false
  },
  flagReason: String,
  flaggedBy: {
    type: Number,
    ref: 'User'
  },
  flaggedAt: Date,

  // Soft Delete
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: Number,
    ref: 'User'
  },
  deletionReason: String,

  // System Fields
  ipAddress: String,
  userAgent: String,
  submissionSource: {
    type: String,
    enum: ['web', 'mobile', 'api', 'bulk_import'],
    default: 'web'
  },

  // Custom Fields
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'ParameterSubmissions',
  _id: false
});

// Compound Indexes for Performance
parameterSubmissionSchema.index({
  parameterId: 1,
  cycleId: 1,
  submissionYear: 1,
  submissionType: 1
}, { unique: true });

parameterSubmissionSchema.index({ cycleId: 1, submissionYear: 1 });
parameterSubmissionSchema.index({ userId: 1, submissionYear: 1 });
parameterSubmissionSchema.index({ parameterCycleId: 1 });
parameterSubmissionSchema.index({ deletedAt: 1 });
parameterSubmissionSchema.index({ status: 1 });
parameterSubmissionSchema.index({ approvalStatus: 1 });
parameterSubmissionSchema.index({ submissionType: 1, submissionYear: 1 });
parameterSubmissionSchema.index({ performanceStatus: 1 });
parameterSubmissionSchema.index({ isLatestVersion: 1 });
parameterSubmissionSchema.index({ 'submissionTimeline.firstSubmittedAt': 1 });

// Query Helpers
parameterSubmissionSchema.query.active = function() {
  return this.where({ deletedAt: null, isActive: true });
};

parameterSubmissionSchema.query.byCycle = function(cycleId) {
  return this.where({ cycleId: cycleId, deletedAt: null });
};

parameterSubmissionSchema.query.byYear = function(year) {
  return this.where({ submissionYear: year, deletedAt: null });
};

parameterSubmissionSchema.query.byType = function(type) {
  return this.where({ submissionType: type, deletedAt: null });
};

parameterSubmissionSchema.query.latest = function() {
  return this.where({ isLatestVersion: true, deletedAt: null });
};

parameterSubmissionSchema.query.approved = function() {
  return this.where({ approvalStatus: 'approved', deletedAt: null });
};

parameterSubmissionSchema.query.pending = function() {
  return this.where({ approvalStatus: 'pending', deletedAt: null });
};

parameterSubmissionSchema.query.byUser = function(userId) {
  return this.where({ userId: userId, deletedAt: null });
};

// Instance Methods
parameterSubmissionSchema.methods.softDelete = function(adminId, reason) {
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  this.deletionReason = reason;
  this.isActive = false;
  this.status = 'archived';
  return this.save();
};

parameterSubmissionSchema.methods.restore = function(adminId) {
  this.deletedAt = null;
  this.deletedBy = null;
  this.deletionReason = null;
  this.isActive = true;
  if (this.status === 'archived') {
    this.status = 'draft';
  }
  return this.save();
};

parameterSubmissionSchema.methods.calculateVariance = function() {
  if (this.targetValue && this.submittedValue !== null) {
    this.varianceFromTarget = this.submittedValue - this.targetValue;
    this.variancePercentage = this.targetValue !== 0
      ? Math.round((this.varianceFromTarget / this.targetValue) * 100)
      : 0;

    // Update performance status
    if (this.submittedValue >= this.targetValue) {
      this.performanceStatus = 'meets_target';
      if (this.variancePercentage > 10) {
        this.performanceStatus = 'exceeds_target';
      }
    } else {
      this.performanceStatus = 'below_target';
    }
  }
  return this;
};

parameterSubmissionSchema.methods.submit = function(userId) {
  this.status = 'submitted';
  this.approvalStatus = 'pending';
  this.submissionTimeline.finalSubmittedAt = new Date();

  if (!this.submissionTimeline.firstSubmittedAt) {
    this.submissionTimeline.firstSubmittedAt = new Date();
  }

  // Check if late submission
  if (this.submissionTimeline.deadlineDate &&
      this.submissionTimeline.finalSubmittedAt > this.submissionTimeline.deadlineDate) {
    this.isLateSubmission = true;
    this.daysAfterDeadline = Math.ceil(
      (this.submissionTimeline.finalSubmittedAt - this.submissionTimeline.deadlineDate) / (1000 * 60 * 60 * 24)
    );
  }

  this.calculateVariance();
  return this.save();
};

parameterSubmissionSchema.methods.approve = function(adminId, notes) {
  this.approvalStatus = 'approved';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  this.status = 'approved';
  this.dataQuality.isVerified = true;
  this.dataQuality.verifiedBy = adminId;
  this.dataQuality.verifiedAt = new Date();

  if (notes) {
    this.internalNotes = notes;
  }

  return this.save();
};

parameterSubmissionSchema.methods.reject = function(adminId, reason) {
  this.approvalStatus = 'rejected';
  this.rejectionReason = reason;
  this.status = 'rejected';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  return this.save();
};

parameterSubmissionSchema.methods.requestRevision = function(adminId, revisionNotes) {
  this.approvalStatus = 'needs_revision';
  this.revisionRequested = revisionNotes;
  this.status = 'under_review';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  return this.save();
};

parameterSubmissionSchema.methods.createRevision = function(newData, userId) {
  // Mark current version as not latest
  this.isLatestVersion = false;

  // Create new version
  const newVersion = new this.constructor({
    ...this.toObject(),
    _id: undefined, // Will be auto-generated
    version: this.version + 1,
    isLatestVersion: true,
    previousVersionId: this._id,
    ...newData,
    status: 'draft',
    approvalStatus: 'pending',
    submissionTimeline: {
      ...this.submissionTimeline,
      lastModifiedAt: new Date(),
      finalSubmittedAt: null
    }
  });

  // Add to revision history
  newVersion.revisionHistory.push({
    version: this.version,
    submittedValue: this.submittedValue,
    revisedAt: new Date(),
    revisedBy: userId,
    revisionReason: newData.revisionReason || 'Updated submission',
    changesDescription: newData.changesDescription || 'Values updated'
  });

  return newVersion.save();
};

parameterSubmissionSchema.methods.flag = function(adminId, reason) {
  this.isFlagged = true;
  this.flagReason = reason;
  this.flaggedBy = adminId;
  this.flaggedAt = new Date();
  return this.save();
};

parameterSubmissionSchema.methods.unflag = function(adminId) {
  this.isFlagged = false;
  this.flagReason = null;
  this.flaggedBy = null;
  this.flaggedAt = null;
  return this.save();
};

// Virtuals
parameterSubmissionSchema.virtual('isOverdue').get(function() {
  return this.submissionTimeline.deadlineDate &&
         new Date() > this.submissionTimeline.deadlineDate &&
         this.status === 'draft';
});

parameterSubmissionSchema.virtual('daysSinceSubmission').get(function() {
  if (!this.submissionTimeline.firstSubmittedAt) return null;
  return Math.floor((new Date() - this.submissionTimeline.firstSubmittedAt) / (1000 * 60 * 60 * 24));
});

parameterSubmissionSchema.virtual('hasEvidence').get(function() {
  return this.evidence && this.evidence.length > 0;
});

parameterSubmissionSchema.virtual('achievementPercentage').get(function() {
  if (!this.targetValue || this.targetValue === 0) return null;
  return Math.round((this.submittedValue / this.targetValue) * 100);
});

// Static Methods
parameterSubmissionSchema.statics.getSubmissionsByCycle = function(cycleId, year = null) {
  const query = { cycleId: cycleId, deletedAt: null };
  if (year) query.submissionYear = year;

  return this.find(query)
             .populate('parameterId')
             .populate('userId')
             .sort({ submissionYear: -1, 'submissionTimeline.firstSubmittedAt': -1 });
};

parameterSubmissionSchema.statics.getUserSubmissions = function(userId, cycleId = null, year = null) {
  const query = { userId: userId, deletedAt: null, isLatestVersion: true };
  if (cycleId) query.cycleId = cycleId;
  if (year) query.submissionYear = year;

  return this.find(query)
             .populate('parameterId')
             .populate('parameterCycleId')
             .sort({ submissionYear: -1 });
};

parameterSubmissionSchema.statics.getPerformanceAnalytics = async function(cycleId, year = null) {
  const matchStage = {
    cycleId: cycleId,
    deletedAt: null,
    approvalStatus: 'approved',
    isLatestVersion: true
  };
  if (year) matchStage.submissionYear = year;

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$performanceStatus',
        count: { $sum: 1 },
        avgValue: { $avg: '$submittedValue' },
        avgVariance: { $avg: '$variancePercentage' }
      }
    },
    {
      $group: {
        _id: null,
        totalSubmissions: { $sum: '$count' },
        statusBreakdown: {
          $push: {
            status: '$_id',
            count: '$count',
            avgValue: '$avgValue',
            avgVariance: '$avgVariance'
          }
        }
      }
    }
  ]);
};

// Pre-save middleware
parameterSubmissionSchema.pre('save', function(next) {
  // Auto-calculate variance if values exist
  if (this.targetValue && this.submittedValue !== null && this.isModified('submittedValue')) {
    this.calculateVariance();
  }

  // Update timeline
  if (this.isModified() && !this.submissionTimeline.lastModifiedAt) {
    this.submissionTimeline.lastModifiedAt = new Date();
  }

  next();
});

// Ensure virtual fields are serialized
parameterSubmissionSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('ParameterSubmission', parameterSubmissionSchema);