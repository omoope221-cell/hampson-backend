const crypto = require('crypto');

// 12-char hex secret — used for admin-issued staff/parent/student
// login passwords. Shown once to the Super Admin, never stored in plain text.
function randomTempPassword() {
  return crypto.randomBytes(6).toString('hex');
}

module.exports = { randomTempPassword };