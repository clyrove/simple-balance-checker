/**
 * ============================================================================
 * KIOSK LOCK & SECURITY CONTROLLER (PENGUNCI KEYBOARD & MOUSE TANPA FULLSCREEN)
 * ============================================================================
 * Berkas konfigurasi & pengontrol keamanan kios ini berfungsi untuk:
 * 1. Mengunci SELURUH tombol keyboard (termasuk tombol Windows/Meta, F1-F12,
 *    Tab, Esc, Ctrl, Alt, huruf, angka, spasi) saat kios terkunci.
 * 2. Hanya mengizinkan shortcut rahasia [Alt + O] untuk membuka / mengunci kios.
 * 3. Memastikan shortcut [Alt + S] (Simulator) HANYA bisa diakses ketika
 *    keyboard TIDAK dikunci (Mode Pemeliharaan IT).
 * 4. Menonaktifkan seluruh klik tombol mouse & menyembunyikan kursor saat terkunci.
 * 5. Tetap mengizinkan burst pembacaan kartu dari hardware reader RFID USB fisik.
 * ============================================================================
 */

(function (window, document) {
  'use strict';

  const CONFIG = window.KIOSK_CONFIG || {};

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

    // Shortcut rahasia untuk membuka / mengunci kembali kios: [Alt + O]
    unlockKey: 'o',
    modifierKey: 'altKey',

    // Cooldown anti-bounce saat menekan Alt + O (ms)
    toggleCooldownMs: 350,

    // Pesan notifikasi toast
    messages: {
      locked: (CONFIG.messages && CONFIG.messages.kioskLocked) ||
        'Kios Terkunci: Keyboard & klik mouse dinonaktifkan.',
      unlocked: (CONFIG.messages && CONFIG.messages.kioskUnlocked) ||
        'Mode Pemeliharaan IT: Keyboard & mouse diaktifkan. (Tekan Alt + O untuk mengunci)'
    }
  };

  // State internal
  let isLocked = false;
  let lastToggleTime = 0;

  // State pelacak burst hardware RFID agar ketikan manusia 100% diblokir
  let rfidCandidateCount = 0;
  let lastRfidCharTime = 0;
  const RFID_MAX_INTERVAL_MS = (CONFIG.timing && CONFIG.timing.scanCharMaxIntervalMs) || 55;
  const RFID_MIN_CHARS = (CONFIG.timing && CONFIG.timing.scanMinChars) || 5;

  /**
   * Menampilkan pesan toast menggunakan event standar kios
   */
  function notify(message, type, duration) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kiosk:toast', {
        detail: {
          message: message,
          type: type || 'info',
          duration: duration || 3000
        }
      }));
    }
  }

  // --------------------------------------------------------------------------
  // 2. SYSTEM KEYBOARD LOCK API (UNTUK MENGUNCI TOMBOL WINDOWS / META DI CHROMIUM)
  // --------------------------------------------------------------------------
  /**
   * Mengaktifkan Web Keyboard Lock API jika didukung browser untuk menangkap
   * tombol level sistem operasi seperti Windows Key (MetaLeft / MetaRight),
   * Escape, dan Alt+Tab.
   */
  function engageSystemKeyboardLock() {
    try {
      if (navigator && navigator.keyboard && typeof navigator.keyboard.lock === 'function') {
        navigator.keyboard.lock([
          'MetaLeft',
          'MetaRight',
          'Escape',
          'Tab',
          'ContextMenu',
          'F11'
        ]).catch(() => {});
      }
    } catch (_) {
      // Abaikan jika browser tidak mendukung Keyboard Lock API
    }
  }

  function releaseSystemKeyboardLock() {
    try {
      if (navigator && navigator.keyboard && typeof navigator.keyboard.unlock === 'function') {
        navigator.keyboard.unlock();
      }
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 3. OPERASI KUNCI & BUKA KIOS (LOCK / UNLOCK)
  // --------------------------------------------------------------------------
  /**
   * Mengunci Kios:
   * - Sembunyikan kursor mouse
   * - Nonaktifkan klik mouse
   * - Kunci penuh seluruh tombol keyboard kecuali [Alt + O]
   * - Tutup paksa modal simulator [Alt + S] jika sedang terbuka
   */
  function lockKiosk(showNotification = true) {
    isLocked = true;
    rfidCandidateCount = 0;

    if (document.documentElement) {
      document.documentElement.classList.add('kiosk-locked');
    }
    if (document.body) {
      document.body.classList.add('kiosk-locked');
    }

    // Jika modal developer [Alt + S] sedang terbuka saat dikunci, tutup seketika
    const devModal = document.getElementById('kiosk-dev-modal');
    if (devModal && devModal.open) {
      try {
        devModal.close();
      } catch (_) {}
    }

    // Lepaskan fokus dari elemen input/button apa pun agar tidak bisa diketik/ditekan
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      try {
        document.activeElement.blur();
      } catch (_) {}
    }

    engageSystemKeyboardLock();

    if (showNotification) {
      notify(KIOSK_LOCK_CONFIG.messages.locked, 'info', 2800);
    }
  }

  /**
   * Membuka Kunci Kios (Mode Pemeliharaan IT):
   * - Kembalikan kursor mouse
   * - Aktifkan kembali klik mouse
   * - Izinkan ketikan keyboard & buka akses shortcut [Alt + S]
   */
  function unlockKiosk(showNotification = true) {
    isLocked = false;
    rfidCandidateCount = 0;

    if (document.documentElement) {
      document.documentElement.classList.remove('kiosk-locked');
    }
    if (document.body) {
      document.body.classList.remove('kiosk-locked');
    }

    releaseSystemKeyboardLock();

    if (showNotification) {
      notify(KIOSK_LOCK_CONFIG.messages.unlocked, 'success', 3800);
    }
  }

  /**
   * Toggle status kunci kios dengan anti-bounce cooldown
   */
  function toggleKioskLock() {
    const now = Date.now();
    if (now - lastToggleTime < KIOSK_LOCK_CONFIG.toggleCooldownMs) {
      return;
    }
    lastToggleTime = now;

    if (isLocked) {
      unlockKiosk(true);
    } else {
      lockKiosk(true);
    }
  }

  // --------------------------------------------------------------------------
  // 4. INTERCEPTOR EVENT MOUSE (BLOKIR SEMUA KLIK SAAT KIOS TERKUNCI)
  // --------------------------------------------------------------------------
  function blockMouseInteractions(e) {
    if (!isLocked || !KIOSK_LOCK_CONFIG.blockMouseClickWhenLocked) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  const mouseEventNames = [
    'click',
    'mousedown',
    'mouseup',
    'auxclick',
    'dblclick',
    'contextmenu',
    'dragstart',
    'selectstart'
  ];

  mouseEventNames.forEach((eventName) => {
    window.addEventListener(eventName, blockMouseInteractions, { capture: true, passive: false });
  });

  window.addEventListener('pointerdown', (e) => {
    if (isLocked && KIOSK_LOCK_CONFIG.blockMouseClickWhenLocked) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }, { capture: true, passive: false });

  window.addEventListener('pointerup', (e) => {
    if (isLocked && KIOSK_LOCK_CONFIG.blockMouseClickWhenLocked) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }, { capture: true, passive: false });

  // --------------------------------------------------------------------------
  // 5. INTERCEPTOR KEYBOARD KETAT (BLOKIR SEMUA KECUALI ALT+O SAAT TERKUNCI)
  // --------------------------------------------------------------------------
  /**
   * Mengecek apakah event adalah tombol Windows / Meta / OS
   */
  function isWindowsOrSystemKey(e) {
    const key = e.key || '';
    const code = e.code || '';
    const keyCode = e.keyCode || e.which || 0;
    return (
      key === 'Meta' ||
      key === 'OS' ||
      key === 'Win' ||
      key === 'ContextMenu' ||
      code === 'MetaLeft' ||
      code === 'MetaRight' ||
      code === 'OSLeft' ||
      code === 'OSRight' ||
      code === 'ContextMenu' ||
      keyCode === 91 ||
      keyCode === 92 ||
      keyCode === 93 ||
      e.metaKey === true
    );
  }

  /**
   * Mengecek apakah kombinasi tombol adalah Shortcut Rahasia [Alt + O]
   */
  function isSecretUnlockShortcut(e) {
    return (
      e.altKey === true &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey &&
      (e.key === 'o' || e.key === 'O' || e.code === 'KeyO')
    );
  }

  /**
   * Mengecek apakah kombinasi tombol adalah Shortcut Simulator [Alt + S]
   */
  function isSimulatorShortcut(e) {
    return (
      e.altKey === true &&
      (e.key === 's' || e.key === 'S' || e.code === 'KeyS')
    );
  }

  /**
   * Handler utama Keydown pada Capture Phase (Prioritas Tertinggi)
   */
  function handleKeyDownCapture(e) {
    // 1. SATU-SATUNYA TOMBOL PEMBUKA SAAT TERKUNCI: [Alt + O]
    if (isSecretUnlockShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Abaikan jika tombol ditahan (key repeat) agar tidak memicu jitter toast
      if (!e.repeat) {
        toggleKioskLock();
      }
      return false;
    }

    // Jika kios sedang TIDAK dikunci (Mode Pemeliharaan IT), izinkan semua tombol termasuk [Alt + S]
    if (!isLocked || !KIOSK_LOCK_CONFIG.blockKeyboardWhenLocked) {
      return;
    }

    // ========================================================================
    // MULAI DARI SINI: KIOS SEDANG TERKUNCI (isLocked === true)
    // Seluruh aksi default browser WAJIB dimatikan untuk SEMUA tombol!
    // ========================================================================
    e.preventDefault();

    // 2. Blokir mutlak Tombol Windows / Meta / ContextMenu
    if (isWindowsOrSystemKey(e)) {
      rfidCandidateCount = 0;
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    // 3. Blokir mutlak [Alt + S] ketika keyboard sedang dikunci!
    if (isSimulatorShortcut(e)) {
      rfidCandidateCount = 0;
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    // 4. Blokir semua tombol yang ditahan (key repeat) atau tombol dengan modifier (Ctrl, Alt, Meta)
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) {
      rfidCandidateCount = 0;
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    // 5. Deteksi Burst Hardware Scanner RFID USB:
    // Alat scan RFID mengirim karakter alfanumerik sangat cepat (< 55ms per karakter)
    // lalu diakhiri dengan Enter / Tab. Ketikan tangan manusia akan langsung dihentikan!
    const now = Date.now();
    const delta = now - lastRfidCharTime;
    const key = e.key || '';

    if (key === 'Enter' || key === 'Tab') {
      const isValidRfidBurst =
        rfidCandidateCount >= RFID_MIN_CHARS &&
        delta <= (RFID_MAX_INTERVAL_MS * 2.5);

      rfidCandidateCount = 0;
      lastRfidCharTime = 0;

      if (isValidRfidBurst) {
        // Izinkan event Enter dari RFID reader diteruskan HANYA ke listener RFID di kiosk-api.js
        return;
      }

      // Jika bukan akhir burst RFID (misal user menekan Enter biasa), blokir total!
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    // Cek apakah karakter tunggal alfanumerik (UID kartu RFID)
    if (key.length === 1 && /^[0-9a-zA-Z\-]$/.test(key)) {
      if (rfidCandidateCount === 0 || delta <= RFID_MAX_INTERVAL_MS) {
        rfidCandidateCount += 1;
      } else {
        // Jeda terlalu lama (> 55ms) = ketikan manusia, reset hitungan ke 1
        rfidCandidateCount = 1;
      }
      lastRfidCharTime = now;
      // Karakter diteruskan ke buffer RFID di kiosk-api.js, namun e.preventDefault() sudah dipanggil
      // sehingga tidak akan pernah bisa mengetik ke elemen mana pun di layar.
      return;
    }

    // 6. Seluruh tombol lainnya (Spasi, panah, F1-F12, Esc, Backspace, simbol, dll.) diblokir mutlak!
    rfidCandidateCount = 0;
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  /**
   * Blokir penuh keypress & keyup saat kios terkunci (termasuk rilis tombol Windows)
   */
  function handleKeyPressOrUpCapture(e) {
    if (isSecretUnlockShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    if (!isLocked || !KIOSK_LOCK_CONFIG.blockKeyboardWhenLocked) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  window.addEventListener('keydown', handleKeyDownCapture, { capture: true, passive: false });
  window.addEventListener('keypress', handleKeyPressOrUpCapture, { capture: true, passive: false });
  window.addEventListener('keyup', handleKeyPressOrUpCapture, { capture: true, passive: false });

  // --------------------------------------------------------------------------
  // 6. INISIALISASI SAAT DOM SIAP
  // --------------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (KIOSK_LOCK_CONFIG.enabledByDefault) {
        lockKiosk(false);
      }
    });
  } else {
    if (KIOSK_LOCK_CONFIG.enabledByDefault) {
      lockKiosk(false);
    }
  }

  // Ekspos antarmuka global
  window.KIOSK_LOCK_CONFIG = KIOSK_LOCK_CONFIG;
  window.KioskSecurity = {
    lock: lockKiosk,
    unlock: unlockKiosk,
    toggle: toggleKioskLock,
    isLocked: () => isLocked
  };

})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : {});
