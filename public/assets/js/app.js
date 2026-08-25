// ============================================================
// app.js — Spray Tidur Landing Page
// ============================================================

(function() {
    'use strict';

    // ===== KONFIGURASI =====
    const CONFIG = {
        API_BASE_URL: '/api',
        WA_ADMIN: '6281932696934',
        HARGA_PER_PCS: 209000,
        BERAT_PER_PCS: 0.15,
        ONGKIR: 15000,
    };

    // ===== DOM REFS =====
    const sections = {
        landing: document.getElementById('section-landing'),
        payment: document.getElementById('section-payment'),
        packed: document.getElementById('section-packed'),
        tracking: document.getElementById('section-tracking'),
    };

    // ===== STATE =====
    let currentQty = 1;
    let shippingFee = CONFIG.ONGKIR;
    let voucherUsed = false;
    let currentOrderData = null;
    let productPrice = CONFIG.HARGA_PER_PCS;
    let selectedPayment = 'COD';
    let selectedCourier = 'Direkomendasikan';

    // ============================================================
    // 1. FUNGSI HARGA
    // ============================================================
    function getDiscountedPrice(qty) {
        let disc = 0;
        if (qty === 1) disc = 0;
        else if (qty === 2) disc = 10;
        else if (qty === 3) disc = 12;
        else if (qty === 4) disc = 14;
        else if (qty >= 5) disc = 15;
        const total = productPrice * qty;
        return Math.round(total - (total * disc / 100));
    }

    function updatePriceDisplay() {
        const qty = currentQty;
        const originalTotal = productPrice * qty;
        const finalTotal = getDiscountedPrice(qty);
        const shipping = voucherUsed ? 0 : shippingFee;
        const total = finalTotal + shipping;

        const elements = {
            'price-original': 'Rp ' + originalTotal.toLocaleString(),
            'price-discount': 'Rp ' + finalTotal.toLocaleString(),
            'qty-display': qty,
            'summary-subtotal': 'Rp ' + finalTotal.toLocaleString(),
            'summary-total': '<strong>Rp ' + total.toLocaleString() + '</strong>',
            'footer-original': 'Rp ' + originalTotal.toLocaleString(),
            'footer-discount': 'Rp ' + total.toLocaleString(),
        };
        Object.keys(elements).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === 'summary-total') el.innerHTML = elements[id];
                else el.textContent = elements[id];
            }
        });

        const shippingEl = document.getElementById('summary-shipping');
        if (shippingEl) {
            shippingEl.textContent = voucherUsed ? 'Rp 0 (Gratis)' : 'Rp ' + shippingFee.toLocaleString();
        }

        const stickyPrice = document.getElementById('sticky-price');
        const stickyStrike = document.getElementById('sticky-strike');
        if (stickyPrice) stickyPrice.textContent = 'Rp ' + total.toLocaleString();
        if (stickyStrike) {
            if (originalTotal > finalTotal) {
                stickyStrike.style.display = 'block';
                stickyStrike.textContent = 'Rp ' + originalTotal.toLocaleString();
            } else {
                stickyStrike.style.display = 'none';
            }
        }
    }

    // ============================================================
    // 2. QTY CONTROL
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
        // Load config dari backend
        loadConfig();

        // QTY
        const btnMinus = document.getElementById('btn-minus');
        const btnPlus = document.getElementById('btn-plus');

        if (btnMinus) {
            btnMinus.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (currentQty > 1) {
                    currentQty--;
                    updatePriceDisplay();
                }
            });
        }

        if (btnPlus) {
            btnPlus.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (currentQty < 5) {
                    currentQty++;
                    updatePriceDisplay();
                } else {
                    alert('Maksimal pembelian 5 pcs');
                }
            });
        }

        // ===== VOUCHER =====
        const voucherBtn = document.getElementById('btn-voucher');
        if (voucherBtn) {
            voucherBtn.addEventListener('click', function(e) {
                e.preventDefault();
                voucherUsed = !voucherUsed;
                if (voucherUsed) {
                    this.classList.add('used');
                    this.innerHTML = '<i class="fas fa-check-circle"></i> Voucher Digunakan';
                } else {
                    this.classList.remove('used');
                    this.innerHTML = '<i class="fas fa-ticket-alt"></i> Gunakan Voucher Gratis Ongkir';
                }
                updatePriceDisplay();
            });
        }

        // ===== SUBMIT ORDER =====
        const btnCheckout1 = document.getElementById('btn-checkout');
        const btnCheckout2 = document.getElementById('btn-checkout-footer');

        if (btnCheckout1) {
            btnCheckout1.addEventListener('click', handleCheckout);
        }
        if (btnCheckout2) {
            btnCheckout2.addEventListener('click', handleCheckout);
        }

        // ===== TOMBOL LACAK PESANAN (di bawah total) =====
        const btnTrack = document.getElementById('btn-track');
        if (btnTrack) {
            btnTrack.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = './tracking.html';
            });
        }

        // ===== TRACKING HEADER =====
        const btnTrackHeader = document.getElementById('btn-track-header');
        if (btnTrackHeader) {
            btnTrackHeader.addEventListener('click', function() {
                window.location.href = './tracking.html';
            });
        }

        // ===== TRACKING SUBMIT =====
        const btnTrackSubmit = document.getElementById('btn-track-submit');
        if (btnTrackSubmit) {
            btnTrackSubmit.addEventListener('click', handleTracking);
        }

        // ===== BACK BUTTONS =====
        const btnBackHome = document.getElementById('btn-back-home');
        if (btnBackHome) btnBackHome.addEventListener('click', function() { showSection('landing'); });

        const btnBackHomePacked = document.getElementById('btn-back-home-packed');
        if (btnBackHomePacked) btnBackHomePacked.addEventListener('click', function() { showSection('landing'); });

        const btnBackHomeTrack = document.getElementById('btn-back-home-track');
        if (btnBackHomeTrack) btnBackHomeTrack.addEventListener('click', function() { showSection('landing'); });

        // ===== BERANDA HEADER =====
        const btnHome = document.getElementById('btn-home');
        if (btnHome) {
            btnHome.addEventListener('click', function(e) {
                e.preventDefault();
                showSection('landing');
            });
        }

        // ===== SEARCH KECAMATAN =====
        initSearchKecamatan();

        // ===== RENDER PAYMENT & COURIER =====
        renderPaymentOptions();
        renderCourierOptions();

        // ===== RENDER TESTIMONI =====
        renderTestimonials();

        // ===== INIT =====
        updatePriceDisplay();
        startCountdown();
        startGimmicks();
    });

    // ============================================================
    // 3. LOAD CONFIG DARI BACKEND
    // ============================================================
    async function loadConfig() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/config`);
            const result = await response.json();
            if (result.success && result.data) {
                const data = result.data;
                productPrice = data.productPrice || CONFIG.HARGA_PER_PCS;
                shippingFee = data.freeShippingDisplayValue || CONFIG.ONGKIR;
                document.getElementById('product-name').textContent = data.productName || 'Spray Tidur';
                document.getElementById('product-desc').textContent = data.productDescription || '';
                updatePriceDisplay();
            }
        } catch (err) {
            console.warn('Gagal load config:', err);
        }
    }

    // ============================================================
    // 4. SEARCH KECAMATAN
    // ============================================================
    function initSearchKecamatan() {
        const searchInput = document.getElementById('kecamatan-search');
        const resultsDiv = document.getElementById('kecamatan-results');
        if (!searchInput || !resultsDiv) return;

        searchInput.addEventListener('input', async function() {
            const keyword = this.value.trim();
            if (keyword.length < 2) {
                resultsDiv.classList.remove('active');
                return;
            }
            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/address-search?keyword=${encodeURIComponent(keyword)}`);
                const json = await response.json();
                if (json.success && json.data && json.data.length > 0) {
                    resultsDiv.innerHTML = '';
                    const seen = new Set();
                    json.data.forEach(item => {
                        const label = item.DISTRICT_NAME;
                        if (label && !seen.has(label)) {
                            seen.add(label);
                            const div = document.createElement('div');
                            div.className = 'search-result-item';
                            div.innerHTML = `
                                <div><strong>${label}</strong></div>
                                <div class="result-detail">${item.CITY_NAME || ''}, ${item.PROVINCE_NAME || ''}</div>
                            `;
                            div.dataset.provinsi = item.PROVINCE_NAME || '';
                            div.dataset.kabupaten = item.CITY_NAME || '';
                            div.dataset.kecamatan = label;
                            div.dataset.destinationId = item._id || '';
                            div.addEventListener('click', function() {
                                document.getElementById('provinsi').value = this.dataset.provinsi;
                                document.getElementById('kabupaten').value = this.dataset.kabupaten;
                                document.getElementById('kecamatan').value = this.dataset.kecamatan;
                                document.getElementById('destination-address-id').value = this.dataset.destinationId;
                                searchInput.value = this.dataset.kecamatan;
                                resultsDiv.classList.remove('active');
                            });
                            resultsDiv.appendChild(div);
                        }
                    });
                    resultsDiv.classList.add('active');
                } else {
                    resultsDiv.innerHTML = '<div class="search-result-item">Tidak ditemukan</div>';
                    resultsDiv.classList.add('active');
                }
            } catch (err) {
                console.error('Error search:', err);
                resultsDiv.innerHTML = `<div class="search-result-item">Error: ${err.message}</div>`;
                resultsDiv.classList.add('active');
            }
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.search-wrapper')) {
                resultsDiv.classList.remove('active');
            }
        });
    }

    // ============================================================
    // 5. RENDER PAYMENT OPTIONS
    // ============================================================
    function renderPaymentOptions() {
        const container = document.getElementById('payment-list');
        if (!container) return;
        container.innerHTML = '';

        const paymentOptions = [
            { key: 'COD', label: 'COD', icon: 'cod' },
            { key: 'QRIS', label: 'QRIS', icon: 'qris' },
            { key: 'MANDIRI', label: 'Mandiri VA', icon: 'mandiri' },
            { key: 'BCA', label: 'BCA VA', icon: 'bca' },
            { key: 'BNI', label: 'BNI VA', icon: 'bni' },
            { key: 'BRI', label: 'BRI VA', icon: 'bri' },
            { key: 'BSI', label: 'BSI VA', icon: 'bsi' },
            { key: 'ALFAMART', label: 'Alfamart', icon: 'alfamart' },
            { key: 'INDOMARET', label: 'Indomaret', icon: 'indomaret' },
        ];

        paymentOptions.forEach((opt, index) => {
            const isSelected = (index === 0);
            if (isSelected) selectedPayment = opt.key;

            const item = document.createElement('label');
            item.className = 'payment-item' + (isSelected ? ' selected' : '');
            item.innerHTML = `
                <input type="radio" name="payment" value="${opt.key}" ${isSelected ? 'checked' : ''} />
                <span class="icon-box"><img src="./assets/img/payment/${opt.icon}.png" alt="${opt.label}" onerror="this.style.display='none'" /></span>
                <span>${opt.label}</span>
            `;
            item.addEventListener('click', function() {
                const radio = this.querySelector('input[type="radio"]');
                radio.checked = true;
                selectedPayment = radio.value;
                document.querySelectorAll('#payment-list .payment-item').forEach(el => el.classList.remove('selected'));
                this.classList.add('selected');
            });
            container.appendChild(item);
        });
    }

    // ============================================================
    // 6. RENDER COURIER OPTIONS
    // ============================================================
    function renderCourierOptions() {
        const container = document.getElementById('courier-list');
        if (!container) return;
        container.innerHTML = '';

        const courierOptions = [
            { key: 'Direkomendasikan', label: 'Direkomendasikan (JNT)', icon: 'recommended' },
            { key: 'JNT', label: 'JNT', icon: 'jnt' },
            { key: 'SiCepat', label: 'SiCepat', icon: 'sicepat' },
            { key: 'Sap', label: 'Sap', icon: 'sap' },
            { key: 'iDexpress', label: 'iDexpress', icon: 'idexpress' },
        ];

        courierOptions.forEach((opt, index) => {
            const isSelected = (index === 0);
            if (isSelected) selectedCourier = opt.key;

            const item = document.createElement('label');
            item.className = 'courier-item' + (isSelected ? ' selected' : '');
            item.innerHTML = `
                <input type="radio" name="courier" value="${opt.key}" ${isSelected ? 'checked' : ''} />
                <span class="icon-box"><img src="./assets/img/couriers/${opt.icon}.png" alt="${opt.label}" onerror="this.style.display='none'" /></span>
                <span>${opt.label}</span>
            `;
            item.addEventListener('click', function() {
                const radio = this.querySelector('input[type="radio"]');
                radio.checked = true;
                selectedCourier = radio.value;
                document.querySelectorAll('#courier-list .courier-item').forEach(el => el.classList.remove('selected'));
                this.classList.add('selected');
            });
            container.appendChild(item);
        });
    }

    // ============================================================
    // 7. RENDER TESTIMONI
    // ============================================================
    function renderTestimonials() {
        const container = document.getElementById('testimoni-container');
        if (!container) return;
        container.innerHTML = '';

        const testimonials = [
            {
                name: 'Dwi Rahmawati',
                stars: 5,
                text: 'Mantap barang dah sampe dengan aman min packing tebel.. semalem nyoba semprot di bantal pas anak lagi rewel susah tidur, eh selang bentar langsung anteng terus pules dong wkwk wangi aromaterapinya calming bgt ga menyengat. rekomended bgt buat emak2 yg anaknya susah tidur',
                hasPhoto: true,
                photo: 'testi-produk1.jpg'
            },
            {
                name: 'Budi Santoso',
                stars: 5,
                text: 'Bagus banget! Aroma nya menenangkan, langsung tidur nyenyak. Udah beli 3 kali dan selalu puas. Cepat dikirim, packing aman. Recommended!',
                hasPhoto: true,
                photo: 'testi-produk2.jpg'
            },
            {
                name: 'Siti Nurhaliza',
                stars: 5,
                text: 'Anak saya jadi gampang tidur, ga rewel lagi. Wanginya juga ga nyengat, bikin kamar jadi adem. Pengiriman cepat, puas banget!',
                hasPhoto: true,
                photo: 'testi-produk3.jpg'
            },
            {
                name: 'Rizky Fadillah',
                stars: 5,
                text: 'Produk asli BPOM, aman. Wangi nya calming, bikin tidur lebih nyenyak. Langsung order lagi buat stok. Mantap!',
                hasPhoto: false
            },
            {
                name: 'Andi Wijaya',
                stars: 4,
                text: 'Cukup membantu untuk tidur, efeknya lumayan. Mungkin butuh waktu adaptasi, tapi overall bagus. Pengiriman cepat.',
                hasPhoto: false
            }
        ];

        testimonials.forEach((t) => {
            const stars = '★'.repeat(t.stars) + '☆'.repeat(5 - t.stars);
            const card = document.createElement('div');
            card.className = 'testimonial-card' + (t.hasPhoto ? '' : ' no-avatar');

            let photoHtml = '';
            if (t.hasPhoto) {
                photoHtml = `<div class="testi-product-photo"><img src="./assets/img/testimoni/${t.photo}" alt="Foto Produk" /></div>`;
            }

            card.innerHTML = `
                <div class="testi-header">
                    <div class="testi-left">
                        <div class="testi-avatar-placeholder"><i class="fas fa-user-circle"></i></div>
                        <div>
                            <span class="testi-name">${t.name}</span>
                            <div class="testi-stars">${stars}</div>
                        </div>
                    </div>
                    <span class="testi-badge">Pembeli</span>
                </div>
                ${photoHtml}
                <p class="testi-text">${t.text}</p>
            `;
            container.appendChild(card);
        });
    }

    // ============================================================
    // 8. SHOW SECTION
    // ============================================================
    function showSection(id) {
        Object.keys(sections).forEach(key => {
            if (sections[key]) {
                sections[key].classList.toggle('active', key === id);
            }
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ============================================================
    // 9. HANDLE CHECKOUT
    // ============================================================
    async function handleCheckout() {
        const nama = document.getElementById('full-name').value.trim();
        const noHp = document.getElementById('phone').value.trim();
        const provinsi = document.getElementById('provinsi').value;
        const kabupaten = document.getElementById('kabupaten').value;
        const kecamatan = document.getElementById('kecamatan').value;
        const alamat = document.getElementById('alamat-lengkap').value.trim();
        const destId = document.getElementById('destination-address-id')?.value || '';

        if (!nama) { alert('Nama lengkap wajib diisi!'); return; }
        if (!noHp || noHp.length < 8) { alert('Nomor HP tidak valid!'); return; }
        if (!kecamatan || !alamat || !destId) { alert('Harap pilih kecamatan dari daftar dan isi alamat lengkap!'); return; }

        const qty = currentQty;
        const subtotal = getDiscountedPrice(qty);
        const shipping = voucherUsed ? 0 : shippingFee;
        const total = subtotal + shipping;
        const isCOD = (selectedPayment === 'COD');
        const weight = CONFIG.BERAT_PER_PCS * qty;

        try {
            const payload = {
                customerName: nama,
                customerPhone: noHp,
                province: provinsi,
                city: kabupaten,
                district: kecamatan,
                subdistrict: kecamatan,
                addressDetail: alamat,
                destinationAddressId: destId,
                qty: qty,
                courierChoice: selectedCourier,
                paymentType: isCOD ? 'COD' : 'NONCOD',
                paymentChannel: isCOD ? null : selectedPayment,
            };

            const response = await fetch(`${CONFIG.API_BASE_URL}/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();

            if (!result.success) {
                alert('Gagal buat order: ' + (result.message || 'Unknown error'));
                return;
            }

            currentOrderData = {
                orderId: result.orderId,
                nama: nama,
                noHp: noHp,
                totalHarga: total,
                kurir: selectedCourier,
                metodeBayar: selectedPayment,
                resi: result.resi || '-',
                isCOD: isCOD,
            };

            if (isCOD) {
                showPackedPage(currentOrderData);
            } else {
                if (result.payment) {
                    showPaymentPage(result.payment, currentOrderData);
                } else {
                    alert('Gagal mendapatkan data pembayaran');
                }
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    // ============================================================
    // 10. SHOW PAYMENT PAGE
    // ============================================================
    function showPaymentPage(cashiResp, orderData) {
        showSection('payment');
        const instr = document.getElementById('payment-instruction');
        const statusDiv = document.getElementById('payment-status');
        const waBtn = document.getElementById('btn-wa-payment');

        let html = `<p><strong>Total:</strong> Rp ${orderData.totalHarga.toLocaleString()}</p>`;
        html += `<p><strong>Order ID:</strong> ${orderData.orderId}</p>`;
        if (cashiResp.qrUrl) {
            html += `<p>Scan QRIS:</p><img src="${cashiResp.qrUrl}" style="max-width:200px;display:block;margin:10px auto;border-radius:10px;"/>`;
        } else if (cashiResp.va_number) {
            html += `<p><strong>Virtual Account:</strong> ${cashiResp.va_number}</p><p><strong>Bank:</strong> ${cashiResp.bank_name || cashiResp.bank}</p>`;
        } else if (cashiResp.payment_code) {
            html += `<p><strong>Kode Pembayaran:</strong> ${cashiResp.payment_code}</p><p><strong>Retail:</strong> ${cashiResp.retail_name || cashiResp.retail_code}</p>`;
        } else {
            html += `<pre>${JSON.stringify(cashiResp, null, 2)}</pre>`;
        }
        if (instr) instr.innerHTML = html;
        if (statusDiv) {
            statusDiv.innerHTML = `<p>Menunggu pembayaran... (auto-check setiap 5 detik)</p><div class="spinner"></div>`;
        }
        if (waBtn) waBtn.style.display = 'none';

        let pollCount = 0;
        const interval = setInterval(async () => {
            pollCount++;
            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/check-status?orderId=${orderData.orderId}`);
                const result = await response.json();
                if (result.success && result.paymentStatus === 'PAID') {
                    clearInterval(interval);
                    if (statusDiv) {
                        statusDiv.innerHTML = `<p style="color:#25D366;font-weight:bold;">✅ Pembayaran berhasil!</p>`;
                    }
                    if (waBtn) {
                        waBtn.style.display = 'inline-block';
                        waBtn.onclick = () => {
                            showPackedPage(orderData);
                        };
                    }
                } else if (pollCount >= 60) {
                    clearInterval(interval);
                    if (statusDiv) {
                        statusDiv.innerHTML = `<p style="color:red;">⏰ Waktu habis. Jika sudah bayar, klik tombol di bawah.</p>`;
                    }
                    if (waBtn) {
                        waBtn.style.display = 'inline-block';
                        waBtn.onclick = () => {
                            showPackedPage(orderData);
                        };
                    }
                }
            } catch (e) {
                console.warn(e);
            }
        }, 5000);

        document.getElementById('btn-back-home').onclick = () => showSection('landing');
    }

    // ============================================================
    // 11. SHOW PACKED PAGE
    // ============================================================
    function showPackedPage(data) {
        showSection('packed');
        const elements = {
            'packed-order-id': data.orderId,
            'packed-resi': data.resi || '-',
            'packed-courier': data.kurir,
            'packed-total': data.totalHarga.toLocaleString(),
            'packed-method': data.metodeBayar,
        };
        Object.keys(elements).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = elements[id];
        });

        const btnWa = document.getElementById('btn-wa-packed');
        if (btnWa) {
            btnWa.onclick = () => {
                const pesan = `Halo ${data.nama},\n\nPesanan Anda (${data.orderId}) sudah dikemas.\nResi: ${data.resi || '-'}\nTotal: Rp ${data.totalHarga.toLocaleString()}\nKurir: ${data.kurir}\n\nTerima kasih!`;
                const url = `https://wa.me/${data.noHp.replace(/^0+/, '')}?text=${encodeURIComponent(pesan)}`;
                window.open(url, '_blank');
            };
        }

        const btnConfirm = document.getElementById('btn-confirm-shipped');
        if (btnConfirm) {
            btnConfirm.onclick = () => {
                const pesanAdmin = `Halo Admin,\n\nSaya sudah mengantarkan paket ke outlet ekspedisi.\nOrder ID: ${data.orderId}\nResi: ${data.resi}\nKurir: ${data.kurir}\n\nMohon update status di spreadsheet menjadi "sudah_dikirim = TRUE".`;
                const url = `https://wa.me/${CONFIG.WA_ADMIN}?text=${encodeURIComponent(pesanAdmin)}`;
                window.open(url, '_blank');
                alert('✅ Kirim pesan ke admin. Jangan lupa update spreadsheet!');
            };
        }

        document.getElementById('btn-back-home-packed').onclick = () => showSection('landing');
    }

    // ============================================================
    // 12. HANDLE TRACKING
    // ============================================================
    async function handleTracking() {
        const noHp = document.getElementById('track-phone').value.trim();
        if (!noHp) {
            alert('Masukkan No HP!');
            return;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/track-order?phone=${encodeURIComponent(noHp)}`);
            const result = await response.json();
            const resultDiv = document.getElementById('tracking-result');
            if (!resultDiv) return;

            if (result.success && result.orders && result.orders.length > 0) {
                let html = '';
                result.orders.forEach(order => {
                    let status = order.shippingStatus || 'DIKEMAS';
                    let step = 1;
                    if (status === 'DIKIRIM') step = 2;
                    else if (status === 'DITERIMA') step = 3;
                    else if (status === 'MENUNGGU_PEMBAYARAN') step = 0;

                    html += `<div class="tracking-item">
                        <p><strong>Order ID:</strong> ${order.orderId}</p>
                        <p><strong>Resi:</strong> ${order.cnoteNo || '-'}</p>
                        <p><strong>Kurir:</strong> ${order.courierChoice || '-'}</p>
                        <p><strong>Total:</strong> Rp ${(order.totalPrice || 0).toLocaleString()}</p>
                        <div class="tracking-progress">
                            <div class="tracking-step ${step >= 1 ? 'done' : ''}">
                                <div class="step-icon"><i class="fas fa-box"></i></div>
                                <span class="step-label">Dikemas</span>
                            </div>
                            <div class="tracking-step ${step >= 2 ? 'done' : ''}">
                                <div class="step-icon"><i class="fas fa-truck"></i></div>
                                <span class="step-label">Dikirim</span>
                            </div>
                            <div class="tracking-step ${step >= 3 ? 'done' : ''}">
                                <div class="step-icon"><i class="fas fa-check-circle"></i></div>
                                <span class="step-label">Diterima</span>
                            </div>
                        </div>
                        ${step === 0 ? '<p style="color:#e65100;font-weight:bold;">⏳ Menunggu Pembayaran</p>' : ''}
                    </div>`;
                });
                resultDiv.innerHTML = html;
                resultDiv.style.display = 'block';
            } else {
                resultDiv.innerHTML = `<p style="color:red;">${result.message || 'Pesanan tidak ditemukan'}</p>`;
                resultDiv.style.display = 'block';
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    // ============================================================
    // 13. COUNTDOWN
    // ============================================================
    function startCountdown() {
        let totalSeconds = 1800;
        function updateTimer() {
            if (totalSeconds <= 0) totalSeconds = 1800;
            const m = Math.floor(totalSeconds / 60);
            const s = totalSeconds % 60;
            const timerEl = document.getElementById('countdown-timer');
            if (timerEl) {
                timerEl.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
            }
            totalSeconds--;
        }
        updateTimer();
        setInterval(updateTimer, 1000);
    }

    // ============================================================
    // 14. GIMMICKS
    // ============================================================
    function startGimmicks() {
        let sold = 10234;
        setInterval(() => {
            sold += Math.floor(Math.random() * 5) + 1;
            const counterEl = document.getElementById('sold-counter');
            if (counterEl) counterEl.textContent = sold.toLocaleString() + '+';
        }, 3000);

        const buyers = [
            { name: 'Ahmad Fauzi', city: 'Bandung' },
            { name: 'Dewi Sartika', city: 'Jakarta' },
            { name: 'Budi Santoso', city: 'Surabaya' },
            { name: 'Rina Anggraini', city: 'Medan' },
            { name: 'Fajar Ramadhan', city: 'Makassar' },
            { name: 'Nurul Hikmah', city: 'Yogyakarta' },
            { name: 'Agus Salim', city: 'Semarang' },
            { name: 'Siti Aisyah', city: 'Palembang' },
            { name: 'Andi Pratama', city: 'Balikpapan' },
            { name: 'Mega Lestari', city: 'Tangerang' },
        ];

        const timePhrases = ['baru saja', '1 menit lalu', '2 menit lalu', '3 menit lalu', '4 menit lalu', '5 menit lalu', '8 menit lalu', '10 menit lalu', '12 menit lalu', '15 menit lalu'];

        function showRandomPurchaseNotif() {
            const random = buyers[Math.floor(Math.random() * buyers.length)];
            const time = timePhrases[Math.floor(Math.random() * timePhrases.length)];
            const text = `${random.name} dari ${random.city} membeli produk ini ${time}`;
            const popup = document.getElementById('notification-popup');
            const notifText = document.getElementById('notif-text');
            if (popup && notifText) {
                notifText.textContent = text;
                popup.style.display = 'block';
                setTimeout(() => { popup.style.display = 'none'; }, 5000);
            }
        }

        function scheduleNextNotif() {
            const delay = Math.floor(Math.random() * 6000) + 4000;
            setTimeout(() => {
                showRandomPurchaseNotif();
                scheduleNextNotif();
            }, delay);
        }

        setTimeout(showRandomPurchaseNotif, 2000);
        scheduleNextNotif();

        const trustMessages = ['🔥 Stok Terbatas!', '💰 Garansi Uang Kembali 100%', '⭐ Ulasan 4.9/5', '📦 Pengiriman Cepat!', '✅ 100% Produk Asli'];
        let trustIndex = 0;

        function showTrustPopup() {
            const popup = document.getElementById('trust-popup');
            const content = document.getElementById('trust-content');
            if (popup && content) {
                content.innerHTML = '<i class="fas fa-check-circle" style="color:#25D366;"></i> ' + trustMessages[trustIndex % trustMessages.length];
                popup.style.display = 'block';
                setTimeout(() => { popup.style.display = 'none'; }, 4000);
                trustIndex++;
            }
        }

        setInterval(showTrustPopup, 10000);
        setTimeout(showTrustPopup, 3000);
    }

})();