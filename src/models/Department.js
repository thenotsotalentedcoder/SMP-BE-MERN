const mongoose = require('mongoose');

// Department Schema (exact replica with integer ID for .NET compatibility)
const departmentSchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true
  },
  deptCode: { 
    type: String, 
    required: true,
    unique: true
  },
  deptName: { 
    type: String, 
    required: true 
  },
  faculty: { 
    type: Number, // Changed to Number to match Faculty integer ID
    ref: 'Faculty',
    required: true
  },
  deletedAt: {
    type: Date,
    default: null // Soft delete pattern
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'Departments',
  _id: false // Disable auto-generated ObjectId
});

// Index for soft delete queries and foreign key
departmentSchema.index({ deletedAt: 1 });
departmentSchema.index({ faculty: 1 });
departmentSchema.index({ deptCode: 1 });

// Query helper for active departments
departmentSchema.query.active = function() {
  return this.where({ deletedAt: null });
};

// Instance method for soft delete
departmentSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore
departmentSchema.methods.restore = function() {
  this.deletedAt = null;
  return this.save();
};

module.exports = mongoose.model('Department', departmentSchema);