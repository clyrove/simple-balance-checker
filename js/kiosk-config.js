/**
 * ============================================================================
 * KIOSK CENTRAL CONFIGURATION (SATU TEMPAT UNTUK SEMUA PENGATURAN)
 * ============================================================================
 * File ini dirancang agar SANGAT MUDAH DIBACA & DIUBAH oleh:
 * - Junior Developer
 * - Tim IT Pesantren
 * - Administrator / Orang awam
 *
 * Seluruh pesan status, error, warning, warna, ukuran, dan animasi terpusat di sini!
 * ============================================================================
 */

(function (window) {
  'use strict';

  const KIOSK_CONFIG = {
    // ------------------------------------------------------------------------
    // 1. PESAN STATUS, ERROR, WARNING & FEEDBACK (TERPUSAT DI SATU TEMPAT)
    // ------------------------------------------------------------------------
    messages: {
      // Status Sukses
      cardActive: 'Kartu Aktif',
      balanceReady: 'Saldo Tersedia',
      scanSuccess: 'Data berhasil ditemukan.',

      // Status Info / Proses
      readingCard: 'Membaca kartu...',
      standbyPrompt: 'Tempelkan kartu santri ke modul sensor RFID untuk memeriksa saldo',
      touchPrompt: 'Tempelkan kartu pada reader RFID.',
      autoClosePrefix: 'Menutup otomatis dalam',

      // Pesan Error & Validasi (Menggunakan "IT", bukan "petugas")
      cardNotRegistered: 'Kartu tidak terdaftar. Silakan hubungi tim IT.',
      invalidCard: 'Nomor kartu tidak valid. Silakan hubungi tim IT.',
      networkError: 'Tidak dapat menghubungi server. Periksa koneksi atau hubungi tim IT.',
      timeoutError: 'Koneksi ke server timeout. Silakan coba lagi atau hubungi tim IT.',
      serverError: 'Terjadi kesalahan pada server. Silakan hubungi tim IT.',
      badResponse: 'Respons server tidak valid. Silakan hubungi tim IT.',
      generalError: 'Gagal memeriksa saldo. Silakan hubungi tim IT.',

      // Pesan Fallback jika nilai di API kosong / null / undefined
      noData: 'Tidak ada data',
      noLimit: 'Tanpa limit',
      walletFallbackType: 'Saldo Wallet',
      unknownUser: 'Pemilik Wallet',

      // Pesan Kios Lock & Keamanan
      kioskLocked: 'Kios Terkunci: Keyboard dinonaktifkan & kursor disembunyikan.',
      kioskUnlocked: 'Mode Pemeliharaan IT: Keyboard & kursor diaktifkan. (Tekan Alt + O untuk mengunci kembali)'
    },

    // ------------------------------------------------------------------------
    // 2. PENGATURAN ANIMASI (Kecepatan & Jenis Kurva Animasi GSAP)
    // ------------------------------------------------------------------------
    animation: {
      // Kecepatan putaran counter saldo (0.4 detik = cepat & responsif saat antrean)
      counterSpeed: 0.4,
      counterEasing: 'power2.out',

      // Kecepatan animasi huruf melenting (split text bounce)
      splitBounceSpeed: 0.35,
      splitBounceEasing: 'back.out(2)',

      // Kecepatan transisi layar (cross-fade antara standby & tampilan saldo)
      stateCrossFadeSpeed: 0.18,
      stateCrossFadeEasing: 'power2.out',

      // Kecepatan kemunculan nama santri
      userNameRevealSpeed: 0.25,
      userNameRevealEasing: 'power2.out',

      // Kecepatan radar gelombang sensor RFID di layar tunggu
      radarPulseSpeed: 2.8,
      radarPulseEasing: 'cubic-bezier(0.25, 1, 0.5, 1)'
    },

    // ------------------------------------------------------------------------
    // 3. PALET WARNA (Colors & Semantic Tones)
    // ------------------------------------------------------------------------
    colors: {
      // Background utama
      background: '#EAF0F7',
      backgroundSubtle: '#F4F7FB',

      // Foreground & Navy Tones
      foreground: '#091524',
      primaryNavy: '#10213A',
      surfaceNavy: '#1B3254',

      // Permukaan Kartu (Pembeda elevasi murni tanpa box-shadow)
      cardSurface: '#FFFFFF',
      cardFrameOuter: '#E1E8F2',
      userPlateBg: '#E1E8F2',

      // Accent & Highlight (Kuning Pastel khas Al-Wafi)
      accent: '#FEF08A',
      accentLight: '#FEF9C3',
      accentDeep: '#FDE047',
      accentText: '#713F12',

      // Warna Teks
      textPrimary: '#091524',
      textMuted: '#546B87',
      textOnNavy: '#FFFFFF',

      // Warna Status & Feedback
      success: '#15803D',
      successBg: '#DCFCE7',
      error: '#7F1D1D',
      errorBg: '#FEF2F2',
      info: '#10213A',
      infoBg: '#E1E8F2',

      // Border (0px / tanpa border 1px sesuai aturan desain)
      border: '0px solid transparent'
    },

    // ------------------------------------------------------------------------
    // 4. UKURAN & TATA LETAK (Sizes untuk Layar Kiosk 16:9 Landscape)
    // ------------------------------------------------------------------------
    sizes: {
      cardWidth: 'clamp(860px, 58vw, 980px)',
      cardHeight: 'clamp(580px, 68vh, 660px)',

      heroBalanceFontSize: 'clamp(4.5rem, 6.8vw, 6.6rem)',
      clockFontSize: 'clamp(3rem, 4.2vw, 4.2rem)',
      userNameFontSize: '1.875rem',
      userMetaFontSize: '1.125rem',
      limitBadgeFontSize: '1.125rem',

      avatarSize: '60px',

      squircleRadiusSm: '20px',
      squircleRadiusMd: '32px',
      squircleRadiusLg: '42px',
      squircleRadiusXl: '56px',
      squircleRadiusFull: '9999px'
    },

    // ------------------------------------------------------------------------
    // 5. TIMING & BATAS WAKTU
    // ------------------------------------------------------------------------
    timing: {
      autoCloseSeconds: 3,
      toastDurationMs: 4000,
      scanCharMaxIntervalMs: 400,
      scanSubmitMaxAgeMs: 2000
    },

    // ------------------------------------------------------------------------
    // 6. KONEKSI API & ENDPOINT BACKEND
    // ------------------------------------------------------------------------
    api: {
      endpoint: resolveEndpoint('api/lookup.php'),
      timeoutMs: 6000,
      cacheTtlMs: 5000,
      fallbackToMockOnOffline: true
    }
  };

  /**
   * Helper menyelesaikan endpoint URL backend
   */
  function resolveEndpoint(relativePath) {
    if (typeof window === 'undefined') return relativePath;
    const origin = window.location.origin;
    let pathname = window.location.pathname;

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
   * Menyinkronkan variabel KIOSK_CONFIG langsung ke CSS Variables (:root)
   */
  function syncConfigToCssVariables() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const c = KIOSK_CONFIG.colors;
    const s = KIOSK_CONFIG.sizes;
    const a = KIOSK_CONFIG.animation;

    root.style.setProperty('--color-canvas', c.background);
    root.style.setProperty('--navy-deep', c.foreground);
    root.style.setProperty('--navy-primary', c.primaryNavy);
    root.style.setProperty('--surface-card-inner', c.cardSurface);
    root.style.setProperty('--surface-card-outer', c.cardFrameOuter);
    root.style.setProperty('--pastel-yellow', c.accent);
    root.style.setProperty('--surface-hero-balance', c.accentLight);
    root.style.setProperty('--navy-muted', c.textMuted);
    root.style.setProperty('--text-success', c.success);
    root.style.setProperty('--status-error', c.error);
    root.style.setProperty('--status-error-bg', c.errorBg);

    root.style.setProperty('--text-clock', s.clockFontSize);
    root.style.setProperty('--text-hero', s.heroBalanceFontSize);

    root.style.setProperty('--duration-counter', a.counterSpeed + 's');
    root.style.setProperty('--duration-fade', a.stateCrossFadeSpeed + 's');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncConfigToCssVariables);
    } else {
      syncConfigToCssVariables();
    }
  }

  window.KIOSK_CONFIG = KIOSK_CONFIG;

})(typeof window !== 'undefined' ? window : this);
