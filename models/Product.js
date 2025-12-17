const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 }, // store in lowest currency unit (e.g. kobo)
    currency: { type: String, default: 'NGN' },
    images: [{ type: String }], // URLs
    sizes: [{ type: String }],   // e.g. ['S', 'M', 'L', 'XL']
    available: { type: Boolean, default: true, index: true },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    category: { type: String, trim: true },
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
