// ============================================================
// SPRAY TIDUR — app.js
// ============================================================

(() => {
  const state = {
    config: null,
    qty: 1,
    selectedCourier: 'Direkomendasikan',
    selectedPaytype: 'COD', // default
    selectedChannel: null,
    voucherApplied: false,
    selectedArea: null,
    pollTimer: null,
  };

  const DISCOUNT_TIERS = { 1: 0, 2: 0.10, 3: 0.12, 4: 0.14, 5: 0.15 };
  const MAX_QTY = 5;

  const rupiah = (n) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function calcPricing(basePrice, qty) {
    const discountPercent = DISCOUNT_TIERS[qty] ?? 0;
    const pricePerPcs = Math.round(basePrice * (1 - discountPercent));
    return {
      qty, discountPercent,
      pricePerPcs,
      totalOriginal: basePrice * qty,
      totalDiscounted: pricePerPcs * qty,
    };
  }

  // ---------------------------------------------------------
  // Load config
  // ---------------------------------------------------------
  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      const json = await res.json();
      state.config = json.data;

      $('#product-name').textContent = state.config.productName;
      $('#product-desc').textContent = state.config.productDescription;

      const waAdmin = state.config.waAdminNumber || state.config.waNumber || '';
      $('#ask-admin-link').href = `https://wa.me/${waAdmin}?text=${encodeURIComponent('Halo min, saya mau tanya-tanya dulu soal Spray Tidur')}`;

      renderPaymentMethods();
      renderCourierOptions();
      updatePricing();
    } catch (e) {
      console.warn('Gagal load config, pakai default:', e);
      // fallback: render dengan default
      renderPaymentMethods();
      renderCourierOptions();
    }
  }

  // ---------------------------------------------------------
  // Render Metode Pembayaran (dengan icon box)
  // ---------------------------------------------------------
  function renderPaymentMethods() {
    const container = $('#payment-list');
    container.innerHTML = '';

    // Daftar metode pembayaran: COD, QRIS, 5 VA, Alfamart, Indomaret
    const methods = [
      { key: 'COD', kodeChannel: null, label: 'COD', icon: 'cod' },
      { key: 'QRIS', kodeChannel: 'QRIS_CUSTOM', label: 'QRIS', icon: 'qris' },
      { key: 'MANDIRI', kodeChannel: 'MANDIRI', label: 'Mandiri VA', icon: 'mandiri' },
      { key: 'BCA', kodeChannel: 'BCA', label: 'BCA VA', icon: 'bca' },
      { key: 'BNI', kodeChannel: 'BNI', label: 'BNI VA', icon: 'bni' },
      { key: 'BRI', kodeChannel: 'BRI', label: 'BRI VA', icon: 'bri' },
      { key: 'BSI', kodeChannel: 'BSI', label: 'BSI VA', icon: 'bsi' },
      { key: 'ALFAMART', kodeChannel: 'ALFAMART', label: 'Alfamart', icon: 'alfamart' },
      { key: 'INDOMARET', kodeChannel: 'INDOMARET', label: 'Indomaret', icon: 'indomaret' },
    ];

    // Jika state.selectedPaytype belum diset, set ke COD
    if (!state.selectedPaytype) state.selectedPaytype = 'COD';

    methods.forEach((m) => {
      const label = document.createElement('label');
      label.className = 'payment-item';
      if (m.key === state.selectedPaytype) label.classList.add('selected');

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'payment';
      radio.value = m.key;
      if (m.key === state.selectedPaytype) radio.checked = true;

      const iconBox = document.createElement('span');
      iconBox.className = 'icon-box';
      iconBox.innerHTML = `<img src="./assets/img/payment/${m.icon}.png" alt="${m.label}" onerror="this.parentElement.innerHTML='💳';">`;

      const span = document.createElement('span');
      span.textContent = m.label;

      label.appendChild(radio);
      label.appendChild(iconBox);
      label.appendChild(span);

      label.addEventListener('click', () => {
        state.selectedPaytype = m.key;
        state.selectedChannel = m.kodeChannel;
        $$('#payment-list .payment-item').forEach((el) => el.classList.remove('selected'));
        label.classList.add('selected');
        // Hapus error channel jika ada
        const err = $('#err-channel');
        if (err) err.classList.remove('show');
      });

      container.appendChild(label);
    });
  }

  // ---------------------------------------------------------
  // Render Kurir (dengan icon box)
  // ---------------------------------------------------------
  function renderCourierOptions() {
    const container = $('#courier-list');
    container.innerHTML = '';

    const couriers = [
      { key: 'Direkomendasikan', label: 'Direkomendasikan (JNT)', icon: 'jnt' },
      { key: 'JNT', label: 'JNT', icon: 'jnt' },
      { key: 'SiCepat', label: 'SiCepat', icon: 'sicepat' },
      { key: 'Sap', label: 'Sap', icon: 'sap' },
      { key: 'iDexpress', label: 'iDexpress', icon: 'idexpress' },
    ];

    if (!state.selectedCourier) state.selectedCourier = 'Direkomendasikan';

    couriers.forEach((c) => {
      const label = document.createElement('label');
      label.className = 'courier-item';
      if (c.key === state.selectedCourier) label.classList.add('selected');

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'courier';
      radio.value = c.key;
      if (c.key === state.selectedCourier) radio.checked = true;

      const iconBox = document.createElement('span');
      iconBox.className = 'icon-box';
      iconBox.innerHTML = `<img src="./assets/img/couriers/${c.icon}.png" alt="${c.label}" onerror="this.parentElement.innerHTML='🚚';">`;

      const span = document.createElement('span');
      span.textContent = c.label;

      label.appendChild(radio);
      label.appendChild(iconBox);
      label.appendChild(span);

      label.addEventListener('click', () => {
        state.selectedCourier = c.key;
        $$('#courier-list .courier-item').forEach((el) => el.classList.remove('selected'));
        label.classList.add('selected');
      });

      container.appendChild(label);
    });
  }

  // ---------------------------------------------------------
  // Qty & pricing
  // ---------------------------------------------------------
  function updatePricing() {
    if (!state.config) {
      // fallback: gunakan harga default 209000
      const basePrice = 209000;
      const p = calcPricing(basePrice, state.qty);
      updateUI(p, basePrice);
      return;
    }
    const p = calcPricing(state.config.productPrice, state.qty);
    updateUI(p, state.config.productPrice);
  }

  function updateUI(p, basePrice) {
    $('#qty-val').textContent = state.qty;
    $('#qty-plus').disabled = state.qty >= MAX_QTY;
    $('#qty-minus').disabled = state.qty <= 1;

    $('#price-final').textContent = rupiah(p.totalDiscounted);
    if (p.discountPercent > 0) {
      $('#price-strike').style.visibility = 'visible';
      $('#price-strike').textContent = rupiah(p.totalOriginal);
      $('#discount-chip').style.display = 'inline-block';
      $('#discount-chip').textContent = `Hemat ${Math.round(p.discountPercent * 100)}%`;
    } else {
      $('#price-strike').style.visibility = 'hidden';
      $('#discount-chip').style.display = 'none';
    }

    $('#summary-subtotal').textContent = rupiah(p.totalDiscounted);
    // shipping sudah diatur oleh voucher
    const shipping = state.voucherApplied ? 0 : 15000;
    const total = p.totalDiscounted + shipping;
    $('#summary-total').innerHTML = `<strong>${rupiah(total)}</strong>`;

    // sticky footer
    $('#footer-original').textContent = rupiah(p.totalOriginal);
    $('#footer-discount').textContent = rupiah(total);
    $('#sticky-price').textContent = rupiah(total);
    $('#sticky-strike').style.display = p.discountPercent > 0 ? 'block' : 'none';
    $('#sticky-strike').textContent = rupiah(p.totalOriginal);
  }

  // ---------------------------------------------------------
  // Qty control
  // ---------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function() {
    // QTY
    const btnMinus = document.getElementById('btn-minus');
    const btnPlus = document.getElementById('btn-plus');

    if (btnMinus) {
      btnMinus.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (state.qty > 1) {
          state.qty--;
          updatePricing();
        }
      });
    }

    if (btnPlus) {
      btnPlus.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (state.qty < MAX_QTY) {
          state.qty++;
          updatePricing();
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
        state.voucherApplied = !state.voucherApplied;
        this.classList.toggle('applied', state.voucherApplied);
        if (state.voucherApplied) {
          this.textContent = '✅ Voucher Gratis Ongkir Terpakai';
          $('#summary-shipping').innerHTML = '<span class="strike">Rp15.000</span> GRATIS';
        } else {
          this.textContent = '🎟️ Pakai Voucher Gratis Ongkir';
          $('#summary-shipping').textContent = 'Rp15.000';
        }
        updatePricing();
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

    // ===== TOMBOL LACAK =====
    const btnTrack = document.getElementById('btn-track');
    const btnTrackHeader = document.getElementById('btn-track-header');
    if (btnTrack) {
      btnTrack.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = './tracking.html';
      });
    }
    if (btnTrackHeader) {
      btnTrackHeader.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = './tracking.html';
      });
    }

    // ===== TRACKING SUBMIT (di landing) =====
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

    // ===== INIT =====
    loadConfig();
    startCountdown();
    startGimmicks();
  });

  // ---------------------------------------------------------
  // Search Kecamatan (FIX)
  // ---------------------------------------------------------
  function initSearchKecamatan() {
    const searchInput = document.getElementById('kecamatan-search');
    const resultsDiv = document.getElementById('kecamatan-results');

    if (!searchInput || !resultsDiv) return;

    let debounceTimer;

    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      const keyword = this.value.trim();
      if (keyword.length < 3) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.remove('active');
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/address-search?keyword=${encodeURIComponent(keyword)}`);
          const json = await res.json();
          if (json.success && json.data && json.data.length > 0) {
            resultsDiv.innerHTML = '';
            const seen = new Set();
            json.data.forEach(item => {
              const label = item.DISTRICT_NAME || item.SUBDISTRICT_NAME || '';
              if (label && !seen.has(label)) {
                seen.add(label);
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `
                  <div><strong>${label}</strong></div>
                  <div class="result-detail">${item.CITY_NAME || ''}, ${item.PROVINCE_NAME || ''} — ${item.ZIP_CODE || ''}</div>
                `;
                div.dataset.provinsi = item.PROVINCE_NAME || '';
                div.dataset.kabupaten = item.CITY_NAME || '';
                div.dataset.kecamatan = label;
                div.dataset.destinationId = item._id || '';
                div.addEventListener('click', function(e) {
                  e.stopPropagation();
                  // Isi hidden inputs
                  document.getElementById('provinsi').value = this.dataset.provinsi;
                  document.getElementById('kabupaten').value = this.dataset.kabupaten;
                  document.getElementById('kecamatan').value = this.dataset.kecamatan;
                  document.getElementById('destination-address-id').value = this.dataset.destinationId;
                  searchInput.value = this.dataset.kecamatan;
                  resultsDiv.innerHTML = '';
                  resultsDiv.classList.remove('active');
                  const errArea = document.getElementById('err-area');
                  if (errArea) errArea.classList.remove('show');
                });
                resultsDiv.appendChild(div);
              }
            });
            if (resultsDiv.children.length > 0) {
              resultsDiv.classList.add('active');
            } else {
              resultsDiv.innerHTML = '<div class="search-result-item" style="color:#999;">Tidak ditemukan</div>';
              resultsDiv.classList.add('active');
            }
          } else {
            resultsDiv.innerHTML = '<div class="search-result-item" style="color:#999;">Tidak ditemukan</div>';
            resultsDiv.classList.add('active');
          }
        } catch (err) {
          console.error('Error search kecamatan:', err);
          resultsDiv.innerHTML = `<div class="search-result-item" style="color:red;">Error: ${err.message}</div>`;
          resultsDiv.classList.add('active');
        }
      }, 300);
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.search-wrapper')) {
        resultsDiv.classList.remove('active');
      }
    });
  }

  // ---------------------------------------------------------
  // Show section
  // ---------------------------------------------------------
  const sections = {
    landing: document.getElementById('section-landing'),
    payment: document.getElementById('section-payment'),
    packed: document.getElementById('section-packed'),
    tracking: document.getElementById('section-tracking'),
  };

  function showSection(id) {
    Object.keys(sections).forEach(key => {
      if (sections[key]) {
        sections[key].classList.toggle('active', key === id);
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------------------------------------------------------
  // Handle Checkout
  // ---------------------------------------------------------
  async function handleCheckout() {
    const nama = document.getElementById('full-name').value.trim();
    const noHp = document.getElementById('phone').value.trim();
    const provinsi = document.getElementById('provinsi').value;
    const kabupaten = document.getElementById('kabupaten').value;
    const kecamatan = document.getElementById('kecamatan').value;
    const alamat = document.getElementById('alamat-lengkap').value.trim();
    const destId = document.getElementById('destination-address-id').value;

    const paymentMethod = state.selectedPaytype;
    const courierMethod = state.selectedCourier;

    // Validasi
    if (!nama) {
      alert('Nama lengkap wajib diisi!');
      return;
    }
    if (!noHp || noHp.length < 8) {
      alert('Nomor HP tidak valid!');
      return;
    }
    if (!kecamatan || !alamat || !destId) {
      alert('Harap pilih kecamatan dari daftar dan isi alamat lengkap!');
      return;
    }

    const qty = state.qty;
    const basePrice = state.config ? state.config.productPrice : 209000;
    const p = calcPricing(basePrice, qty);
    const subtotal = p.totalDiscounted;
    const shipping = state.voucherApplied ? 0 : 15000;
    const total = subtotal + shipping;
    const isCOD = (paymentMethod === 'COD');
    const weight = 0.15 * qty; // 150gr per pcs

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
      courierChoice: courierMethod,
      paymentType: isCOD ? 'COD' : 'NONCOD',
      paymentChannel: isCOD ? null : paymentMethod,
    };

    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Checkout gagal');

      // Simpan data untuk halaman packed
      window.currentOrderData = {
        orderId: json.orderId,
        nama: nama,
        noHp: noHp,
        totalHarga: total,
        kurir: courierMethod,
        metodeBayar: paymentMethod,
        resi: json.resi || '-',
        isCOD: isCOD,
      };

      if (isCOD) {
        showPackedPage(window.currentOrderData);
      } else {
        // NON-COD
        if (json.payment) {
          showPaymentPage(json.payment, window.currentOrderData);
        } else {
          alert('Gagal mendapatkan data pembayaran');
        }
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // ---------------------------------------------------------
  // Payment Page
  // ---------------------------------------------------------
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
    instr.innerHTML = html;
    statusDiv.innerHTML = `<p>Menunggu pembayaran... (auto-check setiap 5 detik)</p><div class="spinner"></div>`;
    waBtn.style.display = 'none';

    let pollCount = 0;
    const interval = setInterval(async () => {
      pollCount++;
      try {
        const res = await fetch(`/api/check-status?orderId=${orderData.orderId}`);
        const json = await res.json();
        if (json.success && json.paymentStatus === 'PAID') {
          clearInterval(interval);
          statusDiv.innerHTML = `<p style="color:#25D366;font-weight:bold;">✅ Pembayaran berhasil!</p>`;
          waBtn.style.display = 'inline-block';
          waBtn.onclick = () => {
            showPackedPage(orderData);
          };
        } else if (pollCount >= 60) {
          clearInterval(interval);
          statusDiv.innerHTML = `<p style="color:red;">⏰ Waktu habis. Jika sudah bayar, klik tombol di bawah.</p>`;
          waBtn.style.display = 'inline-block';
          waBtn.onclick = () => {
            showPackedPage(orderData);
          };
        }
      } catch (e) { console.warn(e); }
    }, 5000);

    document.getElementById('btn-back-home').onclick = () => showSection('landing');
  }

  // ---------------------------------------------------------
  // Packed Page
  // ---------------------------------------------------------
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
        const url = `https://wa.me/6281932696934?text=${encodeURIComponent(pesanAdmin)}`;
        window.open(url, '_blank');
        alert('✅ Kirim pesan ke admin. Jangan lupa update spreadsheet!');
      };
    }

    document.getElementById('btn-back-home-packed').onclick = () => showSection('landing');
  }

  // ---------------------------------------------------------
  // Tracking di landing
  // ---------------------------------------------------------
  async function handleTracking() {
    const noHp = document.getElementById('track-phone').value.trim();
    if (!noHp) {
      alert('Masukkan No HP!');
      return;
    }

    try {
      const res = await fetch(`/api/track-order?phone=${encodeURIComponent(noHp)}`);
      const json = await res.json();
      const resultDiv = document.getElementById('tracking-result');
      if (!resultDiv) return;

      if (json.success && json.orders && json.orders.length > 0) {
        let html = '';
        json.orders.forEach(order => {
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
        resultDiv.innerHTML = `<p style="color:red;">${json.message || 'Pesanan tidak ditemukan'}</p>`;
        resultDiv.style.display = 'block';
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // ---------------------------------------------------------
  // Countdown
  // ---------------------------------------------------------
  function startCountdown() {
    let totalSeconds = 1800;
    function updateTimer() {
      if (totalSeconds <= 0) totalSeconds = 1800;
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      const timerEl = document.getElementById('countdown-timer');
      if (timerEl) timerEl.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      totalSeconds--;
    }
    updateTimer();
    setInterval(updateTimer, 1000);
  }

  // ---------------------------------------------------------
  // Gimmicks
  // ---------------------------------------------------------
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
      { name: 'Rudi Hartono', city: 'Bogor' },
      { name: 'Lisa Permata', city: 'Malang' },
      { name: 'Doni Saputra', city: 'Pekanbaru' },
      { name: 'Winda Sari', city: 'Denpasar' },
      { name: 'Hendra Wijaya', city: 'Manado' },
      { name: 'Rizky Amelia', city: 'Banjarmasin' },
      { name: 'Gilang Nugroho', city: 'Pontianak' },
      { name: 'Diana Putri', city: 'Jambi' },
      { name: 'Eko Prasetyo', city: 'Lampung' },
      { name: 'Maya Sari', city: 'Padang' },
      { name: 'Irfan Hakim', city: 'Aceh' },
      { name: 'Tiara Maharani', city: 'Kupang' },
      { name: 'Arif Rahman', city: 'Jayapura' },
      { name: 'Laila Fitria', city: 'Mataram' },
      { name: 'Rizki Maulana', city: 'Sorong' },
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

  // ===== EXPOSE untuk debugging =====
  window.showSection = showSection;
})();
