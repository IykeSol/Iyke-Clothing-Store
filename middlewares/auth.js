const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select(
      '_id role tokenVersion email'
    );
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (payload.tv !== user.tokenVersion) {
      return res.status(401).json({ error: 'Token expired' });
    }
    req.user = { 
      id: user._id.toString(), 
      userId: user._id.toString(),
      role: user.role,
      email: user.email
    };
    console.log('✅ Auth middleware - User:', req.user.userId);
    next();
  } catch (err) {
    console.error('❌ Auth middleware error:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};
