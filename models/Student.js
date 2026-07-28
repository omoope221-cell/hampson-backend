const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admissionNumber: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female'] },
    section: { type: String, enum: ['primary', 'secondary'], required: true },
    department: { type: String, trim: true, default: '' }, // e.g. Science/Arts/Commercial — SSS only, optional for JSS
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    passportPhoto: { type: String, default: null },
    address: { type: String, trim: true },

    parents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Parent' }],

    admissionDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'graduated', 'suspended', 'withdrawn'],
      default: 'active',
    },

    bloodGroup: { type: String, trim: true },
    genotype: { type: String, trim: true },
    allergies: { type: String, trim: true },

    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
  },
  { timestamps: true }
);

studentSchema.index({ firstName: 'text', lastName: 'text', admissionNumber: 'text' });
studentSchema.virtual('fullName').get(function () {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
});
studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);
