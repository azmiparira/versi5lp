// ============================================================
// api/lib/sheets.js
// Database via Google Sheets. Tab WAJIB bernama: Orders
// ============================================================

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const ORDER_HEADERS = [
  'order_id',
  'created_at',
  'customer_name',
  'customer_phone',
  'full_address',
  'destination_address_id',
  'product_name',
  'qty',
  'price_per_pcs',
  'discount_percent',
  'total_price',
  'payment_type',
  'payment_channel',
  'courier_choice',
  'courier_mengantar',
  'payment_status',
  'cashi_order_id',
  'cashi_checkout_url',
  'mengantar_order_id',
  'cnote_no',
  'sudah_dikirim',
  'sudah_diterima',
  'notes',
];

function getDoc() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!email || !key || !sheetId) {
    throw new Error('Google Sheets belum dikonfigurasi. Cek GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SHEET_ID.');
  }
  const jwt = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return new GoogleSpreadsheet(sheetId, jwt);
}

async function getOrdersSheet() {
  const doc = getDoc();
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle['Orders'];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: 'Orders',
      headerValues: ORDER_HEADERS,
      gridProperties: { rowCount: 1000, columnCount: ORDER_HEADERS.length + 4 },
    });
  } else {
    await sheet.loadHeaderRow().catch(async () => sheet.setHeaderRow(ORDER_HEADERS));
  }
  return sheet;
}

async function createOrderRow(orderData) {
  const sheet = await getOrdersSheet();
  return sheet.addRow(orderData);
}

async function findOrderByOrderId(orderId) {
  const sheet = await getOrdersSheet();
  const rows = await sheet.getRows();
  return rows.find((r) => r.get('order_id') === orderId) || null;
}

async function findOrdersByPhone(phone) {
  const sheet = await getOrdersSheet();
  const rows = await sheet.getRows();
  const clean = String(phone).replace(/\D/g, '');
  return rows
    .filter((r) => r.get('customer_phone') === clean)
    .sort((a, b) => new Date(b.get('created_at')) - new Date(a.get('created_at')));
}

async function updateOrderRow(row, updates) {
  Object.entries(updates).forEach(([k, v]) => row.set(k, v));
  await row.save();
  return row;
}

function deriveShippingStatus(row) {
  const paymentType = row.get('payment_type');
  const paymentStatus = row.get('payment_status');

  if (paymentType === 'NONCOD' && paymentStatus !== 'PAID') {
    return 'MENUNGGU_PEMBAYARAN';
  }

  const dikirim = String(row.get('sudah_dikirim')).toUpperCase() === 'TRUE';
  const diterima = String(row.get('sudah_diterima')).toUpperCase() === 'TRUE';
  if (diterima) return 'DITERIMA';
  if (dikirim) return 'DIKIRIM';
  return 'DIKEMAS';
}

module.exports = {
  ORDER_HEADERS,
  getOrdersSheet,
  createOrderRow,
  findOrderByOrderId,
  findOrdersByPhone,
  updateOrderRow,
  deriveShippingStatus,
};