const mongoose = require('mongoose');

// A single model backs both the public "News" and "Events" pages — they
// share almost every field, and keeping them together means one simple
// admin screen (with a News/Event toggle) instead of two nearly-identical
// ones. `type` is what the public dropdown (News vs Events) filters on.
const newsEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['news', 'event'], required: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, trim: true, default: '' }, // short teaser shown in the list
    content: { type: String, required: true, trim: true }, // full body
    image: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },

    // Event-only fields — ignored for type: 'news'
    eventDate: { type: Date, default: null },
    eventTime: { type: String, default: '' },
    location: { type: String, default: '' },

    featured: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

newsEventSchema.index({ type: 1, status: 1, publishedAt: -1 });

module.exports = mongoose.model('NewsEvent', newsEventSchema);
