// ============================================================
// api/lib/cashi.js
// ============================================================

const crypto = require('crypto');

const BASE_URL = process.env.CASHI_BASE_URL || 'https://cashi.id';
const API_KEY = process.env.CASHI_API_KEY;
const WEBHOOK_SECRET = process.env.CASHI_WEBHOOK_SECRET;

// Daftar channel pembayaran yang didukung Cashi
// !!! QRIS harus pakai kode 'QRIS_CUSTOM' (bukan 'Ya') !!!
const PAYMENT_CHANNELS = {
  COD: { kode_channel: null, label: 'COD', group: 'COD', min: 0, max: 0 },
  QRIS: { kode_channel: 'QRIS_CUSTOM', label: 'QRIS', group: 'QRIS', min: 2000, max: 10000000 },
  MANDIRI: { kode_channel: 'MANDIRI', label: 'Mandiri VA', group: 'VA', min: 10000, max: 50000000 },
  BCA: { kode_channel: 'BCA', label: 'BCA VA', group: 'VA', min: 10000, max: 50000000 },
  BNI: { kode_channel: 'BNI', label: 'BNI VA', group: 'VA', min: 10000, max: 50000000 },
  BRI: { kode_channel: 'BRI', label: 'BRI VA', group: 'VA', min: 10000, max: 50000000 },
  BSI: { kode_channel: 'BSI', label: 'BSI VA', group: 'VA', min: 10000, max: 50000000 },
  ALFAMART: { kode_channel: 'ALFAMART', label: 'Alfamart', group: 'RETAIL', min: 15000, max: 2500000 },
  INDOMARET: { kode_channel: 'INDOMARET', label: 'Indomaret', group: 'RETAIL', min: 15000, max: 2500000 },
};

async function cashiFetch(path, options = {}) {
  if (!API_KEY) throw new Error('CASHI_API_KEY belum diset.');
  const url = `${BASE_URL}${path}`;
  console.log(`🌐 Cashi request: ${options.method || 'GET'} ${url}`);
  if (options.body) console.log('📦 Payload:', options.body);

  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  console.log('📥 Cashi response status:', res.status);
  console.log('📥 Cashi response data:', data);

  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Cashi API error (${res.status})`);
    err.response = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

async function createOrder({ amount, orderId, kodeChannel }) {
  // Pastikan kodeChannel bukan null/undefined untuk NON-COD
  if (!kodeChannel) {
    throw new Error('kodeChannel wajib diisi untuk pembayaran NON-COD');
  }
  return cashiFetch('/api/create-order', {
    method: 'POST',
    body: JSON.stringify({ amount: Math.round(amount), order_id: orderId, kode_channel: kodeChannel }),
  });
}

async function checkStatus(orderId) {
  return cashiFetch(`/api/check-status/${encodeURIComponent(orderId)}`, { method: 'GET' });
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!WEBHOOK_SECRET) throw new Error('CASHI_WEBHOOK_SECRET belum diset.');
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { PAYMENT_CHANNELS, createOrder, checkStatus, verifyWebhookSignature };
