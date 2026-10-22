# Kios Cek Saldo Santri (Smart Balance Kiosk)

Antarmuka UI/UX Kios Pengecekan Saldo Mandiri Santri berbasis **HTML, CSS murni, dan JavaScript**, dioptimalkan untuk display sentuh / desktop kiosk dengan integrasi langsung alat scan RFID fisik.

---

## 🎨 Spesifikasi Desain & Rule Pembaruan

1. **Palet Warna Baru**:
   - **Navy**: `#0B192C` & `#12233E` (kontras teks tinggi, tombol aksi, dan badge).
   - **Putih**: `#FFFFFF` (permukaan kartu utama dan display).
   - **Kuning Pastel**: `#FEF08A` & `#FEF9C3` (pelat penyorot nominal total saldo dan badge detik).
2. **Tanpa Box Shadow (Zero Box-Shadow)**:
   - Tidak ada `box-shadow` di seluruh tampilan (`box-shadow: none !important;`).
   - Pembeda elevasi murni menggunakan kontras warna permukaan bertingkat (*tonal surface layering*).
3. **Bebas Layout Shifting (Zero Layout Shift)**:
   - Wadah panggung kios menggunakan CSS Grid dengan dimensi yang terkunci (`width: 620px; height: 520px;`).
   - State 1 (*Waiting RFID*) dan State 2 (*Active Balance*) menempati sel grid yang sama persis (`grid-area: kiosk-screen;`).
   - Transisi state menggunakan *cross-fade* murni tanpa pergeseran atau lonjakan tinggi elemen.
4. **Waktu Tutup Cepat (3 Detik)**:
   - Durasi countdown dipersingkat menjadi **3 detik** dengan bar progres halus untuk menjaga keamanan privasi santri saat bergantian.
5. **Jam Kios Diperbesar & Lebih Berwarna**:
   - Menampilkan tanggal lokal Indonesia (`Kamis, 22 Okt 2026`).
   - Angka jam dan menit Navy tebal (`11:46`) dengan badge detik Kuning Pastel (`:35`).
6. **Input Alat Scan RFID Fisik**:
   - Mendukung hardware USB RFID / Barcode reader tipe *keyboard wedge* secara otomatis.
7. **Shortcut Rahasia Simulator `[Alt + S]`**:
   - Tidak ada tombol simulator di layar dan tidak ada pemberitahuan shortcut di UI (tampilan bersih untuk santri).
   - Pengelola/developer dapat menekan shortcut keyboard `[Alt + S]` untuk memunculkan konsol simulator dan pengujian API.
8. **Tanpa Suara, Tanpa Logo, Tanpa Footer**:
   - Audio synthesizer dihilangkan sepenuhnya.
   - Logo dan footer/kredit dihilangkan untuk fokus penuh pada pengecekan saldo.

---

## 🔌 Daftar ID Unik untuk API & Backend Fetch

| ID Elemen | Fungsi & Target Data |
|---|---|
| `kiosk-balance-amount` | Nominal angka saldo yang dihitung & di-split (contoh: `350.000`) |
| `kiosk-balance-currency` | Simbol mata uang (`Rp`) |
| `kiosk-user-name` | Nama lengkap santri |
| `kiosk-user-nis` | Nomor Induk Santri (`NIS: 202401089`) |
| `kiosk-user-class` | Kelas dan Asrama |
| `kiosk-account-status` | Status kartu tabungan (`Kartu Aktif`) |
| `kiosk-user-initials` | Inisial avatar profil (`AF`) |
| `kiosk-daily-limit` | Batas limit harian belanja saku |
| `kiosk-last-tap-time` | Label waktu tap terakhir |
| `kiosk-api-raw-balance` | Hidden input integer mentah saldo (`350000`) |
| `kiosk-api-card-uid` | Hidden input nomor UID kartu RFID (`STR-202401`) |
| `kiosk-api-santri-id` | Hidden input NIS/ID internal |

---

## 🛠️ Contoh Pemanggilan API (`window.SantriKioskAPI`)

```javascript
// Menembak data baru dari backend / middleware:
window.SantriKioskAPI.setSantriData({
  cardUid: 'RFID-9872134',
  name: 'Abdullah Azzam',
  balance: 750000,
  nis: '202403199',
  className: 'Kelas 12-IPA • Asrama Utsman',
  dailyLimit: 120000,
  status: 'Kartu Aktif'
});

// Reset manual kembali ke standby:
window.SantriKioskAPI.reset();
```
