const jwt = require('jsonwebtoken');

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      accountType: user.accountType,
      staffRole: user.staffRole || null,
      permissions: user.permissions || [],
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

// How the refresh token is stored client-side (httpOnly cookie).
function refreshCookieOptions() {
  const days = 30;

  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: days * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshCookieOptions,
};