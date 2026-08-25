// ============================================================
// api/lib/sheets.js
// Database via Google Sheets. Tab WAJIB bernama: Orders
// Dilengkapi dengan retry mechanism untuk menghindari rate limit (429)
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

// ===== CACHE untuk mengurangi request ke Google Sheets =====
let sheetCache = null;
let sheetCacheTime = 0;
const CACHE_TTL = 60000; // 1 menit (60 detik) — cukup untuk mengurangi request berlebih

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

// ===== GET ORDERS SHEET DENGAN CACHE & RETRY =====
async function getOrdersSheet(retryCount = 0) {
  try {
    // Cek cache
    const now = Date.now();
    if (sheetCache && (now - sheetCacheTime < CACHE_TTL)) {
      console.log('📦 Menggunakan cache sheet (1 menit)');
      return sheetCache;
    }

    console.log('📄 Memuat sheet dari Google...');
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

    // Simpan ke cache
    sheetCache = sheet;
    sheetCacheTime = now;
    
    return sheet;
  } catch (err) {
    // Jika error 429 (quota exceeded), retry dengan exponential backoff
    if (err.message && (err.message.includes('429') || err.message.includes('Quota'))) {
      if (retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s, 16s, 32s
        console.log(`⏳ Rate limit (429) hit! Retry in ${delay/1000}s... (attempt ${retryCount + 1}/5)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return getOrdersSheet(retryCount + 1);
      } else {
        console.error('❌ Quota exceeded after 5 retries.');
        throw new Error('Google Sheets quota exceeded. Silakan coba lagi nanti.');
      }
    }
    throw err;
  }
}

// ===== INVALIDATE CACHE (dipanggil setelah write) =====
function invalidateSheetCache() {
  sheetCache = null;
  sheetCacheTime = 0;
  console.log('🔄 Cache sheet di-invalidate (setelah write)');
}

// ===== CREATE ORDER ROW =====
async function createOrderRow(orderData) {
  const sheet = await getOrdersSheet();
  const result = await sheet.addRow(orderData);
  // Invalidate cache setelah write
  invalidateSheetCache();
  return result;
}

// ===== FIND ORDER BY ORDER ID (dengan cache) =====
async function findOrderByOrderId(orderId) {
  const sheet = await getOrdersSheet();
  const rows = await sheet.getRows();
  return rows.find((r) => r.get('order_id') === orderId) || null;
}

// ===== FIND ORDERS BY PHONE =====
async function findOrdersByPhone(phone) {
  const sheet = await getOrdersSheet();
  const rows = await sheet.getRows();
  const clean = String(phone).replace(/\D/g, '');
  return rows
    .filter((r) => r.get('customer_phone') === clean)
    .sort((a, b) => new Date(b.get('created_at')) - new Date(a.get('created_at')));
}

// ===== UPDATE ORDER ROW =====
async function updateOrderRow(row, updates) {
  Object.entries(updates).forEach(([k, v]) => row.set(k, v));
  await row.save();
  // Invalidate cache setelah update
  invalidateSheetCache();
  return row;
}

// ===== DERIVE SHIPPING STATUS =====
function deriveShippingStatus(row) {
  const paymentType = row.get('payment_type');
  const paymentStatus = row.get('payment_status');

  // Non-COD yang belum lunas
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
  invalidateSheetCache,
};
