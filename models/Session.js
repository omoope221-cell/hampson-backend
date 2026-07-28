const mongoose = require('mongoose');

const termSchema = new mongoose.Schema(
  {
    name: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
  },
  { _id: true }
);

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // e.g. "2025/2026"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
    terms: [termSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
