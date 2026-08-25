// api/cashi-webhook.js
// POST /api/cashi-webhook

const { verifyWebhookSignature } = require('./lib/cashi');
const { findOrderByOrderId, updateOrderRow } = require('./lib/sheets');
const { createOrder: createMengantarOrder } = require('./lib/mengantar');

const PICKUP_ADDRESS_ID = process.env.MENGANTAR_PICKUP_ADDRESS_ID;
const PRODUCT_NAME = process.env.PRODUCT_NAME || 'Spray Tidur';
const PRODUCT_WEIGHT_GRAM = Number(process.env.PRODUCT_WEIGHT_GRAM || 150);

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-gateway-signature'];

  // Verifikasi signature
  let isValid = false;
  try {
    isValid = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    console.error('Webhook signature check error:', err);
    return res.status(500).send('Signature check error');
  }

  if (!isValid) {
    console.warn('Webhook signature TIDAK VALID.');
    return res.status(401).send('Invalid signature');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  const { event, data } = payload || {};

  // Skip test order
  if (data && String(data.order_id || '').startsWith('TEST-')) {
    return res.status(200).send('Test OK');
  }

  if (event !== 'PAYMENT_SETTLED') {
    return res.status(200).send('Event ignored');
  }

  if (data.status !== 'SETTLED') {
    return res.status(200).send('OK (bukan SETTLED)');
  }

  try {
    const row = await findOrderByOrderId(data.order_id);
    if (!row) {
      console.error('Order tidak ditemukan untuk webhook:', data.order_id);
      return res.status(200).send('Order not found, ignored');
    }

    if (row.get('payment_status') === 'PAID') {
      return res.status(200).send('Already processed');
    }

    // Update payment status
    await updateOrderRow(row, { payment_status: 'PAID' });

    // Buat order di Mengantar
    const mengantarResult = await createMengantarOrder({
      courierApiValue: row.get('courier_mengantar'),
      pickupAddressId: PICKUP_ADDRESS_ID,
      customerName: row.get('customer_name'),
      customerPhone: row.get('customer_phone'),
      customerAddress: row.get('full_address'),
      customerAddressDataId: row.get('destination_address_id'),
      weightKg: (Number(row.get('qty')) * PRODUCT_WEIGHT_GRAM) / 1000,
      quantity: Number(row.get('qty')),
      parcelContent: PRODUCT_NAME,
      goodsValue: Number(row.get('total_price')),
    });

    const item = (mengantarResult.data && mengantarResult.data[0]) || {};

    await updateOrderRow(row, {
      mengantar_order_id: item.ORDER_ID || '-',
      cnote_no: item.cnote_no || '-',
      notes: item.error || (item.cnote_no ? '' : 'Cek manual, mungkin saldo Mengantar kurang'),
    });

    return res.status(200).send('OK');
  } catch (err) {
    console.error('cashi-webhook processing error:', err);
    return res.status(200).send('Processed with error, check logs');
  }
};