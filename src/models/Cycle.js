const mongoose = require('mongoose');

// Cycle Schema (exact replica with integer ID for .NET compatibility)
const cycleSchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true
  },
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
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'Cycles',
  _id: false // Disable auto-generated ObjectId
});

// Index for soft delete queries
cycleSchema.index({ deletedAt: 1 });
cycleSchema.index({ name: 1 });
cycleSchema.index({ startYear: 1, endYear: 1 });

// Query helper for active cycles
cycleSchema.query.active = function() {
  return this.where({ deletedAt: null });
};

// Instance method for soft delete
cycleSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore
cycleSchema.methods.restore = function() {
  this.deletedAt = null;
  return this.save();
};

// Virtual to check if cycle is current
cycleSchema.virtual('isCurrent').get(function() {
  const now = new Date();
  return now >= this.startYear && now <= this.endYear;
});

// Ensure virtual fields are serialized
cycleSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Cycle', cycleSchema);