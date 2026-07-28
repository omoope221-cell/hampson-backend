const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    fee: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee', required: true },
    amountPaid: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'bank_transfer', 'card', 'online'], required: true },
    reference: { type: String, trim: true, unique: true, sparse: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
