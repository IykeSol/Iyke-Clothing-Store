const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Map "sub" to "userId" for backward compatibility
    req.user = {
      userId: decoded.sub || decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    
    console.log('✅ Token verified. User:', req.user.userId);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('❌ Token expired');
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('❌ JWT verification error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authenticate;
