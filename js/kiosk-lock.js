(function (window, document) {
  'use strict';

  const CONFIG = window.KIOSK_CONFIG || {};

  const KIOSK_LOCK_CONFIG = {
    enabledByDefault: true,
    hideCursorWhenLocked: true,
    blockKeyboardWhenLocked: true,
    blockMouseClickWhenLocked: true,
    toggleCooldownMs: 350,
    messages: {
      locked: (CONFIG.messages && CONFIG.messages.kioskLocked) ||
        'Kios Terkunci: Keyboard & klik mouse dinonaktifkan.',
      unlocked: (CONFIG.messages && CONFIG.messages.kioskUnlocked) ||
        'Mode Pemeliharaan IT: Keyboard & mouse diaktifkan. (Tekan Alt + O untuk mengunci)'
    }
  };

  let isLocked = false;
  let lastToggleTime = 0;
  let rfidCandidateCount = 0;
  let lastRfidCharTime = 0;
  const RFID_MAX_INTERVAL_MS = (CONFIG.timing && CONFIG.timing.scanCharMaxIntervalMs) || 55;
  const RFID_MIN_CHARS = (CONFIG.timing && CONFIG.timing.scanMinChars) || 5;

  function notify(message, type, duration) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kiosk:toast', {
        detail: { message, type: type || 'info', duration: duration || 3000 }
      }));
    }
  }

  function syncSystemKeyboardLock() {
    try {
      if (navigator && navigator.keyboard) {
        if (isLocked && typeof navigator.keyboard.lock === 'function') {
          navigator.keyboard.lock(['MetaLeft', 'MetaRight', 'Escape', 'Tab', 'ContextMenu', 'F11']).catch(() => {});
        } else if (!isLocked && typeof navigator.keyboard.unlock === 'function') {
          navigator.keyboard.unlock();
        }
      }
    } catch (_) {}
  }

  function lockKiosk(showNotification = true) {
    isLocked = true;
    rfidCandidateCount = 0;

    if (document.documentElement) document.documentElement.classList.add('kiosk-locked');
    if (document.body) document.body.classList.add('kiosk-locked');

    const devModal = document.getElementById('kiosk-dev-modal');
    if (devModal && devModal.open) {
      try { devModal.close(); } catch (_) {}
    }

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      try { document.activeElement.blur(); } catch (_) {}
    }

    syncSystemKeyboardLock();

    if (showNotification) {
      notify(KIOSK_LOCK_CONFIG.messages.locked, 'info', 2800);
    }
  }

  function unlockKiosk(showNotification = true) {
    isLocked = false;
    rfidCandidateCount = 0;

    if (document.documentElement) document.documentElement.classList.remove('kiosk-locked');
    if (document.body) document.body.classList.remove('kiosk-locked');

    syncSystemKeyboardLock();

    if (showNotification) {
      notify(KIOSK_LOCK_CONFIG.messages.unlocked, 'success', 3800);
    }
  }

  function toggleKioskLock() {
    const now = Date.now();
    if (now - lastToggleTime < KIOSK_LOCK_CONFIG.toggleCooldownMs) return;
    lastToggleTime = now;

    if (isLocked) {
      unlockKiosk(true);
    } else {
      lockKiosk(true);
    }
  }

  function blockMouseInteractions(e) {
    if (!isLocked || !KIOSK_LOCK_CONFIG.blockMouseClickWhenLocked) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  [
    'click',
    'mousedown',
    'mouseup',
    'auxclick',
    'dblclick',
    'contextmenu',
    'dragstart',
    'selectstart',
    'pointerdown',
    'pointerup'
  ].forEach((eventName) => {
    window.addEventListener(eventName, blockMouseInteractions, { capture: true, passive: false });
  });

  function isWindowsKey(e) {
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

  function isUnlockShortcut(e) {
    return e.altKey === true && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'o' || e.key === 'O' || e.code === 'KeyO');
  }

  function isSimulatorShortcut(e) {
    return e.altKey === true && (e.key === 's' || e.key === 'S' || e.code === 'KeyS');
  }

  function handleKeyDownCapture(e) {
    if (isUnlockShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!e.repeat) toggleKioskLock();
      return false;
    }

    if (!isLocked || !KIOSK_LOCK_CONFIG.blockKeyboardWhenLocked) return;

    e.preventDefault();

    if (isWindowsKey(e) || isSimulatorShortcut(e) || e.repeat || e.ctrlKey || e.altKey || e.metaKey) {
      rfidCandidateCount = 0;
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    const now = Date.now();
    const delta = now - lastRfidCharTime;
    const key = e.key || '';

    if (key === 'Enter' || key === 'Tab') {
      const isValidRfidBurst = rfidCandidateCount >= RFID_MIN_CHARS && delta <= (RFID_MAX_INTERVAL_MS * 2.5);
      rfidCandidateCount = 0;
      lastRfidCharTime = 0;
      if (isValidRfidBurst) return;

      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    if (key.length === 1 && /^[0-9a-zA-Z\-]$/.test(key)) {
      if (rfidCandidateCount === 0 || delta <= RFID_MAX_INTERVAL_MS) {
        rfidCandidateCount += 1;
      } else {
        rfidCandidateCount = 1;
      }
      lastRfidCharTime = now;
      return;
    }

    rfidCandidateCount = 0;
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  function handleKeyReleaseCapture(e) {
    if (isUnlockShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    if (!isLocked || !KIOSK_LOCK_CONFIG.blockKeyboardWhenLocked) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  window.addEventListener('keydown', handleKeyDownCapture, { capture: true, passive: false });
  window.addEventListener('keypress', handleKeyReleaseCapture, { capture: true, passive: false });
  window.addEventListener('keyup', handleKeyReleaseCapture, { capture: true, passive: false });

  window.addEventListener('blur', () => {
    if (isLocked) {
      window.focus();
      setTimeout(() => { if (isLocked) window.focus(); }, 15);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (isLocked && document.visibilityState === 'visible') {
      window.focus();
    }
  });

  document.addEventListener('fullscreenchange', syncSystemKeyboardLock);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (KIOSK_LOCK_CONFIG.enabledByDefault) lockKiosk(false);
    });
  } else {
    if (KIOSK_LOCK_CONFIG.enabledByDefault) lockKiosk(false);
  }

  window.KIOSK_LOCK_CONFIG = KIOSK_LOCK_CONFIG;
  window.KioskSecurity = {
    lock: lockKiosk,
    unlock: unlockKiosk,
    toggle: toggleKioskLock,
    isLocked: () => isLocked
  };

})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : {});
