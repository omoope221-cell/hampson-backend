const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

// Fire-and-forget audit trail write. Never throws — a logging failure
// must never break the actual request.
async function recordAudit({
  actor, attemptedEmail, accountType, action, success = true, reason,
  targetModel, targetId, details, ip, userAgent,
}) {
  try {
    await AuditLog.create({
      actor, attemptedEmail, accountType, action, success, reason,
      targetModel, targetId, details, ip, userAgent,
    });
  } catch (err) {
    logger.error(`Audit log write failed: ${err.message}`);
  }
}

module.exports = recordAudit;
