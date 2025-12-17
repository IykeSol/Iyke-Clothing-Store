const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const authenticate = require('../middlewares/authenticate');
const logger = require('../utils/logger');

const router = express.Router();

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

// Initialize payment
router.post('/init', authenticate, async (req, res, next) => {
  try {
    console.log('💳 Payment initialization request');
    
    const { items, shipping, provider } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    // Calculate total
    let totalAmount = 0;
    const productDetails = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ error: `Product not found: ${item.productId}` });
      }
      if (!product.available) {
        return res.status(400).json({ error: `Product unavailable: ${product.name}` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      const lineTotal = product.price * item.quantity;
      totalAmount += lineTotal;

      productDetails.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        size: item.size,
      });
    }

    console.log(`Total amount: ₦${totalAmount / 100}`);

    // Generate unique reference
    const reference = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create order in database (pending)
    const order = await Order.create({
      user: req.user.userId,
      items: productDetails,
      totalAmount,
      currency: 'NGN',
      shipping,
      paymentProvider: provider,
      paymentStatus: 'pending',
      reference,
    });

    console.log('📦 Order created:', order._id);
    logger.userAction(req.user.userId, 'INITIATE_PAYMENT', { orderId: order._id, amount: totalAmount });

    // Handle different payment providers
    if (provider === 'paystack') {
      if (!paystackSecretKey) {
        return res.status(500).json({ error: 'Paystack not configured' });
      }

      try {
        const paystackRes = await axios.post(
          'https://api.paystack.co/transaction/initialize',
          {
            email: shipping.email || req.user.email,
            amount: totalAmount,
            reference: reference,
            metadata: {
              orderId: order._id.toString(),
              userId: req.user.userId,
              custom_fields: [
                {
                  display_name: "Order ID",
                  variable_name: "order_id",
                  value: order._id.toString()
                }
              ]
            },
          },
          {
            headers: {
              Authorization: `Bearer ${paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('✅ Paystack response:', paystackRes.data.status);

        return res.json({
          provider: 'paystack',
          authorizationUrl: paystackRes.data.data.authorization_url,
          reference: reference,
          orderId: order._id,
        });
      } catch (err) {
        console.error('❌ Paystack error:', err.response?.data || err.message);
        await Order.findByIdAndUpdate(order._id, { paymentStatus: 'failed' });
        return res.status(500).json({ error: 'Payment initialization failed' });
      }
    }

    // Bank transfer or OPay
    const instructions =
      provider === 'bank_transfer'
        ? 'Bank: Palmpay | Account: 8126832604 | Name: Kalu Ikechukwu'
        : 'OPay: 8126832604 | Name: Ikechukwu Kalu';

    res.json({
      provider,
      reference,
      amount: totalAmount,
      instructions,
      orderId: order._id,
    });
  } catch (err) {
    console.error('❌ Payment init error:', err);
    next(err);
  }
});

// Paystack webhook for verification
router.post('/paystack/webhook', async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', paystackSecretKey)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.log('⚠️ Invalid Paystack signature');
      return res.sendStatus(400);
    }

    const event = req.body;
    console.log('🔔 Paystack webhook:', event.event);

    if (event.event === 'charge.success') {
      const { reference, status } = event.data;
      
      const order = await Order.findOne({ reference });
      if (!order) {
        console.log('⚠️ Order not found for reference:', reference);
        return res.sendStatus(404);
      }

      if (status === 'success') {
        order.paymentStatus = 'paid';
        order.status = 'processing';
        await order.save();

        // Reduce stock
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: -item.quantity },
          });
        }

        console.log('✅ Payment confirmed for order:', order._id);
        logger.userAction(order.user, 'PAYMENT_SUCCESS', { orderId: order._id });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.sendStatus(500);
  }
});

// Verify payment manually (for callback)
router.get('/verify/:reference', authenticate, async (req, res, next) => {
  try {
    const { reference } = req.params;
    console.log('🔍 Verifying payment:', reference);

    const order = await Order.findOne({ reference, user: req.user.userId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentProvider === 'paystack') {
      const verifyRes = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: { Authorization: `Bearer ${paystackSecretKey}` },
        }
      );

      const { status, amount } = verifyRes.data.data;

      if (status === 'success' && amount === order.totalAmount) {
        order.paymentStatus = 'paid';
        order.status = 'processing';
        await order.save();

        // Reduce stock
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: -item.quantity },
          });
        }

        console.log('✅ Payment verified successfully');
        logger.userAction(req.user.userId, 'PAYMENT_VERIFIED', { orderId: order._id });

        return res.json({ success: true, order });
      }
    }

    res.json({ success: false, order });
  } catch (err) {
    console.error('❌ Verify error:', err);
    next(err);
  }
});

module.exports = router;
