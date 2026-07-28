// Minimum bar for any password a human types in themselves (admin-issued
// temp passwords are random crypto bytes and already exceed this).
// At least 8 characters, one letter, and one number.
const STRONG_ENOUGH = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function passwordStrengthError(password) {
  if (typeof password !== 'string' || !STRONG_ENOUGH.test(password)) {
    return 'Password must be at least 8 characters and include at least one letter and one number.';
  }
  return null;
}

module.exports = { passwordStrengthError };
