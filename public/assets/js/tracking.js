// ============================================================
// tracking.js — Halaman Lacak Pesanan
// Perbaikan: prefix +62, timeline 4 langkah, detail lengkap, copy order ID, cari pakai order ID
// ============================================================

(function() {
    'use strict';

    const API_BASE_URL = window.location.origin + '/api';
    const WA_ADMIN = '6281932696934';

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const rupiah = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
    let cameFromOrderParam = false;

    // ===== THROTTLE =====
    let lastRequestTime = 0;
    const MIN_REQUEST_INTERVAL = 2000;

    function showOnly(id) {
        ['search-card', 'detail-card'].forEach((x) => {
            const el = $(`#${x}`);
            if (el) el.style.display = x === id ? 'block' : 'none';
        });
        // Order list tidak digunakan lagi (langsung ke detail)
    }

    const PAYMENT_LABELS = {
        COD: 'COD (Bayar di Tempat)',
        QRIS_CUSTOM: 'QRIS',
        MANDIRI: 'Mandiri VA',
        BCA: 'BCA VA',
        BNI: 'BNI VA',
        BRI: 'BRI VA',
        BSI: 'BSI VA',
        ALFAMART: 'Alfamart',
        INDOMARET: 'Indomaret',
    };

    // ============================================================
    // 1. RENDER TIMELINE 4 LANGKAH (Dibayar → Dikemas → Dikirim → Diterima)
    // ============================================================
    function renderTimeline(shippingStatus, paymentType, paymentStatus) {
        const waitingBox = $('#waiting-payment-box');
        const timelineBox = $('#timeline-box');

        if (!waitingBox || !timelineBox) return;

        // Jika NON-COD dan belum PAID → Menunggu Pembayaran
        if (paymentType === 'NONCOD' && paymentStatus !== 'PAID') {
            waitingBox.style.display = 'block';
            timelineBox.style.display = 'none';
            return;
        }
        waitingBox.style.display = 'none';
        timelineBox.style.display = 'block';

        // 4 status: DIBAYAR, DIKEMAS, DIKIRIM, DITERIMA
        const steps = ['DIBAYAR', 'DIKEMAS', 'DIKIRIM', 'DITERIMA'];
        // shippingStatus dari backend: DIKEMAS, DIKIRIM, DITERIMA, MENUNGGU_PEMBAYARAN
        let idx = 0; // default DIBAYAR
        if (shippingStatus === 'DIKEMAS') idx = 1;
        else if (shippingStatus === 'DIKIRIM') idx = 2;
        else if (shippingStatus === 'DITERIMA') idx = 3;
        else idx = 1; // default ke DIKEMAS jika tidak ada status

        steps.forEach((s, i) => {
            const el = $(`#tl-step-4-${i + 1}`);
            if (el) {
                el.classList.remove('done', 'current');
                if (i < idx) {
                    el.classList.add('done');
                } else if (i === idx) {
                    el.classList.add('current', 'done');
                }
            }
        });

        // Progress bar: 0% (belum), 33%, 66%, 100%
        const pct = idx === 0 ? 0 : idx === 1 ? 33 : idx === 2 ? 66 : 100;
        const progress = $('#tl-progress-4');
        if (progress) progress.style.width = `${pct}%`;
    }

    // ============================================================
    // 2. RENDER DETAIL ORDER (LENGKAP)
    // ============================================================
    function renderDetail(order) {
        showOnly('detail-card');

        // Kembali ke pencarian
        const backBtn = $('#back-to-search');
        if (backBtn) {
            backBtn.textContent = cameFromOrderParam ? '🛒 Belanja Lagi' : '← Kembali ke pencarian';
            backBtn.onclick = () => {
                if (cameFromOrderParam) {
                    window.location.href = './index.html';
                } else {
                    showOnly('search-card');
                    $('#phone-input').value = '';
                    $('#order-id-input').value = '';
                }
            };
        }

        // Estimasi tiba (3-4 hari setelah order)
        const estimateEl = $('#d-estimate');
        if (estimateEl) {
            const createdAt = new Date(order.createdAt);
            if (!isNaN(createdAt)) {
                const tgl1 = new Date(createdAt);
                tgl1.setDate(tgl1.getDate() + 3);
                const tgl2 = new Date(createdAt);
                tgl2.setDate(tgl2.getDate() + 4);
                const options = { day: 'numeric', month: 'short', year: 'numeric' };
                estimateEl.textContent = `Estimasi tiba ${tgl1.toLocaleDateString('id-ID', options)} - ${tgl2.toLocaleDateString('id-ID', options)}`;
            } else {
                estimateEl.textContent = 'Estimasi tiba 3-4 hari';
            }
        }

        // Order ID
        const orderIdEl = $('#d-order-id');
        if (orderIdEl) orderIdEl.textContent = order.orderId;

        // Copy Order ID
        const copyBtn = $('#copy-order-id');
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(order.orderId).then(() => {
                    alert('Order ID berhasil disalin!');
                }).catch(() => {
                    // Fallback
                    const input = document.createElement('input');
                    input.value = order.orderId;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    alert('Order ID berhasil disalin!');
                });
            };
        }

        // Customer info
        const nameEl = $('#d-customer-name');
        if (nameEl) nameEl.textContent = order.customerName || '-';
        const phoneEl = $('#d-customer-phone');
        if (phoneEl) phoneEl.textContent = order.customerPhone ? `(+62) ${order.customerPhone}` : '-';
        const addressEl = $('#d-customer-address');
        if (addressEl) addressEl.textContent = order.fullAddress || '-';

        // Product info
        const productNameEl = $('#d-product-name');
        if (productNameEl) productNameEl.textContent = order.productName || 'Spray Tidur';
        const productQtyEl = $('#d-product-qty');
        if (productQtyEl) productQtyEl.textContent = `× ${order.qty || 1}`;
        const productTotalEl = $('#d-product-total');
        if (productTotalEl) productTotalEl.textContent = rupiah(order.totalPrice);

        // Resi
        const resiEl = $('#d-resi');
        if (resiEl) resiEl.textContent = order.cnoteNo || 'Belum tersedia';

        // Metode Bayar
        const paymentEl = $('#d-payment');
        if (paymentEl) {
            paymentEl.textContent = PAYMENT_LABELS[order.paymentChannel] || order.paymentType || '-';
        }

        // Timeline
        renderTimeline(order.shippingStatus || 'DIKEMAS', order.paymentType, order.paymentStatus);

        // Tombol WA ke penjual
        const waBtn = $('#d-wa-btn');
        if (waBtn) {
            const msg = `Halo, saya mau tanya soal pesanan saya.\nOrder ID: ${order.orderId}`;
            waBtn.href = `https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(msg)}`;
        }
    }

    // ============================================================
    // 3. SEARCH BY PHONE (dengan prefix +62)
    // ============================================================
    async function searchByPhone(phone) {
        // Throttle
        const now = Date.now();
        const diff = now - lastRequestTime;
        if (diff < MIN_REQUEST_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - diff));
        }
        lastRequestTime = Date.now();

        const msgEl = $('#search-msg');
        if (msgEl) msgEl.style.display = 'none';

        try {
            const res = await fetch(`${API_BASE_URL}/track-order?phone=${encodeURIComponent(phone)}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.message);
            if (!json.orders || !json.orders.length) {
                if (msgEl) {
                    msgEl.textContent = 'Tidak ada pesanan ditemukan untuk nomor ini.';
                    msgEl.style.display = 'block';
                }
                return;
            }

            // Jika ada banyak pesanan, tampilkan yang pertama atau pilih manual
            // Untuk sekarang, tampilkan pesanan terbaru
            if (json.orders.length === 1) {
                renderDetail(json.orders[0]);
            } else {
                // Tampilkan pesanan terbaru (createdAt terakhir)
                const sorted = json.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                renderDetail(sorted[0]);
                // Tampilkan pesan bahwa ada lebih dari 1
                if (msgEl) {
                    msgEl.textContent = `Menampilkan pesanan terbaru dari ${json.orders.length} pesanan.`;
                    msgEl.style.display = 'block';
                    msgEl.style.color = '#4CAF50';
                }
            }
        } catch (e) {
            if (msgEl) {
                msgEl.textContent = e.message || 'Gagal mencari pesanan.';
                msgEl.style.display = 'block';
                msgEl.style.color = '#d32f2f';
            }
        }
    }

    // ============================================================
    // 4. LOAD BY ORDER ID
    // ============================================================
    async function loadByOrderId(orderId) {
        const msgEl = $('#search-msg');
        if (msgEl) msgEl.style.display = 'none';

        try {
            const res = await fetch(`${API_BASE_URL}/check-status?orderId=${encodeURIComponent(orderId)}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.message);

            // Jika order ditemukan, tampilkan detail
            renderDetail({
                orderId: json.orderId,
                productName: json.productName,
                qty: json.qty,
                totalPrice: json.totalPrice,
                paymentType: json.paymentType,
                paymentChannel: json.paymentChannel,
                paymentStatus: json.paymentStatus,
                shippingStatus: json.shippingStatus,
                cnoteNo: json.cnoteNo,
                customerName: json.customerName,
                customerPhone: json.customerPhone,
                fullAddress: json.fullAddress,
                createdAt: json.createdAt,
            });
        } catch (e) {
            if (msgEl) {
                msgEl.textContent = 'Order tidak ditemukan. Coba cari lewat nomor HP.';
                msgEl.style.display = 'block';
                msgEl.style.color = '#d32f2f';
            }
        }
    }

    // ============================================================
    // 5. INIT
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
        const searchBtn = $('#search-btn');
        const phoneInput = $('#phone-input');
        const orderInput = $('#order-id-input');
        const searchOrderBtn = $('#search-order-btn');

        // ===== SEARCH BY PHONE =====
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const raw = phoneInput ? phoneInput.value.trim() : '';
                const phone = raw.replace(/\D/g, '');
                if (phone.length < 8) {
                    const msgEl = $('#search-msg');
                    if (msgEl) {
                        msgEl.textContent = 'Nomor HP tidak valid (minimal 8 digit).';
                        msgEl.style.display = 'block';
                        msgEl.style.color = '#d32f2f';
                    }
                    return;
                }
                searchByPhone(phone);
            });
        }

        if (phoneInput) {
            phoneInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const btn = $('#search-btn');
                    if (btn) btn.click();
                }
            });
        }

        // ===== SEARCH BY ORDER ID =====
        if (searchOrderBtn) {
            searchOrderBtn.addEventListener('click', () => {
                const orderId = orderInput ? orderInput.value.trim() : '';
                if (!orderId) {
                    const msgEl = $('#search-msg');
                    if (msgEl) {
                        msgEl.textContent = 'Masukkan Order ID!';
                        msgEl.style.display = 'block';
                        msgEl.style.color = '#d32f2f';
                    }
                    return;
                }
                cameFromOrderParam = true;
                loadByOrderId(orderId);
            });
        }

        if (orderInput) {
            orderInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const btn = $('#search-order-btn');
                    if (btn) btn.click();
                }
            });
        }

        // ===== CEK PARAMETER ORDER DARI CHECKOUT =====
        const params = new URLSearchParams(window.location.search);
        const orderIdParam = params.get('order');
        if (orderIdParam) {
            cameFromOrderParam = true;
            loadByOrderId(orderIdParam);
        } else {
            showOnly('search-card');
        }
    });

})();
