/**
 * ============================================================================
 * KIOSK CENTRAL CONFIGURATION (SATU TEMPAT UNTUK SEMUA PENGATURAN)
 * ============================================================================
 * File ini dirancang agar SANGAT MUDAH DIBACA & DIUBAH oleh:
 * - Junior Developer
 * - Tim IT / Sysadmin Pesantren
 * - Orang awam yang ingin mengubah warna, teks, kecepatan animasi, dll.
 *
 * Seluruh nilai di sini akan otomatis disinkronkan ke CSS Variables & JavaScript!
 * ============================================================================
 */

(function (window) {
  'use strict';

  const KIOSK_CONFIG = {
    // ------------------------------------------------------------------------
    // 1. PENGATURAN ANIMASI (Kecepatan & Jenis Kurva Animasi GSAP)
    // ------------------------------------------------------------------------
    animation: {
      // Kecepatan putaran counter saldo (dalam detik). 0.4s = cepat & responsif
      counterSpeed: 0.4,
      // Jenis kurva easing untuk counter saldo (power1.out, power2.out, power3.out, none)
      counterEasing: 'power2.out',

      // Kecepatan animasi huruf melenting (split text character bounce)
      splitBounceSpeed: 0.35,
      // Jenis kurva easing untuk efek pantul karakter
      splitBounceEasing: 'back.out(2)',

      // Kecepatan transisi layar (cross-fade antara standby & tampilan saldo)
      stateCrossFadeSpeed: 0.18,
      stateCrossFadeEasing: 'power2.out',

      // Kecepatan animasi kemunculan nama santri
      userNameRevealSpeed: 0.25,
      userNameRevealEasing: 'power2.out',

      // Kecepatan animasi radar gelombang scanner RFID di layar tunggu
      radarPulseSpeed: 2.8,
      radarPulseEasing: 'cubic-bezier(0.25, 1, 0.5, 1)'
    },

    // ------------------------------------------------------------------------
    // 2. PALET WARNA (Colors & Semantic Tones)
    // ------------------------------------------------------------------------
    colors: {
      // Background utama (kanvas layar luar)
      background: '#EAF0F7',
      backgroundSubtle: '#F4F7FB',

      // Foreground / Teks Utama (Navy Deep)
      foreground: '#091524',
      primaryNavy: '#10213A',
      surfaceNavy: '#1B3254',

      // Permukaan Kartu (Pembeda elevasi murni tanpa box-shadow)
      cardSurface: '#FFFFFF',        // Kartu dalam (putih bersih)
      cardFrameOuter: '#E1E8F2',     // Bingkai luar (navy tonal soft)
      userPlateBg: '#E1E8F2',        // Wadah profil santri

      // Accent & Highlight (Kuning Pastel khas Al-Wafi)
      accent: '#FEF08A',             // Kuning pastel aksen
      accentLight: '#FEF9C3',        // Kuning pastel muda pelat saldo
      accentDeep: '#FDE047',         // Kuning pastel tajam
      accentText: '#713F12',         // Teks kontras di atas kuning

      // Warna Teks
      textPrimary: '#091524',        // Teks utama
      textMuted: '#546B87',          // Teks abu-abu kebiruan sekunder
      textOnNavy: '#FFFFFF',         // Teks di atas latar navy

      // Warna Status & Feedback
      success: '#15803D',            // Hijau kartu aktif / berhasil
      successBg: '#DCFCE7',
      error: '#7F1D1D',              // Merah kartu tidak terdaftar / gagal
      errorBg: '#FEF2F2',
      info: '#10213A',               // Navy gelap status info / membaca kartu
      infoBg: '#E1E8F2',

      // Border (Sesuai aturan: 0px / tanpa border 1px)
      border: '0px solid transparent'
    },

    // ------------------------------------------------------------------------
    // 3. UKURAN & TATA LETAK (Sizes & Layout Scale untuk 16:9 Landscape)
    // ------------------------------------------------------------------------
    sizes: {
      // Dimensi bingkai kartu utama (dikunci agar bebas layout shifting)
      cardWidth: 'clamp(860px, 58vw, 980px)',
      cardHeight: 'clamp(580px, 68vh, 660px)',

      // Ukuran tipografi penting
      heroBalanceFontSize: 'clamp(4.5rem, 6.8vw, 6.6rem)',
      clockFontSize: 'clamp(3rem, 4.2vw, 4.2rem)',
      userNameFontSize: '1.875rem',   // 30px
      userMetaFontSize: '1.125rem',   // 18px
      limitBadgeFontSize: '1.15rem',  // 18.4px

      // Avatar santri
      avatarSize: '60px',

      // Radius sudut Squircle
      squircleRadiusSm: '20px',
      squircleRadiusMd: '32px',
      squircleRadiusLg: '42px',
      squircleRadiusXl: '56px',
      squircleRadiusFull: '9999px'
    },

    // ------------------------------------------------------------------------
    // 4. TIMING & BATAS WAKTU (Durasi Waktu Sistem)
    // ------------------------------------------------------------------------
    timing: {
      // Waktu otomatis menutup kembali ke layar tunggu (dalam detik)
      autoCloseSeconds: 3,

      // Durasi toast pesan error / info tampil di layar (dalam milidetik)
      toastDurationMs: 4000,

      // Jeda maksimal antar-karakter dari alat scan RFID USB (dalam milidetik)
      scanCharMaxIntervalMs: 400,

      // Umur maksimal buffer scan sebelum dieksekusi (dalam milidetik)
      scanSubmitMaxAgeMs: 2000
    },

    // ------------------------------------------------------------------------
    // 5. KONEKSI API & ENDPOINT BACKEND
    // ------------------------------------------------------------------------
    api: {
      // Endpoint API lookup saldo (relatif terhadap host saat ini)
      endpoint: resolveEndpoint('api/lookup.php'),
      
      // Batas timeout request jaringan (dalam milidetik)
      timeoutMs: 6000,

      // Micro-cache TTL: mencegah double-tap kartu yang sama dalam 5 detik
      cacheTtlMs: 5000,

      // Izinkan fallback ke data lokal jika koneksi offline / development
      fallbackToMockOnOffline: true
    }
  };

  /**
   * Helper menyelesaikan endpoint URL agar tetap valid baik dibuka di domain lokal,
   * path subfolder (misal /ceksaldo/), atau file://
   */
  function resolveEndpoint(relativePath) {
    if (typeof window === 'undefined') return relativePath;
    const origin = window.location.origin;
    let pathname = window.location.pathname;

    // Jika dibuka langsung via file:// protocol
    if (window.location.protocol === 'file:') {
      return 'https://ceksaldo.al-wafi.sch.id/' + relativePath;
    }

    if (!pathname.endsWith('/')) {
      if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
        pathname = pathname.replace(/\/[^/]*$/, '/');
      } else {
        pathname = pathname + '/';
      }
    }
    return origin + pathname + relativePath;
  }

  /**
   * Menginjeksi token warna & ukuran dari KIOSK_CONFIG langsung ke CSS Variables (:root)
   * Sehingga perubahan konfigurasi di file JS ini langsung mengubah tampilan CSS secara instan!
   */
  function syncConfigToCssVariables() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const c = KIOSK_CONFIG.colors;
    const s = KIOSK_CONFIG.sizes;
    const a = KIOSK_CONFIG.animation;

    // Warna
    root.style.setProperty('--color-canvas', c.background);
    root.style.setProperty('--navy-deep', c.foreground);
    root.style.setProperty('--navy-primary', c.primaryNavy);
    root.style.setProperty('--surface-card-inner', c.cardSurface);
    root.style.setProperty('--surface-card-outer', c.cardFrameOuter);
    root.style.setProperty('--pastel-yellow', c.accent);
    root.style.setProperty('--surface-hero-balance', c.accentLight);
    root.style.setProperty('--navy-muted', c.textMuted);
    root.style.setProperty('--text-success', c.success);

    // Ukuran
    root.style.setProperty('--text-clock', s.clockFontSize);
    root.style.setProperty('--text-hero', s.heroBalanceFontSize);

    // Animasi
    root.style.setProperty('--duration-counter', a.counterSpeed + 's');
    root.style.setProperty('--duration-fade', a.stateCrossFadeSpeed + 's');
  }

  // Jalankan sinkronisasi variabel saat script dimuat
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncConfigToCssVariables);
    } else {
      syncConfigToCssVariables();
    }
  }

  // Ekspos ke global window
  window.KIOSK_CONFIG = KIOSK_CONFIG;

})(typeof window !== 'undefined' ? window : this);
