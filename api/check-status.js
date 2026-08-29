// api/check-status.js
// GET /api/check-status?orderId=xxx

const { findOrderByOrderId, deriveShippingStatus } = require('./lib/sheets');
const { checkStatus: checkCashiStatus } = require('./lib/cashi');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { orderId } = req.query;
  if (!orderId) {
    return res.status(400).json({ success: false, message: 'orderId wajib diisi' });
  }

  try {
    const row = await findOrderByOrderId(orderId);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    }

    let paymentStatus = row.get('payment_status');

    // Cek status Cashi jika masih PENDING
    if (paymentStatus === 'PENDING' && row.get('cashi_order_id') && row.get('cashi_order_id') !== '-') {
      try {
        const cashiResult = await checkCashiStatus(row.get('cashi_order_id'));
        if (cashiResult.status === 'SETTLED') {
          paymentStatus = 'PAID_PENDING_SYNC';
        }
      } catch (e) {
        console.warn('Gagal cek status ke Cashi:', e.message);
      }
    }

    res.status(200).json({
      success: true,
      orderId,
      paymentStatus,
      paymentType: row.get('payment_type'),
      paymentChannel: row.get('payment_channel'),
      shippingStatus: deriveShippingStatus(row),
      cnoteNo: row.get('cnote_no') !== '-' ? row.get('cnote_no') : null,
      productName: row.get('product_name'),
      qty: row.get('qty'),
      totalPrice: row.get('total_price'),
      customerName: row.get('customer_name'),
      customerPhone: row.get('customer_phone'),
      fullAddress: row.get('full_address'),
      createdAt: row.get('created_at'),
    });
  } catch (err) {
    console.error('check-status error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
