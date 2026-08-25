// ============================================================
// api/lib/mengantar.js
// ============================================================

const BASE_URL = process.env.MENGANTAR_BASE_URL || 'https://app.mengantar.com';
const API_KEY = process.env.MENGANTAR_API_KEY;

const ALLOWED_COURIERS = {
  Direkomendasikan: 'JT',
  JNT: 'JT',
  SiCepat: 'SiCepat',
  Sap: 'Sap',
  iDexpress: 'iDexpress',
};

function resolveCourierForApi(courierChoice) {
  const val = ALLOWED_COURIERS[courierChoice];
  if (!val) throw new Error(`Kurir tidak valid: ${courierChoice}`);
  return val;
}

async function mengantarFetch(path, options = {}) {
  if (!API_KEY) throw new Error('MENGANTAR_API_KEY belum diset.');
  const url = `${BASE_URL}/api/public/${API_KEY}${path}`;
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Mengantar API error (${res.status})`);
    err.response = data;
    throw err;
  }
  return data;
}

async function searchAddress(keyword) {
  const data = await mengantarFetch(`/address/search?keyword=${encodeURIComponent(keyword)}`, { method: 'GET' });
  return data.data || [];
}

async function createOrder({
  courierApiValue, pickupAddressId, customerName, customerPhone, customerAddress,
  customerAddressDataId, weightKg, quantity, parcelContent, goodsValue, codAmount,
}) {
  const orderPayload = {
    assignee: '', customerAddress, customerName, customerAddressDataId, customerPhone,
    parcelContent, weight: weightKg, quantity,
  };
  if (codAmount != null) orderPayload.COD = codAmount; else orderPayload.goodsValue = goodsValue;

  const body = {
    courier: courierApiValue,
    pickup: { type: 'dropOff', address_id: pickupAddressId },
    orders: [orderPayload],
  };
  return mengantarFetch('/order', { method: 'POST', body: JSON.stringify(body) });
}

module.exports = { ALLOWED_COURIERS, resolveCourierForApi, searchAddress, createOrder };