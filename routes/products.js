const express = require('express');
const Product = require('../models/Product');

const router = express.Router();

// Public: list products (available only)
router.get('/', async (req, res, next) => {
  try {
    const products = await Product.find({ available: true }).select(
      'name slug price currency images sizes available stock'
    );
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// Public: get single product by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug.toLowerCase(),
      available: true,
    }).select('name slug description price currency images sizes stock');
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
