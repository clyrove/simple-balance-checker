# Kios Cek Saldo Santri (Smart Balance Kiosk) – Al-Wafi

Antarmuka UI/UX Kios Pengecekan Saldo Mandiri Santri berbasis **HTML, CSS murni, dan JavaScript Native**, dioptimalkan khusus untuk display sentuh / kiosk rasio **16:9 landscape (1920x1080)** dengan integrasi langsung alat scan RFID fisik, backend API `api/lookup.php`, serta proteksi penguncian keyboard santri.

---

## 🌟 Fitur Utama & Pembaruan Sistem

1. **Pusat Pesan & Konfigurasi Lengkap (`js/kiosk-config.js`)**:
   - Seluruh pesan status **sukses, error, info, warning**, dan pesan fallback disatukan dalam objek `KIOSK_CONFIG.messages`.
   - Seluruh rujukan kata *"petugas"* telah diubah menjadi **"tim IT"** (contoh: *"Kartu tidak terdaftar. Silakan hubungi tim IT."*).
   - Seluruh pengaturan kecepatan animasi GSAP, warna (*background, foreground, accent, highlight, error, info, success, text, border*), dan ukuran elemen (*sizes*) terpusat di file ini.
2. **Dua Limit Belanja (Limit Harian & Limit Bulanan)**:
   - Menampilkan dua limit secara terpisah:
     - **Limit Harian**: `data.limitHarian` / `data.dailyLimit` (contoh: `Rp 100.000 / hari`).
     - **Limit Bulanan**: `data.limitBulanan` / `data.monthlyLimit` (contoh: `Rp 500.000 / bulan`).
   - **Bebas Error jika Nilai Kosong**: Jika backend API tidak mengirimkan nilai limit (bernilai `null`, `undefined`, `0`, atau kosong), sistem secara anggun menampilkan **"Tidak ada data"** tanpa memunculkan error konsol.
3. **Pengunci Kios, Layar Penuh & Blokir Mouse (`js/kiosk-lock.js`)**:
   - **Force Fullscreen & Kunci Fullscreen**: Kios otomatis memaksa mode layar penuh (*Fullscreen/F11*) dan menguncinya. Santri tidak dapat keluar dari layar penuh menggunakan tombol `Esc` atau `F11`.
   - **Blokir Seluruh Klik Tombol Mouse**: Seluruh klik tombol mouse (kiri, kanan, tengah, drag, dan menu klik kanan) dinonaktifkan total saat kios terkunci.
   - **Kursor Mouse Disembunyikan**: Kursor mouse disembunyikan secara otomatis (`cursor: none !important;`) untuk display kiosk.
   - **Blokir Total Keyboard Santri**: Menonaktifkan seluruh tombol fisik keyboard laptop/kios agar santri tidak dapat mengetik sembarangan atau menekan shortcut berbahaya (F5, F11, Ctrl+R, Alt+Tab, dll.).
   - **Tetap Izinkan Scanner RFID**: Karakter cepat dari hardware reader RFID USB tetap dibaca secara otomatis.
   - **Shortcut Rahasia Buka Kunci `[Alt + O]`**:
     - Untuk membuka keyboard, memunculkan kursor, dan mengaktifkan kembali kontrol mouse & jendela (saat pemeliharaan oleh tim IT), cukup tekan kombinasi tombol **`Alt + O`**.
     - Tekan **`Alt + O`** kembali untuk mengunci kios dan mengaktifkan kembali layar penuh otomatis.
4. **Integrasi Backend API Riil (`api/lookup.php`)**:
   - Terhubung via HTTP `POST` dengan parameter `wallet=<UID>`.
   - Dilengkapi **Micro-Cache In-Memory (5 Detik)** untuk merespons instan (0 ms) jika santri menempelkan kartu dua kali berturut-turut.
   - Proteksi **Timeout & AbortController** (6 detik).
   - **Offline / Mock Fallback**: Otomatis beralih ke simulasi lokal jika jaringan terputus.
5. **Animasi Cepat & Responsif (GSAP 0.4s)**:
   - Durasi rolling counter dipersingkat ke **0.4 detik** (*snappy*) agar antrean santri bergerak lancar.
6. **Masking Nomor Kartu RFID (Password-Style)**:
   - Nomor kartu santri disamarkan: hanya **2 digit terakhir** yang ditampilkan (`ID: •••• ••72`).
7. **Bebas Layout Shifting (Zero Layout Shift)**:
   - Menggunakan panggung CSS Grid bertumpuk dengan dimensi terkunci.
8. **Kepatuhan Desain Ketat**:
   - **Zero 1px Border**: `border: 0 !important;`.
   - **Zero Box-Shadow**: Elevasi warna murni.
   - **Letter-Spacing Ketat**: Maksimal `-0.02em` hingga `-0.055em`.
   - **Corner Shape Squircle**: Kurvatur continuous khas Apple / M3.

---

## 🗂️ Struktur Berkas Proyek

```text
balance-check-kiosk/
├── index.html            # Halaman utama kiosk (Semantic HTML5, ARIA labels lengkap)
├── README.md             # Panduan dokumentasi lengkap
├── css/
│   ├── tokens.css        # Desain token, CSS Custom Properties & skala squircle
│   ├── style.css         # Styling display 16:9, grid bertumpuk, toast, cursor lock
│   └── kiosk-extra.css   # Override keamanan & kestabilan posisi toast mengambang
├── js/
│   ├── kiosk-config.js   # PUSAT KONFIGURASI (Pesan Error/Sukses, Warna, Animasi, Ukuran, API)
│   ├── kiosk-lock.js     # PENGUNCI KEAMANAN (Blokir Keyboard Santri, Sembunyikan Kursor, Alt + O)
│   ├── kiosk-api.js      # API Service, Micro-Cache, Format 2 Limit, Driver RFID USB
│   └── app.js            # Jam real-time, Animasi GSAP, Timer 3s, Toast Controller
└── vendor/
    ├── gsap.min.js       # GSAP Library lokal (100% offline ready)
    └── remixicon/        # Font & icon pack Remix Icon lokal
```

---

## 🔐 Panduan Pintasan Keyboard untuk Tim IT

| Shortcut | Fungsi | Keterangan |
|---|---|---|
| **`Alt + O`** | **Buka / Kunci Kios** | Memunculkan / menyembunyikan kursor mouse dan mengaktifkan / menonaktifkan ketikan keyboard laptop. |
| **`Alt + S`** | **Simulator RFID & API** | Membuka konsol pengujian API dan mock data. *(Hanya dapat dibuka jika kios sudah di-unlock via `Alt + O`)*. |

---

## ⚙️ Mengubah Pesan & Konfigurasi di `js/kiosk-config.js`

Semua pesan status dan error diatur pada bagian `KIOSK_CONFIG.messages`:

```javascript
KIOSK_CONFIG.messages = {
  // Pesan Error
  cardNotRegistered: 'Kartu tidak terdaftar. Silakan hubungi tim IT.',
  invalidCard: 'Nomor kartu tidak valid. Silakan hubungi tim IT.',
  networkError: 'Tidak dapat menghubungi server. Periksa koneksi atau hubungi tim IT.',
  timeoutError: 'Koneksi ke server timeout. Silakan coba lagi atau hubungi tim IT.',
  generalError: 'Gagal memeriksa saldo. Silakan hubungi tim IT.',

  // Pesan Nilai Kosong
  noData: 'Tidak ada data',

  // Pesan Kunci Kios
  kioskLocked: 'Kios Terkunci: Keyboard dinonaktifkan & kursor disembunyikan.',
  kioskUnlocked: 'Mode Pemeliharaan IT: Keyboard & kursor diaktifkan. (Tekan Alt + O untuk mengunci kembali)'
};
```

---

## 🔌 Format Response Payload API Backend (`api/lookup.php`)

```json
{
  "success": true,
  "data": {
    "cardUid": "104928172",
    "name": "Ahmad Fauzi Ridwan",
    "nis": "202401089",
    "className": "Kelas 10-A • Asrama Abu Bakar",
    "balance": 350000,
    "limitHarian": 100000,
    "limitBulanan": 500000,
    "status": "Kartu Aktif",
    "accountType": "Saldo Wallet",
    "initials": "AF"
  }
}
```
*Catatan: Jika `limitHarian` atau `limitBulanan` bernilai `null`, `0`, atau tidak ada di respon server, layar otomatis menampilkan `"Tidak ada data"` tanpa terjadi error.*
