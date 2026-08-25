# Janji Jus v2 — Landing Page + Checkout + Tracking

> **Update terbaru:** perbaikan bug pembayaran VA/Retail yang salah buka tab kosong, voucher gratis ongkir sekarang benar-benar toggle, dan metode pembayaran + kurir ditampilkan flat semua dengan slot logo di kiri teks. **Revisi lanjutan:** status "Dikemas" sekarang gak lagi muncul untuk pesanan Non-COD yang belum dibayar (jadi "Menunggu Pembayaran" dulu), tombol kembali di halaman tracking disesuaikan konteks, testimoni jadi 5 (campur foto/tanpa foto), nama notifikasi gimmick 2 kata dengan sensor bintang, dan tombol WA pakai ikon asli (bukan emoji). **Tidak perlu import ulang template spreadsheet** — struktur kolomnya sama persis, cuma cara baca statusnya yang diperbaiki di kode.

Versi rombak dari project sebelumnya. Perubahan besar dari v1:

1. **Alur pembayaran Non-COD diganti** — sekarang pembeli diarahkan langsung ke **halaman resmi Cashi** (`checkout_url`) untuk bayar, bukan bikin tampilan QR/VA sendiri. Ini memperbaiki bug nominal yang beda (karena Cashi kadang menambahkan pajak/biaya di halaman mereka yang tidak selalu sama dengan hasil hitungan API `create-order`). Dengan redirect ke halaman asli, nominal yang dilihat pembeli **selalu 100% akurat**.
2. **Desain landing page dirombak total** — gaya "gimmick COD" (putih + hijau, badge urgency, countdown, notifikasi gimmick, dll) sesuai referensi yang kamu kasih.
3. **Diskon bertingkat otomatis** — beli 2pcs -10%, 3pcs -12%, 4pcs -14%, 5pcs -15% (maksimal 5pcs).
4. **Halaman Pelacakan Pesanan** baru (`tracking.html`) — cari pakai nomor HP, progress bar Dikemas → Dikirim → Diterima.
5. **Update status pengiriman manual lewat 2 checkbox** di spreadsheet (`sudah_dikirim`, `sudah_diterima`) — tidak perlu dashboard admin terpisah.
6. **Template spreadsheet baru** disediakan di folder `template/` — tinggal import, sudah include validasi TRUE/FALSE, warna, lebar kolom pas, dan tab "Panduan".

---

## 1. Struktur Folder

```
janji-jus-v2/
├── public/
│   ├── index.html              ← landing page + form checkout
│   ├── tracking.html           ← halaman lacak pesanan
│   └── assets/
│       ├── css/style.css
│       ├── js/app.js           ← logic landing page
│       ├── js/tracking.js      ← logic halaman tracking
│       └── img/                ← KOSONG, taruh foto produk & favicon di sini (lihat bagian 5)
│
├── api/
│   ├── config.js                → GET  /api/config
│   ├── address-search.js        → GET  /api/address-search
│   ├── create-order.js          → POST /api/create-order
│   ├── check-status.js          → GET  /api/check-status
│   ├── track-order.js           → GET  /api/track-order      (BARU — cari pesanan by no. HP)
│   ├── cashi-webhook.js         → POST /api/cashi-webhook
│   └── lib/
│       ├── mengantar.js
│       ├── cashi.js             (disederhanakan, tanpa logic koreksi fee lagi)
│       ├── sheets.js            (skema kolom baru + checkbox manual)
│       └── pricing.js           (BARU — hitung diskon bertingkat)
│
├── template/
│   └── janji-jus-database-template.xlsx   ← import ini ke Google Sheets kamu
│
├── package.json, vercel.json, .gitignore, .env.example
└── README.md
```

---

## 2. Alur Sistem (v2)

**COD:**
1. Checkout → backend langsung buat order Mengantar (`dropOff`, COD = total setelah diskon).
2. Pembeli langsung diarahkan ke **halaman Tracking** (`tracking.html?order=...`), status: **Dikemas**.

**Non-COD:**
1. Checkout → backend buat transaksi Cashi.
2. Halaman **langsung menampilkan cara bayar** sesuai metode yang dipilih pembeli:
   - **QRIS** → tampil kode QR untuk di-scan.
   - **Transfer Bank (VA)** → tampil nomor Virtual Account + nama bank.
   - **Alfamart/Indomaret** → tampil kode pembayaran retail.
3. Halaman polling status tiap 4 detik (tanpa refresh manual).
4. Setelah Cashi kirim webhook `PAYMENT_SETTLED` → backend update sheet jadi PAID + buat order Mengantar + simpan resi.
5. Halaman otomatis redirect ke **Tracking**, status: **Dikemas** (dengan resi sudah terisi).

> Catatan: cuma metode **QRIS** yang punya halaman resmi (`checkout_url`) dari Cashi. VA & Retail **tidak** menyediakan halaman resmi — makanya untuk metode itu kita tampilkan nomor VA / kode bayarnya langsung di web kita sendiri (bukan redirect keluar).

**Update status pengiriman:** buka spreadsheet → tab **Orders** → ubah kolom `sudah_dikirim` jadi `TRUE` setelah drop paket ke ekspedisi, dan `sudah_diterima` jadi `TRUE` setelah kamu pastikan paket sampai. Halaman tracking pembeli otomatis mengikuti 2 kolom ini.

---

## 3. Setup (urutkan sesuai nomor)

### A. Import Template Spreadsheet

1. Buka [sheets.google.com](https://sheets.google.com) → **File → Import** → upload `template/janji-jus-database-template.xlsx` dari folder ini.
2. Pilih **"Insert new sheet(s)"** saat import (supaya jadi spreadsheet baru, bukan menimpa yang lama).
3. Setelah terimport, pastikan ada 2 tab: **Orders** (data) dan **Panduan** (cara pakai). Baca tab Panduan-nya.
4. Hapus baris contoh (baris ke-2 di tab Orders) kalau tidak diperlukan.
5. Salin **Sheet ID** dari URL:
   `https://docs.google.com/spreadsheets/d/`**`SHEET_ID_NYA`**`/edit`

### B. Service Account Google (kalau belum ada dari sebelumnya, bisa pakai yang lama)

Kalau kamu sudah punya Service Account dari setup sebelumnya (`marketer@...iam.gserviceaccount.com`), tinggal:
1. Buka spreadsheet baru hasil import tadi → tombol **Share/Bagikan** → tambahkan email service account itu sebagai **Editor**.
2. Kalau belum pernah bikin sama sekali, ikuti panduan lengkap di Google Cloud Console (Enable Google Sheets API → buat Service Account → download JSON key → ambil `client_email` & `private_key`).

### C. Setup Alamat Pickup di Mengantar

Kalau kamu sudah setup di project sebelumnya, `MENGANTAR_PICKUP_ADDRESS_ID` yang sama masih berlaku, tinggal salin lagi ke project baru ini.

### D. Push ke GitHub & Deploy ke Vercel

1. Buat repo baru (atau pakai yang lama, replace isinya) → push folder ini.
2. Import ke Vercel, isi **semua** Environment Variables dari `.env.example` dengan nilai asli.
3. Deploy, lalu **Redeploy** setelah env terisi lengkap.
4. Domain diarahkan sama seperti sebelumnya (DNS di Sumopod).

### E. Update Webhook URL di Cashi

Buka dashboard Cashi → menu **Webhooks** → pastikan Webhook URL-nya:
```
https://NAMA-DOMAIN-KAMU/api/cashi-webhook
```
(alamatnya sama kayak sebelumnya, gak berubah — cuma dipastikan lagi karena project di-deploy ulang)

---

## 4. Cara Cek Webhook Kalau Bermasalah (langkah demi langkah)

Ini jawaban dari pertanyaanmu sebelumnya soal cara cek webhook:

1. Buka **Vercel Dashboard** → project kamu.
2. Klik tab **Deployments** di sidebar kiri.
3. Klik deployment yang paling atas (yang aktif sekarang, biasanya ada label "Production").
4. Di halaman deployment itu, cari tab/menu **"Functions"** atau **"Logs"** (posisinya biasanya di bagian atas halaman detail deployment).
5. Di situ akan ada daftar log dari setiap function yang pernah dipanggil, termasuk `cashi-webhook`.
6. Coba lakukan 1x pembayaran QRIS nominal kecil (misal Rp2.000) sambil halaman Logs ini dibiarkan terbuka di tab lain.
7. Setelah bayar, refresh halaman Logs — kalau webhook berhasil masuk, akan muncul baris log baru dari `cashi-webhook` dalam beberapa detik. Kalau baris itu **tidak muncul sama sekali**, berarti Cashi memang belum berhasil mengirim webhook ke server kamu (biasanya karena Webhook URL di dashboard Cashi belum diisi/salah). Kalau **muncul tapi statusnya error** (401/500), klik baris itu untuk lihat detail pesan errornya.

Kalau masih bingung di langkah manapun, screenshot halaman Logs-nya dan kirim ke saya.

---

## 5. Foto Produk & Logo/Ikon (kamu isi sendiri)

Taruh file-file berikut di `public/assets/img/` dengan **nama file persis seperti di bawah** (huruf kecil semua), format `.png` (background transparan lebih bagus):

**Foto produk & favicon** — langsung di `public/assets/img/`:
- `product-main.jpg` — foto utama produk
- `favicon.ico` — ikon tab browser

**Logo metode pembayaran** — di `public/assets/img/payment/`:
```
cod.png       qris.png      mandiri.png   bca.png
bni.png       bri.png       bsi.png       alfamart.png
indomaret.png
```

**Logo kurir** — di `public/assets/img/couriers/`:
```
recommended.png   jnt.png   sicepat.png   sap.png   idexpress.png
```

**Ikon WhatsApp** — langsung di `public/assets/img/`:
```
wa-icon.png
```
(dipakai di tombol "Tanya Admin" pada landing page & tombol "Chat Admin" di halaman tracking)

**Foto testimoni** (opsional) — di `public/assets/img/testimoni/`:
```
testi-2.jpg   testi-4.jpg
```
(2 dari 5 testimoni pakai foto asli kalau file ini ada, sisanya tetap avatar inisial huruf — sesuai campuran yang diminta)

Kalau salah satu file belum ada / belum diupload, otomatis muncul ikon emoji placeholder (🚚 untuk kurir, 💳 untuk pembayaran, tetes jus untuk foto produk) — jadi gak akan error atau kosong, tinggal ganti kapan saja filenya sudah siap tanpa perlu ubah kode.

---

## 6. Fitur Gimmick yang Ditambahkan

- **Badge urgency**: "Sisa 23 stok hari ini" & "10.482+ Terjual" (statis, bisa kamu edit manual di `public/index.html`).
- **Countdown gratis ongkir**: loop 10 menit terus-menerus (ongkir aslinya memang selalu gratis, ini murni gimmick urgency).
- **Notifikasi pembelian palsu**: nama & kota random muncul bergantian tiap ±10 detik. Daftar nama/kota bisa diedit di `public/assets/js/app.js` bagian `FAKE_NAMES` / `FAKE_CITIES`.
- **Diskon bertingkat** otomatis sesuai qty (lihat bagian 2).
- **Voucher gratis ongkir**: tombol kosmetik yang mencoret Rp15.000 jadi GRATIS (ongkir memang sudah gratis dari awal, ini cuma efek visual).
- **Sticky bottom bar**: muncul begitu discroll, isinya harga + tombol cepat ke form checkout.
- **Trust badges**: "Bisa COD", "Gratis Ongkir", "Garansi Kirim".
- **Tombol Tanya Admin (WA)** di dekat tombol checkout.
- **FAQ accordion** & testimoni.

---

## 7. Catatan Penting

- **Kode channel VA gabungan**: tombol "Transfer Bank" di landing page akan expand jadi 5 pilihan bank (Mandiri/BCA/BNI/BRI/BSI) sesuai permintaanmu.
- **Kurir**: "Direkomendasikan" dan "JNT" sekarang sama-sama muncul sebagai pilihan terpisah, tapi keduanya mengirim value yang sama ke Mengantar (`JT`).
- **Rotasi API Key**: kalau `Cashi API error (403)` masih muncul, pastikan `CASHI_API_KEY` di Vercel adalah key **yang paling baru/aktif** dari dashboard Cashi (bisa jadi sudah pernah di-generate ulang).
- Limit Vercel Hobby (gratis): cukup untuk skala uji coba/UMKM kecil-menengah.

Kalau ada error waktu deploy/testing, kirim pesan error atau screenshot-nya, saya bantu telusuri.
