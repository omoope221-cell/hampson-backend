const mongoose = require('mongoose');

// Powers the public Leadership page (Proprietor's message, Principal's
// message, management team) and the Super Admin "Leadership Management"
// module. `category` distinguishes a featured message from a regular
// profile card so the public page can render them differently.
const leadershipSchema = new mongoose.Schema(
  {
    photo: { type: String, default: null },
    photoPublicId: { type: String, default: null },
    fullName: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true }, // e.g. "Proprietor", "Principal", "Board Member"
    category: {
      type: String,
      enum: ['proprietor', 'principal', 'management'],
      default: 'management',
    },
    message: { type: String, trim: true }, // Proprietor's / Principal's message
    biography: { type: String, trim: true }, // short profile description for management team
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    displayOrder: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

leadershipSchema.index({ status: 1, category: 1, displayOrder: 1 });

module.exports = mongoose.model('Leadership', leadershipSchema);
