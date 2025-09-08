const mongoose = require('mongoose');

// Counter Schema for auto-incrementing integer IDs
const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  sequence_value: {
    type: Number,
    default: 0
  }
}, {
  collection: 'Counters'
});

// Static method to get next sequence
counterSchema.statics.getNextSequence = async function(sequenceName) {
  try {
    const counter = await this.findByIdAndUpdate(
      sequenceName,
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );
    return counter.sequence_value;
  } catch (error) {
    throw new Error(`Failed to generate sequence for ${sequenceName}: ${error.message}`);
  }
};

module.exports = mongoose.model('Counter', counterSchema);