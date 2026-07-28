const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "JSS 1", "Primary 4"
    section: { type: String, enum: ['primary', 'secondary'], required: true },
    arm: { type: String, trim: true, default: null }, // e.g. "A", "B" (stream/arm)
    classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    capacity: { type: Number, default: 40 },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  },
  { timestamps: true }
);

classSchema.index({ name: 1, arm: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);
