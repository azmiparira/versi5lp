// api/track-order.js
// GET /api/track-order?phone=xxx

const { findOrdersByPhone, deriveShippingStatus } = require('./lib/sheets');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { phone } = req.query;
  const clean = String(phone || '').replace(/\D/g, '');
  if (clean.length < 9) {
    return res.status(400).json({ success: false, message: 'Nomor HP tidak valid' });
  }

  try {
    const rows = await findOrdersByPhone(clean);
    const orders = rows.map((r) => ({
      orderId: r.get('order_id'),
      createdAt: r.get('created_at'),
      productName: r.get('product_name'),
      qty: r.get('qty'),
      totalPrice: r.get('total_price'),
      paymentType: r.get('payment_type'),
      paymentChannel: r.get('payment_channel'),
      paymentStatus: r.get('payment_status'),
      cnoteNo: r.get('cnote_no') !== '-' ? r.get('cnote_no') : null,
      shippingStatus: deriveShippingStatus(r),
    }));

    res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error('track-order error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};