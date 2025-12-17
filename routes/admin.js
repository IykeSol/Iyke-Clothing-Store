const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Product = require('../models/Product');
const Order = require('../models/Order');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/roles');
const logger = require('../utils/logger');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('☁️ Cloudinary configured:', process.env.CLOUDINARY_CLOUD_NAME);

// Configure Multer + Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecommerce-products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto' }],
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// All admin routes protected
router.use(auth, requireRole('admin'));

// ========== PRODUCTS ==========

// Create product with image upload
router.post('/products', upload.array('images', 5), async (req, res, next) => {
  try {
    console.log('📦 Creating product:', req.body.name);
    
    const { name, slug, description, price, currency, sizes, stock, category } = req.body;

    // Get uploaded image URLs from Cloudinary
    const imageUrls = req.files ? req.files.map((file) => file.path) : [];
    console.log('🖼️ Images uploaded to Cloudinary:', imageUrls.length);

    const sizesArray = typeof sizes === 'string' 
      ? sizes.split(',').map(s => s.trim()).filter(Boolean)
      : sizes;

    const product = await Product.create({
      name,
      slug: slug.toLowerCase(),
      description,
      price: parseInt(price),
      currency: currency || 'NGN',
      images: imageUrls,
      sizes: sizesArray,
      stock: parseInt(stock),
      category,
      available: parseInt(stock) > 0,
    });

    console.log('✅ Product created:', product._id);
    logger.adminAction(req.user.userId, 'CREATE_PRODUCT', { productId: product._id });
    
    res.status(201).json({ product });
  } catch (err) {
    console.error('❌ Create product error:', err);
    next(err);
  }
});

// Get all products (admin view)
router.get('/products', async (req, res, next) => {
  try {
    console.log('📋 Fetching all products (admin)');
    const products = await Product.find({}).sort({ createdAt: -1 });
    console.log('✅ Found products:', products.length);
    res.json({ products });
  } catch (err) {
    console.error('❌ Get products error:', err);
    next(err);
  }
});

// Update product
router.put('/products/:id', upload.array('images', 5), async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.slug) {
      updates.slug = updates.slug.toLowerCase();
    }
    if (updates.sizes && typeof updates.sizes === 'string') {
      updates.sizes = updates.sizes.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (updates.price) {
      updates.price = parseInt(updates.price);
    }
    if (updates.stock) {
      updates.stock = parseInt(updates.stock);
    }

    if (req.files && req.files.length > 0) {
      const newImageUrls = req.files.map((file) => file.path);
      const product = await Product.findById(req.params.id);
      updates.images = [...(product.images || []), ...newImageUrls];
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    logger.adminAction(req.user.userId, 'UPDATE_PRODUCT', { productId: product._id });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// Delete product
router.delete('/products/:id', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    logger.adminAction(req.user.userId, 'DELETE_PRODUCT', { productId: product._id });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
});

// Toggle availability
router.patch('/products/:id/availability', async (req, res, next) => {
  try {
    const { available } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { available: !!available },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    logger.adminAction(req.user.userId, 'SET_AVAILABILITY', {
      productId: product._id,
      available: product.available,
    });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// ========== ORDERS ==========

// Get all orders (admin only)
router.get('/orders', async (req, res, next) => {
  try {
    console.log('📋 Fetching all orders (admin)');
    const orders = await Order.find()
      .populate('user', 'email name')
      .populate('items.productId', 'name images')
      .sort({ createdAt: -1 });
    
    console.log('✅ Found orders:', orders.length);
    res.json({ orders });
  } catch (err) {
    console.error('❌ Get orders error:', err);
    next(err);
  }
});

// Update order payment status (admin only)
router.patch('/orders/:orderId/payment', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus } = req.body;
    
    console.log(`💰 Updating payment status for order ${orderId} to ${paymentStatus}`);
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    order.paymentStatus = paymentStatus;
    
    if (paymentStatus === 'paid') {
      order.status = 'processing';
      
      // Reduce stock only if not already reduced
      if (order.paymentStatus !== 'paid') {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: -item.quantity },
          });
        }
        console.log('📦 Stock reduced for order items');
      }
    }
    
    await order.save();
    
    console.log('✅ Payment status updated');
    logger.adminAction(req.user.userId, 'CONFIRM_PAYMENT', { orderId: order._id });
    
    res.json({ message: 'Payment status updated', order });
  } catch (err) {
    console.error('❌ Update payment status error:', err);
    next(err);
  }
});

// Update order status (admin only)
router.patch('/orders/:orderId/status', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    console.log(`📦 Updating order ${orderId} status to ${status}`);
    
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    console.log('✅ Order status updated');
    logger.adminAction(req.user.userId, 'UPDATE_ORDER_STATUS', { 
      orderId: order._id, 
      status 
    });
    
    res.json({ message: 'Order status updated', order });
  } catch (err) {
    console.error('❌ Update order status error:', err);
    next(err);
  }
});

module.exports = router;
