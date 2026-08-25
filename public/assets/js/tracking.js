// ============================================================
// tracking.js — Halaman Lacak Pesanan
// Perbaikan: input HP dengan prefix +62, timeline, list dalam kotak
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
        ['search-card', 'order-list-card', 'detail-card'].forEach((x) => {
            const el = $(`#${x}`);
            if (el) el.style.display = x === id ? 'block' : 'none';
        });
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

    // ===== RENDER TIMELINE (DENGAN BULATAN & GARIS) =====
    function renderTimeline(shippingStatus) {
        const waitingBox = $('#waiting-payment-box');
        const timelineBox = $('#timeline-box');

        if (!waitingBox || !timelineBox) return;

        // Jika status = MENUNGGU_PEMBAYARAN, tampilkan box khusus
        if (shippingStatus === 'MENUNGGU_PEMBAYARAN') {
            waitingBox.style.display = 'block';
            timelineBox.style.display = 'none';
            return;
        }
        waitingBox.style.display = 'none';
        timelineBox.style.display = 'block';

        // Langkah-langkah status
        const steps = ['DIKEMAS', 'DIKIRIM', 'DITERIMA'];
        const idx = steps.indexOf(shippingStatus);

        // Update tiap step
        steps.forEach((s, i) => {
            const el = $(`#tl-step-${i + 1}`);
            if (el) {
                el.classList.remove('done', 'current');
                if (i < idx) {
                    el.classList.add('done');       // selesai
                } else if (i === idx) {
                    el.classList.add('current', 'done'); // aktif
                }
            }
        });

        // Progress bar (garis)
        const pct = idx <= 0 ? 0 : idx === 1 ? 50 : 100;
        const progress = $('#tl-progress');
        if (progress) progress.style.width = `${pct}%`;
    }

    // ===== RENDER DETAIL ORDER =====
    function renderDetail(order) {
        showOnly('detail-card');
        const backBtn = $('#back-to-list');
        if (backBtn) {
            backBtn.textContent = cameFromOrderParam ? '🛒 Belanja Lagi' : '← Kembali ke daftar';
        }

        const elements = {
            'd-order-id': order.orderId,
            'd-resi': order.cnoteNo || 'Menyiapkan resi…',
            'd-product': `${order.productName || 'Spray Tidur'} × ${order.qty || 1}`,
            'd-total': rupiah(order.totalPrice),
            'd-payment': PAYMENT_LABELS[order.paymentChannel] || order.paymentType || '-',
        };
        Object.keys(elements).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = elements[id];
        });

        renderTimeline(order.shippingStatus || 'DIKEMAS');

        const waBtn = $('#d-wa-btn');
        if (waBtn) {
            const msg = `Halo, saya mau tanya soal pesanan saya.\nOrder ID: ${order.orderId}`;
            waBtn.href = `https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(msg)}`;
        }
    }

    // ===== RENDER LIST ORDER (dalam kotak) =====
    function renderOrderList(orders) {
        showOnly('order-list-card');
        const container = $('#order-list');
        if (!container) return;
        container.innerHTML = '';
        const STATUS_LABELS = {
            MENUNGGU_PEMBAYARAN: 'MENUNGGU PEMBAYARAN',
            DIKEMAS: 'DIKEMAS',
            DIKIRIM: 'DIKIRIM',
            DITERIMA: 'DITERIMA'
        };
        orders.forEach((o) => {
            const div = document.createElement('div');
            div.className = 'order-list-item';
            const chipClass = o.shippingStatus === 'MENUNGGU_PEMBAYARAN' ? 'status-chip pending' : 'status-chip';
            div.innerHTML = `
                <div class="oid">${o.orderId}</div>
                <div class="meta">${o.productName || 'Spray Tidur'} × ${o.qty} — ${rupiah(o.totalPrice)}</div>
                <div class="${chipClass}">${STATUS_LABELS[o.shippingStatus] || o.shippingStatus}</div>
            `;
            div.addEventListener('click', () => renderDetail(o));
            container.appendChild(div);
        });
    }

    // ===== SEARCH BY PHONE (dengan prefix +62) =====
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
            // Kirim phone (sudah bersih dari non-digit, tanpa 0 di depan)
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

            if (json.orders.length === 1) {
                renderDetail(json.orders[0]);
            } else {
                renderOrderList(json.orders);
            }
        } catch (e) {
            if (msgEl) {
                msgEl.textContent = e.message || 'Gagal mencari pesanan.';
                msgEl.style.display = 'block';
            }
        }
    }

    // ===== LOAD BY ORDER ID =====
    async function loadByOrderId(orderId) {
        try {
            const res = await fetch(`${API_BASE_URL}/check-status?orderId=${encodeURIComponent(orderId)}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            renderDetail({
                orderId: json.orderId,
                productName: json.productName,
                qty: json.qty,
                totalPrice: json.totalPrice,
                paymentType: json.paymentType,
                paymentChannel: json.paymentChannel,
                shippingStatus: json.shippingStatus,
                cnoteNo: json.cnoteNo,
            });
        } catch (e) {
            showOnly('search-card');
            const msgEl = $('#search-msg');
            if (msgEl) {
                msgEl.textContent = 'Order tidak ditemukan, coba cari lewat nomor HP.';
                msgEl.style.display = 'block';
            }
        }
    }

    // ============================================================
    // INIT
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
        const searchBtn = $('#search-btn');
        const phoneInput = $('#phone-input');

        // ===== SEARCH =====
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const raw = phoneInput ? phoneInput.value.trim() : '';
                // Hapus semua karakter non-digit (prefix +62 sudah di HTML)
                const phone = raw.replace(/\D/g, '');
                if (phone.length < 8) {
                    const msgEl = $('#search-msg');
                    if (msgEl) {
                        msgEl.textContent = 'Nomor HP tidak valid (minimal 8 digit).';
                        msgEl.style.display = 'block';
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

        // ===== TOMBOL KEMBALI =====
        const backToSearch = $('#back-to-search');
        if (backToSearch) {
            backToSearch.addEventListener('click', () => showOnly('search-card'));
        }

        const backToList = $('#back-to-list');
        if (backToList) {
            backToList.addEventListener('click', () => {
                if (cameFromOrderParam) {
                    window.location.href = './index.html';
                    return;
                }
                const raw = phoneInput ? phoneInput.value.trim() : '';
                const phone = raw.replace(/\D/g, '');
                if (phone) searchByPhone(phone);
                else showOnly('search-card');
            });
        }

        // ===== CEK PARAMETER ORDER =====
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
