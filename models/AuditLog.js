const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    // Not required: failed-login attempts have no resolvable user, but
    // must still be logged (attemptedEmail + accountType capture who it
    // was aimed at).
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    attemptedEmail: { type: String },
    accountType: { type: String },
    action: { type: String, required: true }, // e.g. "user.suspend", "auth.login_failed"
    success: { type: Boolean, default: true },
    reason: { type: String },
    targetModel: { type: String },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
