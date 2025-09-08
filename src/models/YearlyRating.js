const mongoose = require('mongoose');

// YearlyRatingValue Schema (embedded)
const yearlyRatingValueSchema = new mongoose.Schema({
  year: Number,
  actualValue: Number,
  projectedValue: Number,
  textValue: String
}, { _id: true }); // Keep _id for embedded docs

// YearlyRating Schema (exact replica)
const yearlyRatingSchema = new mongoose.Schema({
  ratingYear: { 
    type: Number, 
    required: true 
  },
  ratingValues: [yearlyRatingValueSchema], // Array of rating values
  userId: { 
    type: String, // String to match .NET Guid format
    required: true,
    ref: 'User'
  },
  parameterName: { 
    type: String, 
    required: true 
  },
  parameterId: { 
    type: Number, // Keep as number for exact compatibility
    required: true 
  },
  categoryId: { 
    type: Number, // Number to match Category integer ID
    required: true 
  },
  deletedAt: {
    type: Date,
    default: null // Soft delete pattern
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'YearlyRatings'
});

// Indexes for performance
yearlyRatingSchema.index({ deletedAt: 1 });
yearlyRatingSchema.index({ userId: 1 });
yearlyRatingSchema.index({ categoryId: 1 });
yearlyRatingSchema.index({ parameterId: 1 });
yearlyRatingSchema.index({ ratingYear: 1 });
yearlyRatingSchema.index({ userId: 1, categoryId: 1 }); // Composite index for common queries

// Query helper for active ratings
yearlyRatingSchema.query.active = function() {
  return this.where({ deletedAt: null });
};

// Query helper for ratings by user and category
yearlyRatingSchema.query.byUserAndCategory = function(userId, categoryId) {
  return this.where({ 
    userId: userId, 
    categoryId: categoryId, 
    deletedAt: null 
  });
};

// Instance method for soft delete
yearlyRatingSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore
yearlyRatingSchema.methods.restore = function() {
  this.deletedAt = null;
  return this.save();
};

module.exports = mongoose.model('YearlyRating', yearlyRatingSchema);