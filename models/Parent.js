const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    relationship: { type: String, enum: ['father', 'mother', 'guardian'], default: 'guardian' },
    occupation: { type: String, trim: true },
    address: { type: String, trim: true },
    alternatePhone: { type: String, trim: true },

    // One parent -> many children, possibly spanning Primary and Secondary
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  },
  { timestamps: true }
);

parentSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});
parentSchema.set('toJSON', { virtuals: true });
parentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Parent', parentSchema);
