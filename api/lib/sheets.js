// ============================================================
// api/lib/sheets.js
// Database via Google Sheets. Tab WAJIB bernama: Orders
// Dilengkapi cache & retry
// ============================================================

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// ===== KOLOM (tambahkan 'ongkir' dan 'voucher_dipakai') =====
const ORDER_HEADERS = [
  'order_id',
  'created_at',
  'customer_name',
  'customer_phone',      // disimpan sebagai STRING (bisa mulai 0)
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
  'ongkir',              // <-- BARU
  'voucher_dipakai',     // <-- BARU
  'notes',
];

let sheetCache = null;
let sheetCacheTime = 0;
const CACHE_TTL = 60000; // 1 menit

function getDoc() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!email || !key || !sheetId) {
    throw new Error('Google Sheets belum dikonfigurasi.');
  }
  const jwt = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return new GoogleSpreadsheet(sheetId, jwt);
}

async function getOrdersSheet(retryCount = 0) {
  try {
    const now = Date.now();
    if (sheetCache && (now - sheetCacheTime < CACHE_TTL)) {
      console.log('📦 Menggunakan cache sheet');
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
      // Cek apakah header perlu diupdate (tambahan kolom)
      await sheet.loadHeaderRow().catch(async () => sheet.setHeaderRow(ORDER_HEADERS));
    }

    sheetCache = sheet;
    sheetCacheTime = now;
    return sheet;
  } catch (err) {
    if (err.message && (err.message.includes('429') || err.message.includes('Quota'))) {
      if (retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 2000;
        console.log(`⏳ Retry ${retryCount+1}/5 in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return getOrdersSheet(retryCount + 1);
      }
      throw new Error('Google Sheets quota exceeded. Silakan coba lagi nanti.');
    }
    throw err;
  }
}

function invalidateSheetCache() {
  sheetCache = null;
  sheetCacheTime = 0;
  console.log('🔄 Cache invalidated');
}

async function createOrderRow(orderData) {
  const sheet = await getOrdersSheet();
  const result = await sheet.addRow(orderData);
  invalidateSheetCache();
  return result;
}

async function findOrderByOrderId(orderId) {
  const sheet = await getOrdersSheet();
  const rows = await sheet.getRows();
  return rows.find((r) => r.get('order_id') === orderId) || null;
}

async function findOrdersByPhone(phone) {
  const sheet = await getOrdersSheet();
  const rows = await sheet.getRows();
  // Cari dengan pencocokan yang flexible (bisa dengan atau tanpa leading 0)
  const cleanPhone = String(phone).replace(/\D/g, '');
  return rows
    .filter((r) => {
      const rowPhone = String(r.get('customer_phone') || '').replace(/\D/g, '');
      return rowPhone === cleanPhone;
    })
    .sort((a, b) => new Date(b.get('created_at')) - new Date(a.get('created_at')));
}

async function updateOrderRow(row, updates) {
  Object.entries(updates).forEach(([k, v]) => row.set(k, v));
  await row.save();
  invalidateSheetCache();
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
  invalidateSheetCache,
};
