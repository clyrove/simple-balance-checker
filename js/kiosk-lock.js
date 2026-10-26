/**
 * ============================================================================
 * KIOSK LOCK & SECURITY CONTROLLER (PENGUNCI KEYBOARD, MOUSE & FULLSCREEN)
 * ============================================================================
 * Berkas konfigurasi & pengontrol keamanan kios ini berfungsi untuk:
 * 1. Force Fullscreen (Layar Penuh Otomatis) & menguncinya saat kios aktif.
 * 2. Mencegah keluar dari mode Fullscreen (F11 / Esc) saat kios terkunci.
 * 3. Menonaktifkan SELURUH klik tombol mouse (klik kiri, kanan, tengah, drag).
 * 4. Menyembunyikan kursor mouse saat kios terkunci.
 * 5. Memblokir seluruh input keyboard fisik santri (mencegah ketikan sembarangan).
 * 6. Tetap mengizinkan hardware reader RFID USB bekerja membaca kartu.
 * 7. Membuka / mengunci kembali HANYA dengan shortcut rahasia: [Alt + O].
 * ============================================================================
 */

(function (window, document) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. KONFIGURASI KEAMANAN & PENGUNCIAN KIOSK
  // --------------------------------------------------------------------------
  const KIOSK_LOCK_CONFIG = {
    // Kios otomatis terkunci sejak pertama kali halaman dibuka
    enabledByDefault: true,

    // Sembunyikan kursor mouse saat kios terkunci
    hideCursorWhenLocked: true,

    // Blokir seluruh ketikan keyboard fisik santri saat terkunci
    blockKeyboardWhenLocked: true,

    // Blokir seluruh klik tombol mouse (kiri, kanan, tengah, context menu) saat terkunci
    blockMouseClickWhenLocked: true,

    // Force Fullscreen otomatis saat kios aktif
    forceFullscreen: true,

    // Kunci Fullscreen (tidak bisa keluar layar penuh saat kios sedang terkunci)
    lockFullscreenWhenLocked: true,

    // Shortcut rahasia untuk membuka / mengunci kembali kios
    unlockKey: 'o',          // Tombol O
    modifierKey: 'altKey',   // Bersama tombol Alt -> [Alt + O]

    // Pesan notifikasi toast
    messages: {
      locked: 'Kios Terkunci: Layar penuh terkunci, keyboard & tombol mouse dinonaktifkan.',
      unlocked: 'Mode Pemeliharaan IT: Keyboard, mouse & jendela diaktifkan. (Tekan Alt + O untuk mengunci)'
    }
  };

  // State internal
  let isLocked = false;
  let hasUserInteracted = false;

  /**
   * Menampilkan pesan toast menggunakan event standar kios
   */
  function notify(message, type, duration) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kiosk:toast', {
        detail: {
          message: message,
          type: type || 'info',
          duration: duration || 3500
        }
      }));
    }
  }

  // --------------------------------------------------------------------------
  // 2. FORCE FULLSCREEN & FULLSCREEN LOCK ENGINE
  // --------------------------------------------------------------------------
  /**
   * Meminta browser masuk ke mode Fullscreen secara aman (mendukung semua vendor)
   */
  function requestFullscreenSafe() {
    if (typeof document === 'undefined') return;

    const docEl = document.documentElement;
    const isAlreadyFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (!isAlreadyFullscreen) {
      const requestMethod =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      if (requestMethod) {
        requestMethod.call(docEl).catch(() => {
          // Browser standar memerlukan gesture pengguna pertama kali
          // Fungsi ini akan otomatis dipicu lagi pada interaksi pertama
        });
      }
    }
  }

  /**
   * Keluar dari mode Fullscreen (hanya saat mode pemeliharaan IT / unlocked)
   */
  function exitFullscreenSafe() {
    if (typeof document === 'undefined') return;

    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (isFullscreen) {
      const exitMethod =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen ||
        document.msExitFullscreen;

      if (exitMethod) {
        exitMethod.call(document).catch(() => {});
      }
    }
  }

  /**
   * Deteksi jika ada upaya keluar dari Fullscreen saat kios TERKUNCI:
   * Jika terkunci, paksa kembali masuk ke Fullscreen seketika!
   */
  function handleFullscreenChange() {
    const isFullscreenNow = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (!isFullscreenNow && isLocked && KIOSK_LOCK_CONFIG.lockFullscreenWhenLocked) {
      // Segera paksa kembali ke mode fullscreen
      setTimeout(requestFullscreenSafe, 100);
    }
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);

  // --------------------------------------------------------------------------
  // 3. OPERASI KUNCI & BUKA KIOS (LOCK / UNLOCK)
  // --------------------------------------------------------------------------
  /**
   * Mengunci Kios:
   * - Sembunyikan kursor mouse
   * - Nonaktifkan klik mouse
   * - Matikan input keyboard santri
   * - Force dan kunci Fullscreen
   */
  function lockKiosk(showNotification = true) {
    isLocked = true;
    if (document.body) {
      document.body.classList.add('kiosk-locked');
      document.documentElement.classList.add('kiosk-locked');
    }

    if (KIOSK_LOCK_CONFIG.forceFullscreen) {
      requestFullscreenSafe();
    }

    if (showNotification) {
      notify(KIOSK_LOCK_CONFIG.messages.locked, 'info', 3000);
    }
  }

  /**
   * Membuka Kunci Kios (Mode Pemeliharaan IT):
   * - Kembalikan kursor mouse
   * - Aktifkan kembali klik mouse
   * - Izinkan ketikan keyboard untuk IT
   * - Buka kunci fullscreen
   */
  function unlockKiosk(showNotification = true) {
    isLocked = false;
    if (document.body) {
      document.body.classList.remove('kiosk-locked');
      document.documentElement.classList.remove('kiosk-locked');
    }

    if (showNotification) {
      notify(KIOSK_LOCK_CONFIG.messages.unlocked, 'success', 4500);
    }
  }

  /**
   * Toggle status kunci kios
   */
  function toggleKioskLock() {
    if (isLocked) {
      unlockKiosk(true);
    } else {
      lockKiosk(true);
    }
  }

  // --------------------------------------------------------------------------
  // 4. INTERCEPTOR EVENT MOUSE (BLOKIR SEMUA KLIK SAAT KIOS TERKUNCI)
  // --------------------------------------------------------------------------
  /**
   * Memblokir seluruh tombol mouse (klik kiri, klik kanan, klik tengah, dblclick)
   * saat kios berada dalam keadaan terkunci.
   */
  function blockMouseInteractions(e) {
    if (!isLocked || !KIOSK_LOCK_CONFIG.blockMouseClickWhenLocked) {
      return;
    }

    // Jika belum pernah berinteraksi, klik pertama memicu fullscreen
    if (!hasUserInteracted) {
      hasUserInteracted = true;
      if (KIOSK_LOCK_CONFIG.forceFullscreen) {
        requestFullscreenSafe();
      }
    }

    // Blokir total seluruh event mouse & context menu
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  // Tangkap seluruh event interaksi mouse pada capture phase (sebelum mencapai elemen DOM)
  const mouseEventNames = [
    'click',
    'mousedown',
    'mouseup',
    'auxclick',
    'dblclick',
    'contextmenu'
  ];

  mouseEventNames.forEach((eventName) => {
    window.addEventListener(eventName, blockMouseInteractions, true);
  });

  // Blokir juga pointerdown / pointerup yang bersumber dari mouse fisik
  window.addEventListener('pointerdown', (e) => {
    if (isLocked && KIOSK_LOCK_CONFIG.blockMouseClickWhenLocked) {
      if (e.pointerType === 'mouse' || !e.pointerType) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }
  }, true);

  window.addEventListener('pointerup', (e) => {
    if (isLocked && KIOSK_LOCK_CONFIG.blockMouseClickWhenLocked) {
      if (e.pointerType === 'mouse' || !e.pointerType) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }
  }, true);

  // --------------------------------------------------------------------------
  // 5. INTERCEPTOR EVENT KEYBOARD (BLOCK KEYBOARD SANTRI & LOCK FULLSCREEN)
  // --------------------------------------------------------------------------
  let lastStrokeTime = 0;

  window.addEventListener('keydown', function (e) {
    // Interaksi pertama memicu fullscreen jika belum aktif
    if (!hasUserInteracted) {
      hasUserInteracted = true;
      if (KIOSK_LOCK_CONFIG.forceFullscreen && isLocked) {
        requestFullscreenSafe();
      }
    }

    const isSecretUnlock = e.altKey && (e.key === 'o' || e.key === 'O');

    // 1. Shortcut Rahasia [Alt + O] untuk membuka / mengunci kios
    if (isSecretUnlock) {
      e.preventDefault();
      e.stopPropagation();
      toggleKioskLock();
      return;
    }

    // 2. Shortcut Simulator [Alt + S] (hanya boleh dibuka jika kios sudah di-unlock oleh IT)
    if (e.altKey && (e.key === 's' || e.key === 'S')) {
      if (isLocked) {
        e.preventDefault();
        return;
      }
    }

    // 3. Jika kios TERKUNCI: Kunci Fullscreen (Blokir tombol F11 & Escape)
    if (isLocked && KIOSK_LOCK_CONFIG.lockFullscreenWhenLocked) {
      if (e.key === 'F11' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        requestFullscreenSafe();
        return;
      }
    }

    // 4. Jika kios dalam keadaan TERKUNCI: Blokir ketikan santri
    if (isLocked && KIOSK_LOCK_CONFIG.blockKeyboardWhenLocked) {
      const now = Date.now();
      const strokeDelta = now - lastStrokeTime;
      lastStrokeTime = now;

      // Keystroke RFID scanner terjadi beruntun sangat cepat (< 250ms antar-karakter)
      const isLikelyRfidScanner = strokeDelta < 250 || e.key === 'Enter';

      if (!isLikelyRfidScanner) {
        // Blokir tombol fisik sembarangan (F5, Ctrl+R, Alt+Tab, spasi, huruf, dll.)
        e.preventDefault();
      }
    }
  }, true);

  // --------------------------------------------------------------------------
  // 6. INISIALISASI SAAT DOM SIAP & TRIGGER INTERAKSI PERTAMA
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    if (KIOSK_LOCK_CONFIG.enabledByDefault) {
      lockKiosk(false);
    }
  });

  // Memicu fullscreen pada gesture pertama santri / IT jika browser memblokir auto-fullscreen saat load
  const triggerInitialGesture = () => {
    if (!hasUserInteracted) {
      hasUserInteracted = true;
      if (KIOSK_LOCK_CONFIG.forceFullscreen && isLocked) {
        requestFullscreenSafe();
      }
    }
    window.removeEventListener('click', triggerInitialGesture, true);
    window.removeEventListener('keydown', triggerInitialGesture, true);
    window.removeEventListener('touchstart', triggerInitialGesture, true);
  };

  window.addEventListener('click', triggerInitialGesture, true);
  window.addEventListener('keydown', triggerInitialGesture, true);
  window.addEventListener('touchstart', triggerInitialGesture, true);

  // Ekspos antarmuka global
  window.KIOSK_LOCK_CONFIG = KIOSK_LOCK_CONFIG;
  window.KioskSecurity = {
    lock: lockKiosk,
    unlock: unlockKiosk,
    toggle: toggleKioskLock,
    requestFullscreen: requestFullscreenSafe,
    exitFullscreen: exitFullscreenSafe,
    isLocked: () => isLocked
  };

})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : {});
