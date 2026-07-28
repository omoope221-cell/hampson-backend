const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema(
  {
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    term: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], required: true },
    feeType: { type: String, required: true, trim: true }, // e.g. "Tuition", "PTA Levy"
    amount: { type: Number, required: true },
    dueDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Fee', feeSchema);
