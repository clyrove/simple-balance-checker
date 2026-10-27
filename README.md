# Balance Check Kiosk

Aplikasi antarmuka web mandiri untuk pengecekan saldo santri.

## Struktur Proyek

```text
balance-check-kiosk/
├── index.html            # Antarmuka utama kios
├── README.md             # Panduan struktur proyek
├── css/
│   ├── tokens.css        # Desain token dan variabel gaya
│   ├── style.css         # Tata letak tampilan dan antarmuka
│   └── kiosk-extra.css   # Penyesuaian tampilan status
├── js/
│   ├── kiosk-config.js   # Konfigurasi aplikasi
│   ├── kiosk-lock.js     # Pengontrol interaksi perangkat
│   ├── kiosk-api.js      # Layanan pertukaran data
│   └── app.js            # Logika pengontrol tampilan
├── tools/
│   ├── disable-windows-key.reg  # Pengunci tombol Windows level OS
│   └── enable-windows-key.reg   # Pemulih tombol Windows level OS
└── vendor/
    ├── gsap.min.js       # Pustaka animasi
    └── remixicon/        # Ikonografi
```

## Panduan Menjalankan

1. Buka berkas `index.html` menggunakan peramban web modern atau jalankan melalui web server lokal.
2. Pastikan perangkat pembaca kartu terhubung ke peramban.
