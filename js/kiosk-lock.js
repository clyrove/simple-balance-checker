/**
 * ============================================================================
 * KIOSK LOCK & SECURITY CONFIGURATION (PENGUNCI KEYBOARD & KURSOR KIOS)
 * ============================================================================
 * Berkas konfigurasi khusus ini berfungsi untuk:
 * 1. Menonaktifkan SELURUH input keyboard fisik santri agar laptop/kiosk tidak
 *    dapat diutak-atik atau diketik sembarangan.
 * 2. Menyembunyikan kursor mouse saat kios aktif (layar sentuh / touch kiosk).
 * 3. Membuka / mengunci kembali keyboard dan kursor HANYA dengan shortcut
 *    rahasia: [Alt + O].
 * 4. Tetap mengizinkan hardware reader RFID USB bekerja membaca kartu.
 * ============================================================================
 */

(function (window, document) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. KONFIGURASI KEAMANAN & PENGUNCIAN KIOSK
  // --------------------------------------------------------------------------
  const KIOSK_LOCK_CONFIG = {
    // Kios otomatis terkunci sejak pertama kali halaman dibuka (True / False)
    enabledByDefault: true,

    // Sembunyikan kursor mouse saat kios terkunci (True / False)
    hideCursorWhenLocked: true,

    // Blokir seluruh ketikan santri saat kios terkunci
    blockKeyboardWhenLocked: true,

    // Shortcut rahasia untuk membuka / mengunci kembali keyboard & kursor
    unlockKey: 'o',          // Tombol O
    modifierKey: 'altKey',   // Bersama tombol Alt -> [Alt + O]

    // Pesan notifikasi toast
    messages: {
      locked: 'Kios Terkunci: Keyboard dinonaktifkan & kursor disembunyikan.',
      unlocked: 'Mode Pemeliharaan IT: Keyboard & kursor diaktifkan. (Tekan Alt + O untuk mengunci kembali)'
    }
  };

  // State internal
  let isLocked = false;

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

  /**
   * Mengunci Kios: Sembunyikan kursor mouse & matikan input keyboard santri
   */
  function lockKiosk(showNotification = true) {
    isLocked = true;
    if (document.body) {
      document.body.classList.add('kiosk-locked');
      document.documentElement.classList.add('kiosk-locked');
    }
    if (showNotification) {
      notify(KIOSK_LOCK_CONFIG.messages.locked, 'info', 3000);
    }
  }

  /**
   * Membuka Kunci Kios: Kembalikan kursor mouse & izinkan input keyboard untuk IT
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
  // 2. INTERCEPTOR EVENT KEYBOARD (BLOCK KEYBOARD SANTRI + DETEKSI ALT + O)
  // --------------------------------------------------------------------------
  // Catatan: Hardware scanner RFID mengetik sangat cepat (< 250ms).
  // Keystroke dari scanner ditangkap oleh listener RFID di kiosk-api.js,
  // sedangkan ketikan santri yang lambat akan diblokir total jika kios terkunci.
  let lastStrokeTime = 0;

  window.addEventListener('keydown', function (e) {
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
        // Jika kios terkunci, santri tidak boleh membuka simulator
        e.preventDefault();
        return;
      }
    }

    // 3. Jika kios dalam keadaan TERKUNCI (Santri Mode)
    if (isLocked && KIOSK_LOCK_CONFIG.blockKeyboardWhenLocked) {
      const now = Date.now();
      const strokeDelta = now - lastStrokeTime;
      lastStrokeTime = now;

      // Keystroke RFID scanner terjadi beruntun sangat cepat (< 250ms antar-karakter)
      const isLikelyRfidScanner = strokeDelta < 250 || e.key === 'Enter';

      if (!isLikelyRfidScanner) {
        // Blokir tombol-tombol berbahaya (F5, F11, Ctrl+R, Alt+Tab, tombol huruf sembarangan)
        e.preventDefault();
      }
    }
  }, true); // Use capture phase to intercept early

  // --------------------------------------------------------------------------
  // 3. INISIALISASI SAAT DOM SIAP
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    if (KIOSK_LOCK_CONFIG.enabledByDefault) {
      // Kunci kios tanpa memunculkan toast mengganggu saat start-up awal
      lockKiosk(false);
    }
  });

  // Ekspos ke antarmuka global
  window.KIOSK_LOCK_CONFIG = KIOSK_LOCK_CONFIG;
  window.KioskSecurity = {
    lock: lockKiosk,
    unlock: unlockKiosk,
    toggle: toggleKioskLock,
    isLocked: () => isLocked
  };

})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : {});
