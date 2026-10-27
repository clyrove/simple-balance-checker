(function (window, document) {
  'use strict';

  const CONFIG = window.KIOSK_CONFIG || {};

  let currentActiveData = null;
  let isRequestBusy = false;
  let lastTapFinishedTime = 0;
  const microCache = new Map();

  const LOCAL_MOCK_DATABASE = {
    '104928172': {
      cardUid: '104928172',
      name: 'Ahmad Fauzi Ridwan',
      nis: '202401089',
      className: 'Kelas 10-A • Asrama Abu Bakar',
      balance: 350000,
      limitHarian: 100000,
      limitBulanan: 500000,
      status: 'Kartu Aktif',
      accountType: 'Saldo Wallet',
      initials: 'AF'
    },
    'STR-202401': {
      cardUid: 'STR-202401',
      name: 'Ahmad Fauzi Ridwan',
      nis: '202401089',
      className: 'Kelas 10-A • Asrama Abu Bakar',
      balance: 350000,
      limitHarian: 100000,
      limitBulanan: 500000,
      status: 'Kartu Aktif',
      accountType: 'Saldo Wallet',
      initials: 'AF'
    },
    'STR-202402': {
      cardUid: 'STR-202402',
      name: 'Fathimah Az-Zahra',
      nis: '202402014',
      className: 'Kelas 11-Tahfidz • Asrama Maryam',
      balance: 1250000,
      limitHarian: 150000,
      limitBulanan: 1500000,
      status: 'Kartu Aktif',
      accountType: 'Saldo Wallet',
      initials: 'FZ'
    },
    'STR-202403': {
      cardUid: 'STR-202403',
      name: 'Muhammad Al-Ghifari',
      nis: '202403072',
      className: 'Kelas 9-B • Asrama Umar',
      balance: 45000,
      limitHarian: 50000,
      limitBulanan: 300000,
      status: 'Kartu Aktif',
      accountType: 'Saldo Wallet',
      initials: 'MG'
    }
  };

  function formatRupiahNumber(num) {
    return new Intl.NumberFormat('id-ID').format(Math.round(num || 0));
  }

  function formatLimitValue(value, unitSuffix) {
    if (value === undefined || value === null || value === '') {
      return (CONFIG.messages && CONFIG.messages.noData) || 'Tidak ada data';
    }
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      return (CONFIG.messages && CONFIG.messages.noData) || 'Tidak ada data';
    }
    return `Rp ${formatRupiahNumber(num)}${unitSuffix ? ' / ' + unitSuffix : ''}`;
  }

  function maskRfidCardNumber(cardUid) {
    if (!cardUid) return 'ID: •••• ••--';
    const cleanStr = String(cardUid).trim();
    return `ID: •••• ••${cleanStr.slice(-2)}`;
  }

  function showToast(message, type, duration) {
    const dur = typeof duration === 'number' ? duration : ((CONFIG.timing && CONFIG.timing.toastDurationMs) || 3200);
    window.dispatchEvent(new CustomEvent('kiosk:toast', {
      detail: { message: message || 'Terjadi kesalahan.', type: type || 'error', duration: dur }
    }));
  }

  async function requestEndpoint(url, cleanId, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({ wallet: cleanId }).toString(),
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timer);

      const rawText = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(rawText);
      } catch (_) {
        payload = null;
      }

      if (!payload || typeof payload !== 'object' || typeof payload.success !== 'boolean') {
        throw new Error('Invalid JSON payload');
      }

      return { response, payload };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  const SantriKioskAPI = {
    async fetchSantriByCardId(cardId) {
      const cleanId = String(cardId || '').replace(/\s+/g, '');

      if (cleanId.length < 3) {
        return {
          success: false,
          code: 'invalid_wallet',
          message: (CONFIG.messages && CONFIG.messages.invalidCard) || 'Nomor kartu tidak valid. Silakan hubungi tim IT.'
        };
      }

      const cached = microCache.get(cleanId);
      const cacheTtl = (CONFIG.api && CONFIG.api.cacheTtlMs) || 5000;
      if (cached && (Date.now() - cached.timestamp < cacheTtl)) {
        return { success: true, data: cached.data, fromCache: true };
      }

      const endpoints = [];
      if (CONFIG.api && CONFIG.api.isLocalDev) {
        endpoints.push('http://127.0.0.1:8787/api/lookup.php');
      }
      if (CONFIG.api && CONFIG.api.endpoint) endpoints.push(CONFIG.api.endpoint);
      if (CONFIG.api && CONFIG.api.remoteEndpoint && !endpoints.includes(CONFIG.api.remoteEndpoint)) {
        endpoints.push(CONFIG.api.remoteEndpoint);
      }
      if (window.location && window.location.protocol !== 'file:' && !endpoints.includes('api/lookup.php')) {
        endpoints.push('api/lookup.php');
      }

      let lastError = null;

      for (const endpointUrl of endpoints) {
        try {
          const timeout = (CONFIG.api && CONFIG.api.timeoutMs) || 5000;
          const { response, payload } = await requestEndpoint(endpointUrl, cleanId, timeout);

          if (response.ok && payload.success === true && payload.data) {
            microCache.set(cleanId, { data: payload.data, timestamp: Date.now() });
            return { success: true, data: payload.data, endpoint: endpointUrl };
          }

          let errMsg = payload.message || (CONFIG.messages && CONFIG.messages.cardNotRegistered);
          if (errMsg) errMsg = errMsg.replace(/petugas/gi, 'tim IT');

          return {
            success: false,
            code: payload.code || `HTTP_${response.status}`,
            message: errMsg,
            endpoint: endpointUrl
          };
        } catch (err) {
          lastError = err;
        }
      }

      if (CONFIG.api && CONFIG.api.fallbackToMockOnOffline) {
        if (LOCAL_MOCK_DATABASE[cleanId]) {
          return { success: true, data: LOCAL_MOCK_DATABASE[cleanId], fromMock: true };
        }
        return {
          success: true,
          data: {
            cardUid: cleanId,
            name: 'Santri (' + cleanId.slice(-4) + ')',
            nis: '2024' + cleanId.slice(-4),
            className: 'Kelas 10 • Asrama Al-Wafi',
            balance: 350000,
            limitHarian: 100000,
            limitBulanan: 500000,
            status: 'Kartu Aktif',
            accountType: 'Saldo Wallet',
            initials: 'ST'
          },
          fromMock: true
        };
      }

      const isTimeout = lastError && lastError.name === 'AbortError';
      return {
        success: false,
        code: isTimeout ? 'timeout' : 'network_error',
        message: isTimeout
          ? (CONFIG.messages && CONFIG.messages.timeoutError) || 'Koneksi ke server timeout. Silakan coba lagi atau hubungi tim IT.'
          : (CONFIG.messages && CONFIG.messages.networkError) || 'Tidak dapat menghubungi server. Periksa koneksi atau hubungi tim IT.'
      };
    },

    setSantriData(data) {
      if (!data) return;
      currentActiveData = { ...data };

      const elRawBalance = document.getElementById('kiosk-api-raw-balance');
      const elCardUid = document.getElementById('kiosk-api-card-uid');
      const elSantriId = document.getElementById('kiosk-api-santri-id');

      if (elRawBalance) elRawBalance.value = data.balance || 0;
      if (elCardUid) elCardUid.value = data.cardUid || data.wallet || '';
      if (elSantriId) elSantriId.value = data.nis || '';

      const elMaskedCard = document.getElementById('kiosk-card-masked-number');
      const maskedString = maskRfidCardNumber(data.cardUid || data.wallet);
      if (elMaskedCard) {
        const textSpan = elMaskedCard.querySelector('.masked-text');
        if (textSpan) {
          textSpan.textContent = maskedString;
        } else {
          elMaskedCard.textContent = maskedString;
        }
      }

      const elName = document.getElementById('kiosk-user-name');
      const elNis = document.getElementById('kiosk-user-nis');
      const elClass = document.getElementById('kiosk-user-class');
      const elStatus = document.getElementById('kiosk-account-status');
      const elInitials = document.getElementById('kiosk-user-initials');
      const elAccountType = document.getElementById('kiosk-account-type');
      const elTimestamp = document.getElementById('kiosk-last-tap-time');

      const noDataText = (CONFIG.messages && CONFIG.messages.noData) || 'Tidak ada data';

      if (elName) elName.textContent = data.name || (CONFIG.messages && CONFIG.messages.unknownUser) || 'Pemilik Wallet';
      if (elNis) elNis.textContent = data.nis ? ('NIS: ' + data.nis) : ('NIS: ' + noDataText);
      if (elClass) elClass.textContent = data.className || noDataText;
      if (elStatus) elStatus.textContent = data.status || (CONFIG.messages && CONFIG.messages.cardActive) || 'Kartu Aktif';
      if (elAccountType) elAccountType.textContent = data.accountType || (CONFIG.messages && CONFIG.messages.walletFallbackType) || 'Saldo Wallet';

      const elDailyLimit = document.getElementById('kiosk-daily-limit');
      const elMonthlyLimit = document.getElementById('kiosk-monthly-limit');

      const dailyVal = (data.limitHarian !== undefined && data.limitHarian !== null)
        ? data.limitHarian
        : data.dailyLimit;

      const monthlyVal = (data.limitBulanan !== undefined && data.limitBulanan !== null)
        ? data.limitBulanan
        : data.monthlyLimit;

      if (elDailyLimit) elDailyLimit.textContent = formatLimitValue(dailyVal, 'hari');
      if (elMonthlyLimit) elMonthlyLimit.textContent = formatLimitValue(monthlyVal, 'bulan');

      if (elInitials) {
        if (data.initials) {
          elInitials.textContent = data.initials;
        } else if (data.name) {
          const words = data.name.trim().split(/\s+/);
          elInitials.textContent = (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
        } else {
          elInitials.textContent = 'ST';
        }
      }

      if (elTimestamp) {
        const d = new Date();
        const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        elTimestamp.textContent = `Diperbarui pukul ${timeStr} WIB`;
      }

      window.dispatchEvent(new CustomEvent('kiosk:toast-hide'));
      window.dispatchEvent(new CustomEvent('kiosk:show-balance', {
        detail: {
          targetBalance: Number(data.balance) || 0,
          santri: data
        }
      }));
    },

    async tapCard(cardId) {
      if (isRequestBusy) return;

      const now = Date.now();
      const cooldown = (CONFIG.timing && CONFIG.timing.scanCooldownMs) || 600;
      if (now - lastTapFinishedTime < cooldown) return;

      const cleanId = String(cardId || '').replace(/\s+/g, '');
      if (!cleanId) return;

      isRequestBusy = true;

      const readingMsg = (CONFIG.messages && CONFIG.messages.readingCard) || 'Membaca kartu...';
      const loadingToastTimer = setTimeout(() => {
        if (isRequestBusy) showToast(readingMsg, 'info', 0);
      }, 160);

      try {
        const res = await this.fetchSantriByCardId(cleanId);
        clearTimeout(loadingToastTimer);

        if (res && res.success && res.data) {
          this.setSantriData(res.data);
        } else {
          const notRegMsg = (res && res.message) || (CONFIG.messages && CONFIG.messages.cardNotRegistered);
          showToast(notRegMsg, 'error', (CONFIG.timing && CONFIG.timing.toastDurationMs) || 3200);
        }
      } catch (_) {
        clearTimeout(loadingToastTimer);
        const genErrMsg = (CONFIG.messages && CONFIG.messages.generalError) || 'Gagal memeriksa saldo. Silakan hubungi tim IT.';
        showToast(genErrMsg, 'error', (CONFIG.timing && CONFIG.timing.toastDurationMs) || 3200);
      } finally {
        isRequestBusy = false;
        lastTapFinishedTime = Date.now();
      }
    },

    reset() {
      window.dispatchEvent(new CustomEvent('kiosk:reset-state'));
    },

    getCurrentData() {
      return currentActiveData;
    },

    formatRupiah(num) {
      return formatRupiahNumber(num);
    },

    maskCard(uid) {
      return maskRfidCardNumber(uid);
    }
  };

  window.SantriKioskAPI = SantriKioskAPI;

  let rfidScanBuffer = '';
  let lastStrokeTime = 0;

  window.addEventListener('keydown', function (e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const devModal = document.getElementById('kiosk-dev-modal');
    if (devModal && devModal.open) return;

    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) {
      rfidScanBuffer = '';
      return;
    }

    const now = Date.now();
    const maxCharInterval = (CONFIG.timing && CONFIG.timing.scanCharMaxIntervalMs) || 55;
    const maxSubmitAge = (CONFIG.timing && CONFIG.timing.scanSubmitMaxAgeMs) || 120;
    const minChars = (CONFIG.timing && CONFIG.timing.scanMinChars) || 5;

    if (e.key === 'Enter' || e.key === 'Tab') {
      const scanned = rfidScanBuffer.trim();
      const age = now - lastStrokeTime;
      rfidScanBuffer = '';
      lastStrokeTime = now;

      if (scanned.length >= minChars && age <= maxSubmitAge) {
        e.preventDefault();
        SantriKioskAPI.tapCard(scanned);
      }
      return;
    }

    if (now - lastStrokeTime > maxCharInterval) {
      rfidScanBuffer = '';
    }
    lastStrokeTime = now;

    if (e.key && e.key.length === 1 && /^[0-9a-zA-Z\-]$/.test(e.key)) {
      rfidScanBuffer += e.key;
    } else {
      rfidScanBuffer = '';
    }
  });

})(window, document);
