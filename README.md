# Kios Cek Saldo Santri (Smart Balance Kiosk) – Al-Wafi

Antarmuka UI/UX Kios Pengecekan Saldo Mandiri Santri berbasis **HTML, CSS murni, dan JavaScript Native**, dioptimalkan untuk display sentuh / kiosk rasio **16:9 landscape (1920x1080)** dengan integrasi langsung alat scan RFID fisik dan backend API `api/lookup.php`.

---

## 🌟 Fitur Utama & Keunggulan Arsitektur

1. **Central Configuration System (`js/kiosk-config.js`)**:
   - **Satu Tempat untuk Semua Konfigurasi**: Kecepatan animasi, kurva easing GSAP, palet warna (*background, foreground, accent, highlight, error, info, success, text, border*), ukuran elemen (*sizes*), durasi timer privasi, dan endpoint API semuanya diatur di file `js/kiosk-config.js`.
   - Mengubah nilai di `kiosk-config.js` otomatis menyinkronkan CSS variables secara *real-time*.
2. **Integrasi Backend API Riil (`api/lookup.php`)**:
   - Terhubung langsung via HTTP `POST` dengan parameter `wallet=<UID>`.
   - Dilengkapi **Micro-Cache In-Memory (5 Detik)** untuk mencegah request jaringan berulang jika kartu santri di-tap cepat dua kali.
   - Proteksi **Timeout & AbortController** (6 detik) agar tidak terjadi race condition saat antrean padat.
   - **Offline / Mock Fallback**: Jika server offline atau kiosk dibuka secara lokal tanpa jaringan, sistem otomatis beralih ke mode simulasi tanpa error/crash.
3. **Interaksi Cepat & Responsif (Fast GSAP Rolling Counter 0.4s)**:
   - Durasi animasi hitung saldo dipersingkat menjadi **0.4 detik** (*snappy*), memastikan antrean santri di kantin/koperasi bergerak sangat cepat tanpa kehilangan estetika *split text character bounce*.
4. **Pemberitahuan Status Mengambang (Floating Toast)**:
   - Notifikasi elegan berposisi fixed di bawah layar untuk status `info` (*"Membaca kartu..."*), `error` (*"Kartu tidak terdaftar. Silakan hubungi petugas"*), dan `success`.
   - Tidak menggeser tata letak kiosk sama sekali (*Zero Layout Shift*).
5. **Masking Nomor Kartu RFID (Password-Style)**:
   - Nomor kartu santri disamarkan: hanya **2 digit terakhir** yang ditampilkan (`ID: •••• ••72`).
6. **Limit Belanja Fleksibel**:
   - Mendukung format limit bulanan santri (`limitBulanan`) atau saldo mengendap minimal (`limitSaldo`), serta fallback `Tanpa limit`.
7. **Bebas Layout Shifting (Zero Layout Shift)**:
   - Wadah panggung kartu dikunci dalam CSS Grid bertumpuk (`grid-area: kiosk-screen;` dengan ukuran `width: clamp(860px, 58vw, 980px); height: clamp(580px, 68vh, 660px);`).
8. **Kepatuhan Desain Ketat**:
   - **Zero 1px Border**: Tidak ada border 1px (`border: 0 !important;`).
   - **Zero Box-Shadow**: Elevasi murni melalui kontras warna permukaan bertingkat.
   - **Letter-Spacing Ketat**: Maksimal `-0.02em` hingga `-0.055em` (tidak ada nilai positif).
   - **Corner Shape Squircle**: Sudut kurvatur organik khas Apple / M3.
9. **Kemandirian Penuh (100% Offline Ready)**:
   - Seluruh aset vendor (`vendor/gsap.min.js`, `vendor/remixicon/`) tersimpan secara lokal dan otomatis menyediakan fallback CDN jika dibutuhkan.

---

## 🗂️ Struktur Berkas & Panduan Maintainability

```text
balance-check-kiosk/
├── index.html            # Halaman utama kiosk (Semantic HTML5, ARIA labels lengkap)
├── README.md             # Panduan dokumentasi lengkap
├── css/
│   ├── tokens.css        # Desain token, CSS Custom Properties & skala squircle
│   └── style.css         # Styling display 16:9, grid bertumpuk, toast, modal
├── js/
│   ├── kiosk-config.js   # PUSAT KONFIGURASI (Warna, Kecepatan, Ukuran, Timeout, API)
│   ├── kiosk-api.js      # API Service, Micro-Cache, Driver Scanner RFID USB
│   └── app.js            # Jam real-time, Animasi GSAP, Timer 3s, Toast Controller
└── vendor/
    ├── gsap.min.js       # GSAP Library lokal
    └── remixicon/        # Font & icon pack Remix Icon lokal
```

---

## ⚙️ Mengubah Konfigurasi di `js/kiosk-config.js`

Semua konfigurasi diatur dalam objek `window.KIOSK_CONFIG`:

```javascript
// Contoh: Mengubah kecepatan animasi saldo menjadi lebih lambat / cepat
KIOSK_CONFIG.animation.counterSpeed = 0.5; // dalam detik

// Contoh: Mengubah warna background atau accent kuning
KIOSK_CONFIG.colors.background = '#EAF0F7';
KIOSK_CONFIG.colors.accent = '#FEF08A';

// Contoh: Mengubah durasi auto-close privasi
KIOSK_CONFIG.timing.autoCloseSeconds = 5; // 5 detik

// Contoh: Mengubah endpoint server backend
KIOSK_CONFIG.api.endpoint = 'https://ceksaldo.al-wafi.sch.id/api/lookup.php';
```

---

## 🔌 Integrasi API Backend (`api/lookup.php`)

### Parameter Request:
* **Metode:** `POST`
* **Content-Type:** `application/x-www-form-urlencoded`
* **Body:** `wallet=<NOMOR_UID_RFID>` (contoh: `wallet=104928172`)

### Format Response Sukses (HTTP 200):
```json
{
  "success": true,
  "data": {
    "cardUid": "104928172",
    "name": "Ahmad Fauzi Ridwan",
    "nis": "202401089",
    "className": "Kelas 10-A • Asrama Abu Bakar",
    "balance": 350000,
    "limitBulanan": 500000,
    "limitSaldo": 0,
    "status": "Kartu Aktif",
    "accountType": "Saldo Wallet",
    "initials": "AF"
  }
}
```

### Format Response Gagal (HTTP 404 / 400):
```json
{
  "success": false,
  "code": "not_found",
  "message": "Kartu tidak terdaftar. Silakan hubungi petugas."
}
```

---

## 🕹️ Pintasan Pengembang & Pengujian

* **Shortcut Simulator `[Alt + S]`**:
  Tekan `Alt + S` pada keyboard untuk membuka modal simulator rahasia. Tersedia opsi:
  - **Cek ke Server API**: Menembak langsung nomor UID ke endpoint `api/lookup.php`.
  - **Terapkan Mock**: Mengisi form simulasi saldo secara manual.
  - **Reset Standby**: Mengembalikan kiosk ke layar tunggu.
