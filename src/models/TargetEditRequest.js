const mongoose = require('mongoose');

const targetEditRequestSchema = new mongoose.Schema({
  parameterId: {
    type: Number,
    required: true
  },
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  yearlyRatingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'YearlyRating',
    default: null
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  // 'target' = unlock all target values, 'achieved' = unlock achieved value for a specific year
  requestType: {
    type: String,
    enum: ['target', 'achieved'],
    default: 'target'
  },
  // Only set for achieved requests — the specific year to unlock
  year: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'TargetEditRequests'
});

targetEditRequestSchema.index({ userId: 1, parameterId: 1 });
targetEditRequestSchema.index({ status: 1 });

module.exports = mongoose.model('TargetEditRequest', targetEditRequestSchema);
