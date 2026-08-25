// api/create-order.js
// POST /api/create-order

const { resolveCourierForApi, createOrder: createMengantarOrder } = require('./lib/mengantar');
const { createOrder: createCashiOrder, PAYMENT_CHANNELS, resolveKodeChannel } = require('./lib/cashi');
const { createOrderRow } = require('./lib/sheets');
const { calcPricing } = require('./lib/pricing');

const PRODUCT_NAME = process.env.PRODUCT_NAME || 'Spray Tidur';
const PRODUCT_PRICE = Number(process.env.PRODUCT_PRICE || 209000);
const PRODUCT_WEIGHT_GRAM = Number(process.env.PRODUCT_WEIGHT_GRAM || 150);
const PICKUP_ADDRESS_ID = process.env.MENGANTAR_PICKUP_ADDRESS_ID;
const ONGKIR = Number(process.env.ONGKIR || 15000);

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
      destinationAddressId, qty, courierChoice, paymentType, paymentChannel, useVoucher,
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

    // Nomor HP: simpan sebagai string dengan leading zero
    let rawPhone = String(customerPhone).trim();
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      return res.status(400).json({ success: false, message: 'Nomor HP tidak valid' });
    }
    const phoneForSheet = cleanPhone; // string, leading zero tetap

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

    // Hitung ongkir
    const useVoucherBool = useVoucher === true || useVoucher === 'true';
    const shippingFee = useVoucherBool ? 0 : ONGKIR;
    const totalPrice = pricing.totalDiscounted + shippingFee;

    const baseRow = {
      order_id: orderId,
      created_at: new Date().toISOString(),
      customer_name: customerName,
      customer_phone: phoneForSheet,
      full_address: fullAddress,
      destination_address_id: destinationAddressId,
      product_name: PRODUCT_NAME,
      qty: pricing.qty,
      price_per_pcs: pricing.pricePerPcs,
      discount_percent: Math.round(pricing.discountPercent * 100),
      total_price: totalPrice,
      payment_type: paymentType,
      payment_channel: paymentType === 'COD' ? '-' : paymentChannel,
      courier_choice: courierChoice,
      courier_mengantar: courierApiValue,
      ongkir: shippingFee,
      voucher_dipakai: useVoucherBool ? 'TRUE' : 'FALSE',
    };

    // ===== COD =====
    if (paymentType === 'COD') {
      const mengantarPayload = {
        courier: courierApiValue,
        pickup: { type: 'dropOff', address_id: PICKUP_ADDRESS_ID },
        orders: [{
          goodsValue: pricing.totalDiscounted,
          COD: totalPrice,
          customerAddress: fullAddress,
          customerName: customerName,
          customerAddressDataId: destinationAddressId,
          customerPhone: phoneForSheet,
          parcelContent: PRODUCT_NAME,
          weight: weightKg,
          quantity: pricing.qty,
        }]
      };

      const mengantarResult = await createMengantarOrder({
        courierApiValue,
        pickupAddressId: PICKUP_ADDRESS_ID,
        customerName,
        customerPhone: phoneForSheet,
        customerAddress: fullAddress,
        customerAddressDataId: destinationAddressId,
        weightKg,
        quantity: pricing.qty,
        parcelContent: PRODUCT_NAME,
        codAmount: totalPrice,
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
        totalPrice: totalPrice,
        resi: item.cnote_no || '-',
        shippingFee: shippingFee,
        useVoucher: useVoucherBool,
      });
    }

    // ===== NON-COD =====
    if (paymentType === 'NONCOD') {
      const channelConfig = PAYMENT_CHANNELS[paymentChannel];
      if (!channelConfig) {
        return res.status(400).json({
          success: false,
          message: `Metode pembayaran tidak valid: ${paymentChannel}`,
        });
      }

      const kodeChannel = resolveKodeChannel(paymentChannel);
      if (!kodeChannel) {
        return res.status(400).json({
          success: false,
          message: `Kode channel tidak valid untuk: ${paymentChannel}`,
        });
      }

      if (totalPrice < channelConfig.min || totalPrice > channelConfig.max) {
        return res.status(400).json({
          success: false,
          message: `Total Rp${totalPrice} di luar batas ${channelConfig.label} (min Rp${channelConfig.min}, max Rp${channelConfig.max})`,
        });
      }

      // Buat transaksi Cashi
      const cashiResult = await createCashiOrder({
        amount: totalPrice,
        orderId,
        kodeChannel: kodeChannel,
      });

      // === AMBIL TOTAL AKHIR DARI CASHI ===
      // Cashi mungkin mengembalikan total_amount (sudah termasuk fee)
      const finalTotal = cashiResult.total_amount || totalPrice;

      await createOrderRow({
        ...baseRow,
        total_price: finalTotal, // update dengan total dari Cashi
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
        totalPrice: finalTotal, // kirim finalTotal ke frontend
        shippingFee: shippingFee,
        useVoucher: useVoucherBool,
        payment: {
          ...cashiResult,
          total_amount: finalTotal, // pastikan total_amount terisi
        },
      });
    }

    return res.status(400).json({ success: false, message: 'paymentType harus COD atau NONCOD' });
  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
