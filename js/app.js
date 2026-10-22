/**
 * ============================================================================
 * KIOSK APPLICATION & GSAP ANIMATION ENGINE
 * ============================================================================
 * Menangani:
 * 1. Jam Digital Kiosk (WIB & Format Tanggal Indonesia)
 * 2. GSAP SplitText Character & Rolling Counter Saldo
 * 3. Transisi State 1 (Waiting RFID) <-> State 2 (Active Balance) tanpa pergeseran layout (Zero Layout Shift)
 * 4. Timer Privasi 3 Detik dengan visual progress bar
 * 5. Shortcut tersembunyi [Alt + S] untuk membuka simulator/konsol settingan
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

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

  // Timer Configuration
  const COUNTDOWN_TOTAL_SECONDS = 3;
  let remainingSeconds = COUNTDOWN_TOTAL_SECONDS;
  let countdownTimer = null;
  let countdownTween = null;
  let isTransitioning = false;

  // --------------------------------------------------------------------------
  // 2. REAL-TIME DIGITAL CLOCK (WIB & TANGGAL INDONESIA)
  // --------------------------------------------------------------------------
  function updateKioskClock() {
    const now = new Date();

    // Tanggal format Indonesia (Contoh: "Kamis, 22 Okt 2026")
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
  // 3. SPLIT TEXT & GSAP ANIMATION COUNTER
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
   */
  function animateBalanceNumber(targetBalance) {
    if (!balanceAmountEl || typeof gsap === 'undefined') {
      if (balanceAmountEl) {
        balanceAmountEl.textContent = window.SantriKioskAPI.formatRupiah(targetBalance);
      }
      return;
    }

    const counterObj = { value: 0 };
    const duration = 0.95; // Cepat dan responsif untuk kiosk 3 detik

    gsap.to(counterObj, {
      value: targetBalance,
      duration: duration,
      ease: "power2.out",
      onUpdate: () => {
        balanceAmountEl.textContent = window.SantriKioskAPI.formatRupiah(counterObj.value);
      },
      onComplete: () => {
        // Pada akhir hitungan, tambahkan animasi staggered spring bounce
        const finalFormatted = window.SantriKioskAPI.formatRupiah(targetBalance);
        const spans = splitTextToChars(balanceAmountEl, finalFormatted);

        gsap.fromTo(spans, 
          { y: 16, opacity: 0 }, 
          {
            y: 0,
            opacity: 1,
            duration: 0.35,
            stagger: 0.025,
            ease: "back.out(2)"
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
    const spans = splitTextToChars(userNameEl, nameText);

    gsap.fromTo(spans,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.28, stagger: 0.015, ease: "power2.out" }
    );
  }

  // --------------------------------------------------------------------------
  // 4. TIMER PRIVASI 3 DETIK (PROGRESS BAR HALUS)
  // --------------------------------------------------------------------------
  function startPrivacyCountdown() {
    stopPrivacyCountdown();
    remainingSeconds = COUNTDOWN_TOTAL_SECONDS;
    if (timerSecondsEl) timerSecondsEl.textContent = remainingSeconds;

    // Reset progress bar dan jalankan GSAP tween
    if (countdownProgressEl) {
      gsap.killTweensOf(countdownProgressEl);
      gsap.set(countdownProgressEl, { scaleX: 1 });
      countdownTween = gsap.to(countdownProgressEl, {
        scaleX: 0,
        duration: COUNTDOWN_TOTAL_SECONDS,
        ease: "linear"
      });
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

    activeView.classList.add('active');
    activeView.setAttribute('aria-hidden', 'false');

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
      duration: 0.18,
      ease: "power1.in"
    });

    tl.fromTo(activeView,
      { opacity: 0 },
      { opacity: 1, duration: 0.22, ease: "power2.out" },
      "-=0.08"
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

    waitingView.classList.add('active');
    waitingView.setAttribute('aria-hidden', 'false');

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
      duration: 0.18,
      ease: "power1.in"
    });

    tl.fromTo(waitingView,
      { opacity: 0 },
      { opacity: 1, duration: 0.22, ease: "power2.out" },
      "-=0.08"
    );
  }

  // --------------------------------------------------------------------------
  // 6. EVENT LISTENERS
  // --------------------------------------------------------------------------
  // Area sentuh sensor (untuk pengujian klik / touchscreen)
  if (rfidSensorArea) {
    rfidSensorArea.addEventListener('click', () => {
      window.SantriKioskAPI.tapCard('STR-202401');
    });
  }

  // Tombol Selesai
  if (btnDone) {
    btnDone.addEventListener('click', () => {
      window.SantriKioskAPI.reset();
    });
  }

  // --------------------------------------------------------------------------
  // 7. SHORTCUT TERSEMBUNYI [ALT + S] UNTUK SIMULATOR KIOSK
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

  // Submit Simulator Form
  if (simBtnApply) {
    simBtnApply.addEventListener('click', () => {
      const cardUid = document.getElementById('sim-input-card-uid').value;
      const name = document.getElementById('sim-input-name').value;
      const balance = Number(document.getElementById('sim-input-balance').value) || 0;
      const nis = document.getElementById('sim-input-nis').value;
      const className = document.getElementById('sim-input-class').value;
      const dailyLimitInput = document.getElementById('sim-input-limit');
      const dailyLimit = dailyLimitInput ? Number(dailyLimitInput.value) || 100000 : 100000;

      window.SantriKioskAPI.setSantriData({
        cardUid,
        name,
        balance,
        nis,
        className,
        dailyLimit,
        status: 'Kartu Aktif'
      });

      if (devModal) devModal.close();
    });
  }

  if (simBtnReset) {
    simBtnReset.addEventListener('click', () => {
      window.SantriKioskAPI.reset();
      if (devModal) devModal.close();
    });
  }

  // --------------------------------------------------------------------------
  // 8. DISPATCH EVENT LISTENER DARI API
  // --------------------------------------------------------------------------
  window.addEventListener('kiosk:show-balance', (event) => {
    const { targetBalance, santri } = event.detail;
    switchToActiveState(targetBalance, santri);
  });

  window.addEventListener('kiosk:reset-state', () => {
    switchToWaitingState();
  });

});
