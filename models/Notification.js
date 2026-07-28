const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
    type: {
      type: String,
      enum: ['info', 'result', 'fee', 'attendance', 'assignment', 'message', 'system'],
      default: 'info',
    },
    link: { type: String, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
