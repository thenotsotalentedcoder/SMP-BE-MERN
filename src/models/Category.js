const mongoose = require('mongoose');

// Category Schema (exact replica with integer ID for .NET compatibility)
const categorySchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true
  },
  name: { 
    type: String, 
    required: true 
  },
  description: String,
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
  collection: 'Categories',
  _id: false // Disable auto-generated ObjectId
});

// Index for soft delete queries
categorySchema.index({ deletedAt: 1 });

// Query helper for active categories
categorySchema.query.active = function() {
  return this.where({ deletedAt: null });
};

// Instance method for soft delete
categorySchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore
categorySchema.methods.restore = function() {
  this.deletedAt = null;
  return this.save();
};

module.exports = mongoose.model('Category', categorySchema);