const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true, // in kobo
      min: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
      index: true,
    },
    provider: {
      type: String,
      enum: ['paystack', 'bank_transfer', 'opay_transfer'],
      required: true,
    },
    meta: {
      type: Object, // only non-sensitive fields (e.g. shipping summary)
    },
    rawProviderResponse: {
      type: Object, // sanitized subset, no card PAN or secrets
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
