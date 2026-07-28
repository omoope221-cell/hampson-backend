const mongoose = require('mongoose');
const { STAFF_ROLES } = require('../config/roles');

const staffSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    staffId: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: { type: String, enum: STAFF_ROLES, required: true },
    department: { type: String, trim: true },
    profilePicture: { type: String, default: null },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female'] },
    address: { type: String, trim: true },
    hireDate: { type: Date, default: Date.now },

    // Teachers: classes & subjects they are assigned to
    assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    assignedSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],

    status: { type: String, enum: ['active', 'suspended', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

staffSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});
staffSchema.set('toJSON', { virtuals: true });
staffSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Staff', staffSchema);
