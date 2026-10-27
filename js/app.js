document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const hasGsap = typeof window.gsap !== 'undefined';
  const CONFIG = window.KIOSK_CONFIG || {};

  const stateContainer = document.getElementById('kiosk-state-container');
  const waitingView = document.getElementById('kiosk-waiting-view');
  const activeView = document.getElementById('kiosk-active-view');
  const rfidSensorArea = document.getElementById('kiosk-rfid-sensor-area');
  const btnDone = document.getElementById('kiosk-btn-done');

  const balanceAmountEl = document.getElementById('kiosk-balance-amount');
  const userNameEl = document.getElementById('kiosk-user-name');

  const clockDateEl = document.getElementById('kiosk-live-date');
  const clockHoursEl = document.getElementById('kiosk-clock-hours');
  const clockMinutesEl = document.getElementById('kiosk-clock-minutes');
  const clockSecondsEl = document.getElementById('kiosk-clock-seconds');

  const timerSecondsEl = document.getElementById('kiosk-timer-seconds');
  const countdownProgressEl = document.getElementById('kiosk-countdown-progress');

  const devModal = document.getElementById('kiosk-dev-modal');
  const devModalClose = document.getElementById('modal-dev-close');
  const simBtnApply = document.getElementById('sim-btn-apply');
  const simBtnReset = document.getElementById('sim-btn-reset');
  const simBtnLookup = document.getElementById('sim-btn-lookup');

  const toastEl = document.getElementById('kiosk-toast');
  const toastTextEl = document.getElementById('kiosk-toast-text');
  const toastIconEl = document.getElementById('kiosk-toast-icon');
  let toastTimer = null;
  let toastHideAnimTimer = null;
  let currentToastMsg = '';
  let currentToastType = '';
  let isToastShowing = false;

  const COUNTDOWN_TOTAL_SECONDS = (CONFIG.timing && CONFIG.timing.autoCloseSeconds) || 3;
  let remainingSeconds = COUNTDOWN_TOTAL_SECONDS;
  let countdownTimer = null;
  let countdownTween = null;
  let isTransitioning = false;

  function updateKioskClock() {
    const now = new Date();
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
    if (clockDateEl) clockDateEl.textContent = now.toLocaleDateString('id-ID', dateOptions);

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    if (clockHoursEl) clockHoursEl.textContent = hours;
    if (clockMinutesEl) clockMinutesEl.textContent = minutes;
    if (clockSecondsEl) clockSecondsEl.textContent = seconds;
  }

  updateKioskClock();
  setInterval(updateKioskClock, 1000);

  function splitTextToChars(element, text) {
    if (!element) return [];
    element.innerHTML = '';
    const chars = text.split('');
    const charElements = [];

    chars.forEach((char) => {
      const span = document.createElement('span');
      span.className = 'split-char';
      span.textContent = char;
      if (char === ' ') span.style.width = '0.3em';
      element.appendChild(span);
      charElements.push(span);
    });

    return charElements;
  }

  function animateBalanceNumber(targetAmount) {
    if (!balanceAmountEl) return;
    const finalFormatted = window.SantriKioskAPI.formatRupiah(targetAmount);

    if (!hasGsap) {
      balanceAmountEl.textContent = finalFormatted;
      return;
    }

    const counterState = { val: 0 };
    const counterSpeed = (CONFIG.animation && CONFIG.animation.counterSpeed) || 0.4;
    const counterEasing = (CONFIG.animation && CONFIG.animation.counterEasing) || 'power2.out';
    const bounceSpeed = (CONFIG.animation && CONFIG.animation.splitBounceSpeed) || 0.35;
    const bounceEasing = (CONFIG.animation && CONFIG.animation.splitBounceEasing) || 'back.out(2)';

    gsap.killTweensOf(counterState);

    gsap.to(counterState, {
      val: targetAmount,
      duration: counterSpeed,
      ease: counterEasing,
      onUpdate: () => {
        balanceAmountEl.textContent = window.SantriKioskAPI.formatRupiah(counterState.val);
      },
      onComplete: () => {
        const splitChars = splitTextToChars(balanceAmountEl, finalFormatted);
        gsap.fromTo(
          splitChars,
          { y: 14, opacity: 0.35, scale: 0.94 },
          { y: 0, opacity: 1, scale: 1, duration: bounceSpeed, stagger: 0.018, ease: bounceEasing }
        );
      }
    });
  }

  function animateUserName(nameText) {
    if (!userNameEl) return;
    userNameEl.textContent = nameText;
    if (!hasGsap) return;

    gsap.fromTo(
      userNameEl,
      { y: 8, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: (CONFIG.animation && CONFIG.animation.userNameRevealSpeed) || 0.25,
        ease: (CONFIG.animation && CONFIG.animation.userNameRevealEasing) || 'power2.out',
        delay: 0.04
      }
    );
  }

  function startPrivacyCountdown() {
    stopPrivacyCountdown();
    remainingSeconds = COUNTDOWN_TOTAL_SECONDS;
    if (timerSecondsEl) timerSecondsEl.textContent = remainingSeconds;

    if (countdownProgressEl) {
      if (hasGsap) {
        gsap.set(countdownProgressEl, { scaleX: 1 });
        countdownTween = gsap.to(countdownProgressEl, {
          scaleX: 0,
          duration: COUNTDOWN_TOTAL_SECONDS,
          ease: 'none'
        });
      } else {
        countdownProgressEl.style.transform = 'scaleX(0)';
      }
    }

    countdownTimer = setInterval(() => {
      remainingSeconds -= 1;
      if (timerSecondsEl) timerSecondsEl.textContent = Math.max(0, remainingSeconds);

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

  function switchToActiveState(targetBalance, santriData) {
    if (isTransitioning) return;
    isTransitioning = true;

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

    const fadeSpeed = (CONFIG.animation && CONFIG.animation.stateCrossFadeSpeed) || 0.18;
    const tl = gsap.timeline({
      onComplete: () => {
        waitingView.classList.remove('active');
        waitingView.setAttribute('aria-hidden', 'true');
        stateContainer.classList.remove('state-waiting');
        stateContainer.classList.add('state-active');
        isTransitioning = false;
        startPrivacyCountdown();
      }
    });

    tl.to(waitingView, { opacity: 0, duration: fadeSpeed, ease: 'power1.in' });
    tl.fromTo(activeView, { opacity: 0 }, { opacity: 1, duration: fadeSpeed * 1.2, ease: 'power2.out' }, '-=0.06');

    animateBalanceNumber(targetBalance);
    if (santriData && santriData.name) animateUserName(santriData.name);
  }

  function switchToWaitingState() {
    if (isTransitioning) return;
    isTransitioning = true;
    stopPrivacyCountdown();

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

    const fadeSpeed = (CONFIG.animation && CONFIG.animation.stateCrossFadeSpeed) || 0.18;
    const tl = gsap.timeline({
      onComplete: () => {
        activeView.classList.remove('active');
        activeView.setAttribute('aria-hidden', 'true');
        stateContainer.classList.remove('state-active');
        stateContainer.classList.add('state-waiting');
        isTransitioning = false;
      }
    });

    tl.to(activeView, { opacity: 0, duration: fadeSpeed, ease: 'power1.in' });
    tl.fromTo(waitingView, { opacity: 0 }, { opacity: 1, duration: fadeSpeed * 1.2, ease: 'power2.out' }, '-=0.06');
  }

  if (rfidSensorArea) {
    rfidSensorArea.addEventListener('click', () => {
      if (window.KioskSecurity && window.KioskSecurity.isLocked()) return;
      const promptMsg = (CONFIG.messages && CONFIG.messages.touchPrompt) || 'Tempelkan kartu pada reader RFID.';
      showToast(promptMsg, 'info', 2400);
    });
  }

  if (btnDone) {
    btnDone.addEventListener('click', () => {
      window.SantriKioskAPI.reset();
    });
  }

  function hideToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (toastHideAnimTimer) {
      clearTimeout(toastHideAnimTimer);
      toastHideAnimTimer = null;
    }
    if (!toastEl || !isToastShowing) return;

    isToastShowing = false;
    currentToastMsg = '';
    currentToastType = '';
    toastEl.classList.remove('is-visible');

    toastHideAnimTimer = setTimeout(() => {
      if (!isToastShowing && toastEl) toastEl.hidden = true;
    }, 210);
  }

  function showToast(message, type, duration) {
    if (!toastEl) return;
    const cleanMsg = String(message || '').trim();
    const resolvedType = type || 'info';
    if (!cleanMsg) return;

    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (toastHideAnimTimer) {
      clearTimeout(toastHideAnimTimer);
      toastHideAnimTimer = null;
    }

    if (isToastShowing && currentToastMsg === cleanMsg && currentToastType === resolvedType) {
      if (duration && duration > 0) toastTimer = setTimeout(hideToast, duration);
      return;
    }

    currentToastMsg = cleanMsg;
    currentToastType = resolvedType;

    if (toastTextEl) toastTextEl.textContent = cleanMsg;
    toastEl.setAttribute('data-type', resolvedType);

    if (toastIconEl) {
      toastIconEl.className = resolvedType === 'error'
        ? 'ri-error-warning-line'
        : (resolvedType === 'info' ? 'ri-information-line' : 'ri-check-line');
    }

    if (!isToastShowing) {
      toastEl.hidden = false;
      isToastShowing = true;
      requestAnimationFrame(() => {
        if (toastEl && isToastShowing) toastEl.classList.add('is-visible');
      });
    } else {
      toastEl.hidden = false;
      toastEl.classList.add('is-visible');
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
    const errMsg = detail.message || (CONFIG.messages && CONFIG.messages.generalError) || 'Terjadi kesalahan. Silakan hubungi tim IT.';
    showToast(errMsg, 'error', 3500);
  });

  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
      e.preventDefault();
      if (window.KioskSecurity && window.KioskSecurity.isLocked()) return;
      if (e.repeat) return;

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

  if (simBtnLookup) {
    simBtnLookup.addEventListener('click', () => {
      const cardUid = document.getElementById('sim-input-card-uid').value;
      if (devModal) devModal.close();
      window.SantriKioskAPI.tapCard(cardUid);
    });
  }

  if (simBtnApply) {
    simBtnApply.addEventListener('click', () => {
      const cardUid = document.getElementById('sim-input-card-uid').value;
      const name = document.getElementById('sim-input-name').value;
      const balance = Number(document.getElementById('sim-input-balance').value) || 0;
      const nis = document.getElementById('sim-input-nis').value;
      const className = document.getElementById('sim-input-class').value;

      const dailyLimitInput = document.getElementById('sim-input-daily-limit');
      const monthlyLimitInput = document.getElementById('sim-input-monthly-limit');

      const dailyLimitVal = dailyLimitInput ? Number(dailyLimitInput.value) || 100000 : 100000;
      const monthlyLimitVal = monthlyLimitInput ? Number(monthlyLimitInput.value) || 500000 : 500000;

      window.SantriKioskAPI.setSantriData({
        cardUid,
        name,
        balance,
        nis,
        className,
        limitHarian: dailyLimitVal,
        limitBulanan: monthlyLimitVal,
        dailyLimit: dailyLimitVal,
        monthlyLimit: monthlyLimitVal,
        status: (CONFIG.messages && CONFIG.messages.cardActive) || 'Kartu Aktif',
        accountType: (CONFIG.messages && CONFIG.messages.walletFallbackType) || 'Saldo Wallet'
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

  window.addEventListener('kiosk:show-balance', (event) => {
    const { targetBalance, santri } = event.detail;
    switchToActiveState(targetBalance, santri);
  });

  window.addEventListener('kiosk:reset-state', () => {
    switchToWaitingState();
  });

});
