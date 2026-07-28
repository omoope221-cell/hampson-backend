const mongoose = require('mongoose');

// A per-student, itemized fee bill — distinct from the class-wide Fee
// "payment plan" model. A Class Teacher builds one of these directly for
// one student (multiple named line items + an amount each), and it's
// what the parent/student see as "My Child's Fees" / "My Fees".
const feeItemSchema = new mongoose.Schema(
  {
    feeName: { type: String, required: true, trim: true }, // e.g. "School Fees", "PTA Levy"
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const studentFeeBillSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    term: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], required: true },
    items: { type: [feeItemSchema], default: [] },
    totalAmount: { type: Number, default: 0 }, // sum of items — recomputed server-side, never trust client math
    remarks: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    amountPaid: { type: Number, default: 0 }, // how much of totalAmount has been paid, drives status
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One bill per student per session/term — teachers edit the existing
// bill (add/remove/edit rows) rather than creating duplicates.
studentFeeBillSchema.index({ student: 1, session: 1, term: 1 }, { unique: true });

module.exports = mongoose.model('StudentFeeBill', studentFeeBillSchema);
