const jwt = require('jsonwebtoken');

function signAccessToken(user) {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
    tv: user.tokenVersion,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
    jwtid: `${user._id}-${Date.now()}`,
  });
}

module.exports = {
  signAccessToken,
};
