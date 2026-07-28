const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    section: { type: String, enum: ['primary', 'secondary', 'both'], default: 'both' },
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subject', subjectSchema);
