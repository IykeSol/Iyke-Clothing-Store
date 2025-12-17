const axios = require('axios');
const Transaction = require('../models/Transaction');

const PAYSTACK_BASE = 'https://api.paystack.co';

function getSecretKey() {
  // Only environment variables decide test vs live
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('Paystack secret key not configured');
  return key;
}

// Initialize transaction
async function initializePaystackTransaction({ email, amount, reference, callbackUrl }) {
  const res = await axios.post(
    `${PAYSTACK_BASE}/transaction/initialize`,
    {
      email,
      amount, // in kobo
      reference,
      callback_url: callbackUrl,
    },
    {
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );
  return res.data;
}

// Verify and update local transaction securely
async function verifyPaystackReference(reference, userId) {
  // Reject unknown or duplicate references
  const tx = await Transaction.findOne({ reference, user: userId });
  if (!tx) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }
  if (tx.status === 'success') {
    const err = new Error('Transaction already processed');
    err.statusCode = 409;
    throw err;
  }

  const res = await axios.get(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
    },
    timeout: 10000,
  });

  const data = res.data;
  if (!data || data.status !== true) {
    const err = new Error('Payment verification failed');
    err.statusCode = 400;
    throw err;
  }

  const paystackTx = data.data;
  // Validate important fields
  if (paystackTx.amount !== tx.amount || paystackTx.currency !== tx.currency) {
    const err = new Error('Payment amount or currency mismatch');
    err.statusCode = 400;
    throw err;
  }
  if (paystackTx.status !== 'success') {
    tx.status = 'failed';
    tx.rawProviderResponse = { status: paystackTx.status, paid_at: paystackTx.paid_at };
    await tx.save();
    const err = new Error('Payment not successful');
    err.statusCode = 400;
    throw err;
  }

  tx.status = 'success';
  tx.rawProviderResponse = {
    status: paystackTx.status,
    paid_at: paystackTx.paid_at,
    channel: paystackTx.channel,
    reference: paystackTx.reference,
  };
  await tx.save();

  return tx;
}

module.exports = {
  initializePaystackTransaction,
  verifyPaystackReference,
};
