// api/create-order.js
// POST /api/create-order

const { resolveCourierForApi, createOrder: createMengantarOrder } = require('./lib/mengantar');
const { createOrder: createCashiOrder, PAYMENT_CHANNELS } = require('./lib/cashi');
const { createOrderRow } = require('./lib/sheets');
const { calcPricing } = require('./lib/pricing');

const PRODUCT_NAME = process.env.PRODUCT_NAME || 'Spray Tidur';
const PRODUCT_PRICE = Number(process.env.PRODUCT_PRICE || 209000);
const PRODUCT_WEIGHT_GRAM = Number(process.env.PRODUCT_WEIGHT_GRAM || 150);
const PICKUP_ADDRESS_ID = process.env.MENGANTAR_PICKUP_ADDRESS_ID;

function generateOrderId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SPRAY-${stamp}-${rand}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const {
      customerName, customerPhone, province, city, district, subdistrict, addressDetail,
      destinationAddressId, qty, courierChoice, paymentType, paymentChannel,
    } = req.body || {};

    // Validasi
    const missing = [];
    if (!customerName) missing.push('customerName');
    if (!customerPhone) missing.push('customerPhone');
    if (!province) missing.push('province');
    if (!city) missing.push('city');
    if (!district) missing.push('district');
    if (!subdistrict) missing.push('subdistrict');
    if (!addressDetail) missing.push('addressDetail');
    if (!destinationAddressId) missing.push('destinationAddressId');
    if (!qty || Number(qty) < 1) missing.push('qty');
    if (!courierChoice) missing.push('courierChoice');
    if (!paymentType) missing.push('paymentType');

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Data belum lengkap: ${missing.join(', ')}`,
      });
    }

    const cleanPhone = String(customerPhone).replace(/\D/g, '');
    if (!/^\d{9,15}$/.test(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'Nomor HP tidak valid' });
    }

    if (!PICKUP_ADDRESS_ID) {
      return res.status(500).json({
        success: false,
        message: 'MENGANTAR_PICKUP_ADDRESS_ID belum dikonfigurasi di server.',
      });
    }

    const pricing = calcPricing(PRODUCT_PRICE, Number(qty));
    const weightKg = (PRODUCT_WEIGHT_GRAM * pricing.qty) / 1000;
    const courierApiValue = resolveCourierForApi(courierChoice);
    const orderId = generateOrderId();
    const fullAddress = `${addressDetail}, ${subdistrict}, ${district}, ${city}, ${province}`;

    const baseRow = {
      order_id: orderId,
      created_at: new Date().toISOString(),
      customer_name: customerName,
      customer_phone: cleanPhone,
      full_address: fullAddress,
      destination_address_id: destinationAddressId,
      product_name: PRODUCT_NAME,
      qty: pricing.qty,
      price_per_pcs: pricing.pricePerPcs,
      discount_percent: Math.round(pricing.discountPercent * 100),
      total_price: pricing.totalDiscounted,
      payment_type: paymentType,
      payment_channel: paymentType === 'COD' ? '-' : paymentChannel,
      courier_choice: courierChoice,
      courier_mengantar: courierApiValue,
    };

    // ===== COD =====
    if (paymentType === 'COD') {
      const mengantarResult = await createMengantarOrder({
        courierApiValue,
        pickupAddressId: PICKUP_ADDRESS_ID,
        customerName,
        customerPhone: cleanPhone,
        customerAddress: fullAddress,
        customerAddressDataId: destinationAddressId,
        weightKg,
        quantity: pricing.qty,
        parcelContent: PRODUCT_NAME,
        codAmount: pricing.totalDiscounted,
      });

      const item = (mengantarResult.data && mengantarResult.data[0]) || {};

      await createOrderRow({
        ...baseRow,
        payment_status: '-',
        cashi_order_id: '-',
        cashi_checkout_url: '-',
        mengantar_order_id: item.ORDER_ID || '-',
        cnote_no: item.cnote_no || '-',
        sudah_dikirim: 'FALSE',
        sudah_diterima: 'FALSE',
        notes: item.error || '',
      });

      return res.status(200).json({
        success: true,
        orderId,
        paymentType: 'COD',
        totalPrice: pricing.totalDiscounted,
        resi: item.cnote_no || '-',
      });
    }

    // ===== NON-COD =====
    if (paymentType === 'NONCOD') {
      // Cek channel
      const channelConfig = Object.values(PAYMENT_CHANNELS).find((c) => c.kode_channel === paymentChannel);
      if (!channelConfig) {
        return res.status(400).json({ success: false, message: 'Metode pembayaran tidak valid' });
      }

      if (pricing.totalDiscounted < channelConfig.min || pricing.totalDiscounted > channelConfig.max) {
        return res.status(400).json({
          success: false,
          message: `Total Rp${pricing.totalDiscounted} di luar batas ${channelConfig.label} (min Rp${channelConfig.min}, max Rp${channelConfig.max})`,
        });
      }

      // Buat transaksi Cashi
      const cashiResult = await createCashiOrder({
        amount: pricing.totalDiscounted,
        orderId,
        kodeChannel: paymentChannel,
      });

      await createOrderRow({
        ...baseRow,
        payment_status: 'PENDING',
        cashi_order_id: orderId,
        cashi_checkout_url: cashiResult.checkout_url || '-',
        mengantar_order_id: '-',
        cnote_no: '-',
        sudah_dikirim: 'FALSE',
        sudah_diterima: 'FALSE',
        notes: '',
      });

      return res.status(200).json({
        success: true,
        orderId,
        paymentType: 'NONCOD',
        totalPrice: pricing.totalDiscounted,
        payment: cashiResult,
      });
    }

    return res.status(400).json({ success: false, message: 'paymentType harus COD atau NONCOD' });
  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};