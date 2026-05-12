const mongoose = require('mongoose');

// Parameter Schema (exact replica with integer ID for .NET compatibility)
const parameterSchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true
  },
  parameterName: { 
    type: String, 
    required: true 
  },
  parameterType: { // Fixed typo from original .NET code
    type: String, 
    required: true 
  },
  description: String,
  year: {
    type: Number,
    required: false  // Optional for new year-based system, kept for legacy compatibility
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  category: { 
    type: String, 
    required: true 
  },
  cycle: { 
    type: Number, // Changed to Number to match .NET int
    ref: 'Cycle' 
  },
  parameterRoles: String, // Roles that can access this parameter (legacy field)

  // ➕ NEW: Group-based access control
  accessibleToGroups: [{
    type: String,
    enum: [
      'Academic Departments',
      'ORIC', 'QEC', 'CSA',
      'Directorate of Finance', 'DIL', 'UAFA',
      'DWS', 'ITD', 'Library', 'Medical Center',
      'NED Academy', 'Registrar Office'
    ],
    default: 'Academic Departments'  // Default for backwards compatibility
  }],

  restrictedAccess: {
    type: Boolean,
    default: false    // false = visible to all (backwards compatible)
  },

  maxValue: {
    type: Number,
    default: 100  // Default for backward compatibility with migrated documents
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  deletedAt: {
    type: Date,
    default: null // Soft delete pattern
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'Parameters',
  _id: false // Disable auto-generated ObjectId
});

// Index for queries
parameterSchema.index({ deletedAt: 1 });
parameterSchema.index({ category: 1 });
parameterSchema.index({ cycle: 1 });
parameterSchema.index({ year: 1 });
parameterSchema.index({ isActive: 1 });
parameterSchema.index({ sortOrder: 1 });

// ➕ NEW: Indexes for group access control
parameterSchema.index({ accessibleToGroups: 1 });
parameterSchema.index({ restrictedAccess: 1 });
parameterSchema.index({ accessibleToGroups: 1, restrictedAccess: 1 }); // Compound index for filtering

// Query helper for active parameters
parameterSchema.query.active = function() {
  return this.where({ deletedAt: null, isActive: true });
};

// Query helper for parameters by category
parameterSchema.query.byCategory = function(category) {
  return this.where({ category: category, deletedAt: null, isActive: true });
};

// Instance method for soft delete
parameterSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  this.isActive = false;
  return this.save();
};

// Instance method to restore
parameterSchema.methods.restore = function() {
  this.deletedAt = null;
  this.isActive = true;
  return this.save();
};

module.exports = mongoose.model('Parameter', parameterSchema);