/**
 * ============================================================================
 * KIOSK APPLICATION & GSAP ANIMATION CONTROLLER
 * ============================================================================
 * Modul ini menangani:
 * 1. Jam Digital Kiosk Real-Time (WIB & Format Tanggal Bahasa Indonesia).
 * 2. GSAP SplitText Character & Rolling Counter Saldo (Kecepatan 0.4s Snappy).
 * 3. Transisi State 1 (Waiting RFID) <-> State 2 (Active Balance) tanpa pergeseran layout.
 * 4. Timer Privasi 3 Detik dengan visual progress bar.
 * 5. Toast Notifikasi Mengambang (Info, Error, Success).
 * 6. Shortcut Tersembunyi [Alt + S] untuk Simulator Kiosk & Direct API Lookup.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Cek ketersediaan GSAP (Graceful Degradation jika library gagal dimuat)
  const hasGsap = typeof window.gsap !== 'undefined';
  const CONFIG = window.KIOSK_CONFIG || {
    animation: { counterSpeed: 0.4, counterEasing: 'power2.out', splitBounceSpeed: 0.35, splitBounceEasing: 'back.out(2)', stateCrossFadeSpeed: 0.18 },
    timing: { autoCloseSeconds: 3, toastDurationMs: 4000 }
  };

  // --------------------------------------------------------------------------
  // 1. SELECTOR DOM ELEMEN
  // --------------------------------------------------------------------------
  const stateContainer = document.getElementById('kiosk-state-container');
  const waitingView = document.getElementById('kiosk-waiting-view');
  const activeView = document.getElementById('kiosk-active-view');
  const rfidSensorArea = document.getElementById('kiosk-rfid-sensor-area');
  const btnDone = document.getElementById('kiosk-btn-done');

  // Dynamic Content Elements
  const balanceAmountEl = document.getElementById('kiosk-balance-amount');
  const userNameEl = document.getElementById('kiosk-user-name');

  // Clock Elements
  const clockDateEl = document.getElementById('kiosk-live-date');
  const clockHoursEl = document.getElementById('kiosk-clock-hours');
  const clockMinutesEl = document.getElementById('kiosk-clock-minutes');
  const clockSecondsEl = document.getElementById('kiosk-clock-seconds');

  // 3-Second Privacy Timer Elements
  const timerSecondsEl = document.getElementById('kiosk-timer-seconds');
  const countdownProgressEl = document.getElementById('kiosk-countdown-progress');

  // Simulator Modal Elements (Shortcut [Alt + S])
  const devModal = document.getElementById('kiosk-dev-modal');
  const devModalClose = document.getElementById('modal-dev-close');
  const simBtnApply = document.getElementById('sim-btn-apply');
  const simBtnReset = document.getElementById('sim-btn-reset');
  const simBtnLookup = document.getElementById('sim-btn-lookup');

  // Toast / Floating Status Message Elements
  const toastEl = document.getElementById('kiosk-toast');
  const toastTextEl = document.getElementById('kiosk-toast-text');
  const toastIconEl = document.getElementById('kiosk-toast-icon');
  let toastTimer = null;

  // Timer Configuration
  const COUNTDOWN_TOTAL_SECONDS = CONFIG.timing.autoCloseSeconds || 3;
  let remainingSeconds = COUNTDOWN_TOTAL_SECONDS;
  let countdownTimer = null;
  let countdownTween = null;
  let isTransitioning = false;

  // --------------------------------------------------------------------------
  // 2. REAL-TIME DIGITAL CLOCK (WIB & TANGGAL INDONESIA)
  // --------------------------------------------------------------------------
  function updateKioskClock() {
    const now = new Date();

    // Tanggal format Indonesia (Contoh: "Kamis, 26 Okt 2026")
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
    const dateString = now.toLocaleDateString('id-ID', dateOptions);
    if (clockDateEl) {
      clockDateEl.textContent = dateString;
    }

    // Jam, Menit, Detik
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    if (clockHoursEl) clockHoursEl.textContent = hours;
    if (clockMinutesEl) clockMinutesEl.textContent = minutes;
    if (clockSecondsEl) clockSecondsEl.textContent = seconds;
  }

  updateKioskClock();
  setInterval(updateKioskClock, 1000);

  // --------------------------------------------------------------------------
  // 3. SPLIT TEXT & GSAP ANIMATION COUNTER (SNAPPY & FAST)
  // --------------------------------------------------------------------------
  /**
   * Memecah string menjadi elemen span per karakter untuk animasi GSAP
   */
  function splitTextToChars(element, text) {
    if (!element) return [];
    element.innerHTML = '';
    const chars = text.split('');
    const charElements = [];

    chars.forEach((char) => {
      const span = document.createElement('span');
      span.className = 'split-char';
      span.textContent = char;
      if (char === ' ') {
        span.style.width = '0.3em';
      }
      element.appendChild(span);
      charElements.push(span);
    });

    return charElements;
  }

  /**
   * Menjalankan animasi rolling counter dan staggered split text pada nominal saldo
   * Menggunakan durasi cepat 0.4s sesuai rekomendasi efisiensi antrean
   */
  function animateBalanceNumber(targetBalance) {
    if (!balanceAmountEl) return;

    // Fallback jika GSAP tidak tersedia
    if (!hasGsap) {
      balanceAmountEl.textContent = window.SantriKioskAPI.formatRupiah(targetBalance);
      return;
    }

    const counterObj = { value: 0 };
    const duration = CONFIG.animation.counterSpeed || 0.4;

    gsap.to(counterObj, {
      value: targetBalance,
      duration: duration,
      ease: CONFIG.animation.counterEasing || "power2.out",
      onUpdate: () => {
        balanceAmountEl.textContent = window.SantriKioskAPI.formatRupiah(counterObj.value);
      },
      onComplete: () => {
        // Efek lenting karakter (split bounce) saat angka mencapai target
        const finalFormatted = window.SantriKioskAPI.formatRupiah(targetBalance);
        const spans = splitTextToChars(balanceAmountEl, finalFormatted);

        gsap.fromTo(spans, 
          { y: 16, opacity: 0 }, 
          {
            y: 0,
            opacity: 1,
            duration: CONFIG.animation.splitBounceSpeed || 0.35,
            stagger: 0.02,
            ease: CONFIG.animation.splitBounceEasing || "back.out(2)"
          }
        );
      }
    });
  }

  /**
   * Animasi kemunculan nama santri secara halus
   */
  function animateUserName(nameText) {
    if (!userNameEl) return;
    if (!hasGsap) {
      userNameEl.textContent = nameText;
      return;
    }

    const spans = splitTextToChars(userNameEl, nameText);
    gsap.fromTo(spans,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: CONFIG.animation.userNameRevealSpeed || 0.25, stagger: 0.012, ease: "power2.out" }
    );
  }

  // --------------------------------------------------------------------------
  // 4. TIMER PRIVASI 3 DETIK (PROGRESS BAR HALUS)
  // --------------------------------------------------------------------------
  function startPrivacyCountdown() {
    stopPrivacyCountdown();
    remainingSeconds = COUNTDOWN_TOTAL_SECONDS;
    if (timerSecondsEl) timerSecondsEl.textContent = remainingSeconds;

    // Reset dan jalankan progress bar menyusut
    if (countdownProgressEl) {
      if (hasGsap) {
        gsap.killTweensOf(countdownProgressEl);
        gsap.set(countdownProgressEl, { scaleX: 1 });
        countdownTween = gsap.to(countdownProgressEl, {
          scaleX: 0,
          duration: COUNTDOWN_TOTAL_SECONDS,
          ease: "linear"
        });
      } else {
        countdownProgressEl.style.transform = 'scaleX(0)';
      }
    }

    // Interval hitung mundur per detik
    countdownTimer = setInterval(() => {
      remainingSeconds -= 1;
      if (timerSecondsEl) {
        timerSecondsEl.textContent = Math.max(0, remainingSeconds);
      }

      if (remainingSeconds <= 0) {
        stopPrivacyCountdown();
        switchToWaitingState();
      }
    }, 1000);
  }

  function stopPrivacyCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (countdownTween) {
      countdownTween.kill();
      countdownTween = null;
    }
  }

  // --------------------------------------------------------------------------
  // 5. TRANSISI ANTAR STATE (BEBAS LAYOUT SHIFTING)
  // --------------------------------------------------------------------------
  function switchToActiveState(targetBalance, santriData) {
    if (isTransitioning) return;
    isTransitioning = true;

    // Fallback tanpa GSAP
    if (!hasGsap) {
      waitingView.classList.remove('active');
      waitingView.setAttribute('aria-hidden', 'true');
      activeView.classList.add('active');
      activeView.setAttribute('aria-hidden', 'false');
      stateContainer.classList.remove('state-waiting');
      stateContainer.classList.add('state-active');
      isTransitioning = false;
      animateBalanceNumber(targetBalance);
      if (santriData && santriData.name) animateUserName(santriData.name);
      startPrivacyCountdown();
      return;
    }

    activeView.classList.add('active');
    activeView.setAttribute('aria-hidden', 'false');

    const fadeSpeed = CONFIG.animation.stateCrossFadeSpeed || 0.18;
    const tl = gsap.timeline({
      onComplete: () => {
        waitingView.classList.remove('active');
        waitingView.setAttribute('aria-hidden', 'true');
        stateContainer.classList.remove('state-waiting');
        stateContainer.classList.add('state-active');
        isTransitioning = false;

        // Mulai timer privasi 3 detik
        startPrivacyCountdown();
      }
    });

    // Cross-fade murni dalam CSS Grid yang terkunci (Zero Shift)
    tl.to(waitingView, {
      opacity: 0,
      duration: fadeSpeed,
      ease: "power1.in"
    });

    tl.fromTo(activeView,
      { opacity: 0 },
      { opacity: 1, duration: fadeSpeed * 1.2, ease: "power2.out" },
      "-=0.06"
    );

    // Animasi Saldo & Nama
    animateBalanceNumber(targetBalance);
    if (santriData && santriData.name) {
      animateUserName(santriData.name);
    }
  }

  function switchToWaitingState() {
    if (isTransitioning) return;
    isTransitioning = true;
    stopPrivacyCountdown();

    // Fallback tanpa GSAP
    if (!hasGsap) {
      activeView.classList.remove('active');
      activeView.setAttribute('aria-hidden', 'true');
      waitingView.classList.add('active');
      waitingView.setAttribute('aria-hidden', 'false');
      stateContainer.classList.remove('state-active');
      stateContainer.classList.add('state-waiting');
      isTransitioning = false;
      return;
    }

    waitingView.classList.add('active');
    waitingView.setAttribute('aria-hidden', 'false');

    const fadeSpeed = CONFIG.animation.stateCrossFadeSpeed || 0.18;
    const tl = gsap.timeline({
      onComplete: () => {
        activeView.classList.remove('active');
        activeView.setAttribute('aria-hidden', 'true');
        stateContainer.classList.remove('state-active');
        stateContainer.classList.add('state-waiting');
        isTransitioning = false;
      }
    });

    tl.to(activeView, {
      opacity: 0,
      duration: fadeSpeed,
      ease: "power1.in"
    });

    tl.fromTo(waitingView,
      { opacity: 0 },
      { opacity: 1, duration: fadeSpeed * 1.2, ease: "power2.out" },
      "-=0.06"
    );
  }

  // --------------------------------------------------------------------------
  // 6. EVENT LISTENERS
  // --------------------------------------------------------------------------
  // Klik area sensor (pada layar sentuh / demo)
  if (rfidSensorArea) {
    rfidSensorArea.addEventListener('click', () => {
      showToast('Tempelkan kartu pada reader RFID.', 'info', 2500);
    });
  }

  // Tombol Selesai
  if (btnDone) {
    btnDone.addEventListener('click', () => {
      window.SantriKioskAPI.reset();
    });
  }

  // --------------------------------------------------------------------------
  // 7. FLOATING STATUS TOAST
  // --------------------------------------------------------------------------
  function hideToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (toastEl) {
      toastEl.hidden = true;
      toastEl.removeAttribute('data-type');
    }
  }

  function showToast(message, type, duration) {
    if (!toastEl) return;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }

    if (toastTextEl) toastTextEl.textContent = message || '';
    toastEl.hidden = false;
    toastEl.setAttribute('data-type', type || 'info');

    if (toastIconEl) {
      toastIconEl.className = type === 'error'
        ? 'ri-error-warning-line'
        : (type === 'info' ? 'ri-information-line' : 'ri-check-line');
    }

    if (duration && duration > 0) {
      toastTimer = setTimeout(hideToast, duration);
    }
  }

  window.addEventListener('kiosk:toast', (event) => {
    const detail = event.detail || {};
    showToast(detail.message, detail.type, detail.duration);
  });
  window.addEventListener('kiosk:toast-hide', hideToast);
  window.addEventListener('kiosk:error', (event) => {
    const detail = event.detail || {};
    showToast(detail.message || 'Terjadi kesalahan.', 'error', 4000);
  });

  // --------------------------------------------------------------------------
  // 8. SHORTCUT TERSEMBUNYI [ALT + S] UNTUK SIMULATOR KIOSK
  // (Tanpa tombol dan tanpa instruksi terlihat di layar)
  // --------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (devModal) {
        if (devModal.open) {
          devModal.close();
        } else {
          devModal.showModal();
        }
      }
    }
  });

  if (devModalClose && devModal) {
    devModalClose.addEventListener('click', () => {
      devModal.close();
    });
  }

  // Tombol 1: Cek ke Server API (Real Backend Test)
  if (simBtnLookup) {
    simBtnLookup.addEventListener('click', () => {
      const cardUid = document.getElementById('sim-input-card-uid').value;
      if (devModal) devModal.close();
      window.SantriKioskAPI.tapCard(cardUid);
    });
  }

  // Tombol 2: Terapkan Mock Data (Testing Manual)
  if (simBtnApply) {
    simBtnApply.addEventListener('click', () => {
      const cardUid = document.getElementById('sim-input-card-uid').value;
      const name = document.getElementById('sim-input-name').value;
      const balance = Number(document.getElementById('sim-input-balance').value) || 0;
      const nis = document.getElementById('sim-input-nis').value;
      const className = document.getElementById('sim-input-class').value;
      const dailyLimitInput = document.getElementById('sim-input-limit');
      const limitVal = dailyLimitInput ? Number(dailyLimitInput.value) || 100000 : 100000;

      window.SantriKioskAPI.setSantriData({
        cardUid,
        name,
        balance,
        nis,
        className,
        dailyLimit: limitVal,
        limitBulanan: limitVal,
        limitSaldo: 0,
        status: 'Kartu Aktif',
        accountType: 'Saldo Wallet'
      });

      if (devModal) devModal.close();
    });
  }

  // Tombol 3: Reset ke Standby
  if (simBtnReset) {
    simBtnReset.addEventListener('click', () => {
      window.SantriKioskAPI.reset();
      if (devModal) devModal.close();
    });
  }

  // --------------------------------------------------------------------------
  // 9. EVENT DISPATCH LISTENER DARI API
  // --------------------------------------------------------------------------
  window.addEventListener('kiosk:show-balance', (event) => {
    const { targetBalance, santri } = event.detail;
    switchToActiveState(targetBalance, santri);
  });

  window.addEventListener('kiosk:reset-state', () => {
    switchToWaitingState();
  });

});
