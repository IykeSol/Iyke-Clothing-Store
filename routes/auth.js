const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signAccessToken } = require('../utils/jwt');
const { authLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

// Register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    console.log('📝 Register attempt:', req.body.email);
    
    const { email, password, name, phone } = req.body;
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log('❌ Email already registered:', email);
      return res.status(409).json({ error: 'Email already registered' });
    }

    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    console.log('💾 Creating user...');
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      phone,
    });

    console.log('✅ User created:', user._id);
    const token = signAccessToken(user);
    
    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, role: user.role, name: user.name },
    });
  } catch (err) {
    console.error('❌ Register error:', err);
    next(err);
  }
});

// Login (user)
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    console.log('🔑 Login attempt:', req.body.email);
    
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('✅ User found:', user._id, 'Role:', user.role);
    
    const ok = await user.comparePassword(password);
    if (!ok) {
      console.log('❌ Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = signAccessToken(user);
    console.log('✅ Login successful');
    
    res.json({
      token,
      user: { id: user._id, email: user.email, role: user.role, name: user.name },
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    next(err);
  }
});

// Admin login (isolated)
router.post('/admin/login', authLimiter, async (req, res, next) => {
  try {
    console.log('🔐 Admin login attempt:', req.body.email);
    
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' });
    
    if (!user) {
      console.log('❌ Admin not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const ok = await user.comparePassword(password);
    if (!ok) {
      console.log('❌ Invalid admin password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = signAccessToken(user);
    console.log('✅ Admin login successful');
    
    res.json({
      token,
      user: { id: user._id, email: user.email, role: user.role, name: user.name },
    });
  } catch (err) {
    console.error('❌ Admin login error:', err);
    next(err);
  }
});

module.exports = router;
