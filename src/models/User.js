const mongoose = require('mongoose');

// User Schema (exact ApplicationUser replica)
const userSchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'Users'
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('User', userSchema);