const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: 'General' },
    displayOrder: { type: Number, default: 0 },
    status: { type: String, enum: ['published', 'draft'], default: 'published' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

faqSchema.index({ status: 1, category: 1, displayOrder: 1 });

module.exports = mongoose.model('Faq', faqSchema);
