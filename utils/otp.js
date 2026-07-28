const crypto = require('crypto');

// 6-digit numeric OTP, hashed with SHA-256 before it ever touches the
// database — same "never store the secret in plain text" rule as
// passwords, just a cheaper hash since OTPs are short-lived and rate-limited.
function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function compareOtp(candidate, hash) {
  if (!candidate || !hash) return false;
  return hashOtp(candidate) === hash;
}

module.exports = { generateOtp, hashOtp, compareOtp };
