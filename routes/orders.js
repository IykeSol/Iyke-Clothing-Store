const express = require('express');
const Order = require('../models/Order');
const auth = require('../middlewares/auth');

const router = express.Router();

// Get user's orders
router.get('/my-orders', auth, async (req, res, next) => {
  try {
    console.log('📦 Fetching orders for user:', req.user.userId);
    
    const orders = await Order.find({ user: req.user.userId })
      .populate('items.productId', 'name images')
      .sort({ createdAt: -1 });
    
    console.log('✅ Found orders:', orders.length);
    
    // Map orders to include _id as a string
    const ordersData = orders.map(order => ({
      _id: order._id.toString(),
      orderId: order._id.toString(),
      reference: order.reference,
      user: order.user,
      items: order.items,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentProvider: order.paymentProvider,
      shipping: order.shipping,
      shippingAddress: order.shipping, // For backward compatibility
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));
    
    res.json({ orders: ordersData });
  } catch (err) {
    console.error('❌ Get orders error:', err);
    next(err);
  }
});

module.exports = router;
