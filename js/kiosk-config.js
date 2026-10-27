(function (window) {
  'use strict';

  const PRODUCTION_BASE_URL = 'https://ceksaldo.al-wafi.sch.id';

  function isLocalDev() {
    if (typeof window === 'undefined' || !window.location) return false;
    const { protocol, hostname } = window.location;
    if (protocol === 'file:') return true;
    if (!hostname) return true;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.test') ||
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  }

  function resolveEndpoint(relativePath) {
    const cleanPath = String(relativePath || 'api/lookup.php').replace(/^\/+/, '');
    if (typeof window === 'undefined' || !window.location || isLocalDev()) {
      return PRODUCTION_BASE_URL + '/' + cleanPath;
    }
    const origin = window.location.origin;
    let pathname = window.location.pathname || '/';
    if (!pathname.endsWith('/')) {
      pathname = /\.[a-zA-Z0-9]+$/.test(pathname) ? pathname.replace(/\/[^/]*$/, '/') : pathname + '/';
    }
    return origin + pathname + cleanPath;
  }

  const KIOSK_CONFIG = {
    messages: {
      cardActive: 'Kartu Aktif',
      balanceReady: 'Saldo Tersedia',
      scanSuccess: 'Data berhasil ditemukan.',
      readingCard: 'Membaca kartu...',
      standbyPrompt: 'Tempelkan kartu santri ke modul sensor RFID untuk memeriksa saldo',
      touchPrompt: 'Tempelkan kartu pada reader RFID.',
      autoClosePrefix: 'Menutup otomatis dalam',
      cardNotRegistered: 'Kartu tidak terdaftar. Silakan hubungi tim IT.',
      invalidCard: 'Nomor kartu tidak valid. Silakan hubungi tim IT.',
      networkError: 'Tidak dapat menghubungi server. Periksa koneksi atau hubungi tim IT.',
      timeoutError: 'Koneksi ke server timeout. Silakan coba lagi atau hubungi tim IT.',
      serverError: 'Terjadi kesalahan pada server. Silakan hubungi tim IT.',
      badResponse: 'Respons server tidak valid. Silakan hubungi tim IT.',
      generalError: 'Gagal memeriksa saldo. Silakan hubungi tim IT.',
      noData: 'Tidak ada data',
      noLimit: 'Tanpa limit',
      walletFallbackType: 'Saldo Wallet',
      unknownUser: 'Pemilik Wallet',
      kioskLocked: 'Kios Terkunci: Keyboard & klik mouse dinonaktifkan.',
      kioskUnlocked: 'Mode Pemeliharaan IT: Keyboard & mouse diaktifkan. (Tekan Alt + O untuk mengunci)'
    },
    animation: {
      counterSpeed: 0.4,
      counterEasing: 'power2.out',
      splitBounceSpeed: 0.35,
      splitBounceEasing: 'back.out(2)',
      stateCrossFadeSpeed: 0.18,
      stateCrossFadeEasing: 'power2.out',
      userNameRevealSpeed: 0.25,
      userNameRevealEasing: 'power2.out',
      radarPulseSpeed: 2.8,
      radarPulseEasing: 'cubic-bezier(0.25, 1, 0.5, 1)'
    },
    colors: {
      background: '#EAF0F7',
      backgroundSubtle: '#F4F7FB',
      foreground: '#091524',
      primaryNavy: '#10213A',
      surfaceNavy: '#1B3254',
      cardSurface: '#FFFFFF',
      cardFrameOuter: '#E1E8F2',
      userPlateBg: '#E1E8F2',
      accent: '#FEF08A',
      accentLight: '#FEF9C3',
      accentDeep: '#FDE047',
      accentText: '#713F12',
      textPrimary: '#091524',
      textMuted: '#546B87',
      textOnNavy: '#FFFFFF',
      success: '#15803D',
      successBg: '#DCFCE7',
      error: '#7F1D1D',
      errorBg: '#FEF2F2',
      info: '#10213A',
      infoBg: '#E1E8F2',
      border: '0px solid transparent'
    },
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
    timing: {
      autoCloseSeconds: 3,
      toastDurationMs: 3200,
      scanCharMaxIntervalMs: 55,
      scanSubmitMaxAgeMs: 120,
      scanMinChars: 5,
      scanCooldownMs: 600
    },
    tiers: {
      silverThreshold: 100000,
      goldThreshold: 250000,
      diamondThreshold: 400000,
      silver: {
        confettiColors: ['#F1F5F9', '#E2E8F0', '#CBD5E1', '#94A3B8', '#64748B', '#38BDF8', '#FFFFFF']
      },
      gold: {
        confettiColors: ['#FDE047', '#FACC15', '#F59E0B', '#D97706', '#FEF08A', '#FFFFFF']
      },
      diamond: {
        confettiColors: ['#38BDF8', '#7DD3FC', '#BAE6FD', '#C084FC', '#E0E7FF', '#FFFFFF', '#CBD5E1', '#93C5FD']
      }
    },
    api: {
      productionBaseUrl: PRODUCTION_BASE_URL,
      remoteEndpoint: PRODUCTION_BASE_URL + '/api/lookup.php',
      localProxyEndpoint: 'http://127.0.0.1:8787/api/lookup.php',
      endpoint: resolveEndpoint('api/lookup.php'),
      isLocalDev: isLocalDev(),
      timeoutMs: 6000,
      cacheTtlMs: 5000,
      fallbackToMockOnOffline: true
    }
  };

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
