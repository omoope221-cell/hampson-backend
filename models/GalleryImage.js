const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    imagePublicId: { type: String, default: null },
    caption: { type: String, trim: true },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    featured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

galleryImageSchema.index({ category: 1, displayOrder: 1 });

module.exports = mongoose.model('GalleryImage', galleryImageSchema);
