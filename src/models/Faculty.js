const mongoose = require('mongoose');

// Faculty Schema (exact replica with integer ID for .NET compatibility)
const facultySchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true
  },
  name: { 
    type: String, 
    required: true 
  },
  facultyCode: { 
    type: String, 
    required: true,
    unique: true
  },
  deletedAt: {
    type: Date,
    default: null // Soft delete pattern
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'Faculties',
  _id: false // Disable auto-generated ObjectId
});

// Index for soft delete queries
facultySchema.index({ deletedAt: 1 });
facultySchema.index({ facultyCode: 1 });

// Query helper for active faculties
facultySchema.query.active = function() {
  return this.where({ deletedAt: null });
};

// Instance method for soft delete
facultySchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore
facultySchema.methods.restore = function() {
  this.deletedAt = null;
  return this.save();
};

module.exports = mongoose.model('Faculty', facultySchema);