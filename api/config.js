// api/config.js
// GET /api/config

const { PAYMENT_CHANNELS } = require('./lib/cashi');
const { ALLOWED_COURIERS } = require('./lib/mengantar');
const { DISCOUNT_TIERS, MAX_QTY, FREE_SHIPPING_DISPLAY_VALUE } = require('./lib/pricing');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const paymentChannels = Object.entries(PAYMENT_CHANNELS)
      .filter(([key]) => key !== 'COD')
      .map(([key, v]) => ({
        key,
        kode_channel: v.kode_channel,
        label: v.label,
        group: v.group,
      }));

    const couriers = Object.keys(ALLOWED_COURIERS).map((key) => ({ key, label: key }));

    res.status(200).json({
      success: true,
      data: {
        storeName: process.env.STORE_NAME || 'Spray Tidur',
        productName: process.env.PRODUCT_NAME || 'Spray Tidur',
        productPrice: Number(process.env.PRODUCT_PRICE || 209000),
        productDescription: process.env.PRODUCT_DESCRIPTION || 'Spray tidur - BPOM HALAL, aman tidak berbahaya',
        waNumber: process.env.STORE_WA_NUMBER || '',
        waAdminNumber: process.env.STORE_WA_ADMIN_NUMBER || process.env.STORE_WA_NUMBER || '',
        paymentChannels,
        couriers,
        discountTiers: DISCOUNT_TIERS,
        maxQty: MAX_QTY,
        freeShippingDisplayValue: FREE_SHIPPING_DISPLAY_VALUE,
      },
    });
  } catch (err) {
    console.error('config error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};