require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { globalLimiter } = require('./middlewares/rateLimiters');
const sanitize = require('./middlewares/sanitize');
const errorHandler = require('./middlewares/errorHandler');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const ordersRoutes = require('./routes/orders');

const app = express();

// Connect DB
console.log('🔌 Attempting to connect to MongoDB...');
connectDB()
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
  })
  .catch((err) => {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  });

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https:", "http:"],
      },
    },
  })
);

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4000',
  })
);

// Body size limits
app.use((req, res, next) => {
  const length = Number(req.headers['content-length'] || 0);
  if (length > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'Payload too large' });
  }
  next();
});
app.use(express.json({ limit: '10mb' }));

// Global rate limiter and sanitization
app.use(globalLimiter);
app.use(sanitize);

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', ordersRoutes);  // Moved here with other routes

// 404 fallback for API
app.use('/api', (req, res) => {
  console.log('⚠️ 404 - Route not found:', req.path);
  res.status(404).json({ error: 'Not found' });
});

// Central error handler
app.use(errorHandler);

// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
});
