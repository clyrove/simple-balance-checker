/**
 * ============================================================================
 * KIOSK API & HARDWARE RFID SCANNER CONTROLLER
 * ============================================================================
 * Modul ini menangani:
 * 1. Pengambilan data saldo santri dari API riil (`https://ceksaldo.al-wafi.sch.id/api/lookup.php`)
 *    baik di Production maupun di Local Development (mendukung Direct & Local Dev Proxy).
 * 2. Micro-cache in-memory (5 detik) untuk mencegah double-tap jaringan berulang.
 * 3. Masking nomor kartu RFID seperti sandi (hanya 2 digit terakhir terlihat).
 * 4. Driver pendeteksi keyboard-wedge dari scanner RFID USB fisik (anti ketikan manusia).
 * 5. Tampilan 2 Limit (Limit Harian & Limit Bulanan) dengan fallback "Tidak ada data".
 * 6. Anti-jitter loading toast (tidak berkedip jika respons cepat).
 * ============================================================================
 */

(function (window, document) {
  'use strict';

  const CONFIG = window.KIOSK_CONFIG || {
    messages: {
      readingCard: 'Membaca kartu...',
      cardNotRegistered: 'Kartu tidak terdaftar. Silakan hubungi tim IT.',
      invalidCard: 'Nomor kartu tidak valid. Silakan hubungi tim IT.',
      networkError: 'Tidak dapat menghubungi server. Periksa koneksi atau hubungi tim IT.',
      timeoutError: 'Koneksi ke server timeout. Silakan coba lagi atau hubungi tim IT.',
      generalError: 'Gagal memeriksa saldo. Silakan hubungi tim IT.',
      noData: 'Tidak ada data',
      walletFallbackType: 'Saldo Wallet',
      unknownUser: 'Pemilik Wallet'
    },
    api: {
      productionBaseUrl: 'https://ceksaldo.al-wafi.sch.id',
      remoteEndpoint: 'https://ceksaldo.al-wafi.sch.id/api/lookup.php',
      localProxyEndpoint: 'http://127.0.0.1:8787/api/lookup.php',
      endpoint: 'https://ceksaldo.al-wafi.sch.id/api/lookup.php',
      isLocalDev: false,
      timeoutMs: 6000,
      cacheTtlMs: 5000,
      fallbackToMockOnOffline: false
    },
    timing: {
      autoCloseSeconds: 3,
      toastDurationMs: 3200,
      scanCharMaxIntervalMs: 55,
      scanSubmitMaxAgeMs: 120,
      scanMinChars: 5,
      scanCooldownMs: 600
    }
  };

  let currentActiveData = null;
  let isRequestBusy = false;
  let lastTapFinishedTime = 0;

  // Micro-cache in-memory: Map(walletId => { data, timestamp })
  const microCache = new Map();

  // Mock Database Lokal (digunakan jika tombol "Terapkan Mock" dipilih atau fallback diaktifkan)
  const LOCAL_MOCK_DATABASE = {
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

  // --------------------------------------------------------------------------
  // 1. HELPER FUNCTIONS
  // --------------------------------------------------------------------------
  /**
   * Format Rupiah standar Indonesia (misal: 350000 -> "350.000")
   */
  function formatRupiahNumber(num) {
    return new Intl.NumberFormat('id-ID').format(Math.round(num || 0));
  }

  /**
   * Helper format nilai limit belanja (Harian atau Bulanan).
   * Jika tidak ada value / bernilai 0 / undefined di server API,
   * kembalikan string aman "Tidak ada data" tanpa error.
   */
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

  /**
   * Masking nomor kartu RFID seperti password.
   * Hanya 2 digit terakhir yang ditampilkan, sisanya disamarkan titik bullet.
   * Contoh: "104928172" -> "ID: •••• ••72"
   */
  function maskRfidCardNumber(cardUid) {
    if (!cardUid) return 'ID: •••• ••--';
    const cleanStr = String(cardUid).trim();
    const lastTwoDigits = cleanStr.slice(-2);
    return `ID: •••• ••${lastTwoDigits}`;
  }

  /**
   * Memunculkan notifikasi toast mengambang di bawah layar kios
   */
  function showToast(message, type, duration) {
    const dur = typeof duration === 'number' ? duration : CONFIG.timing.toastDurationMs;
    window.dispatchEvent(new CustomEvent('kiosk:toast', {
      detail: {
        message: message || 'Terjadi kesalahan.',
        type: type || 'error',
        duration: dur
      }
    }));
  }

  /**
   * Menyusun daftar endpoint API yang akan dicoba secara berurutan.
   * Mendukung:
   * - Server Production (`https://ceksaldo.al-wafi.sch.id/api/lookup.php`)
   * - Local Dev Server / CORS Proxy (`http://127.0.0.1:8787/api/lookup.php`)
   * - Relative path (`api/lookup.php`) jika dijalankan di server PHP lokal
   */
  function getApiCandidateEndpoints() {
    const candidates = [];
    const remoteUrl = (CONFIG.api && CONFIG.api.remoteEndpoint) || 'https://ceksaldo.al-wafi.sch.id/api/lookup.php';
    const localProxyUrl = (CONFIG.api && CONFIG.api.localProxyEndpoint) || 'http://127.0.0.1:8787/api/lookup.php';
    const isLocalDev = !!(CONFIG.api && CONFIG.api.isLocalDev);

    if (isLocalDev) {
      // Jika user membuka lewat dev-server lokal di port 8787, gunakan relative/same-origin dulu
      if (window.location && window.location.port === '8787') {
        candidates.push('/api/lookup.php');
      }
      // Di environment lokal (Live Server 5500, file://, localhost), coba:
      // 1. Local Dev Proxy (127.0.0.1:8787) yang meneruskan ke https://ceksaldo.al-wafi.sch.id bebas CORS
      candidates.push(localProxyUrl);
      // 2. Direct ke https://ceksaldo.al-wafi.sch.id/api/lookup.php
      candidates.push(remoteUrl);
      // 3. Relative path jika dijalankan di Laragon / XAMPP lokal yang punya api/lookup.php
      if (window.location && window.location.protocol !== 'file:') {
        candidates.push('api/lookup.php');
      }
    } else {
      // Di server Production (ceksaldo.al-wafi.sch.id)
      candidates.push((CONFIG.api && CONFIG.api.endpoint) || remoteUrl);
      if (!candidates.includes(remoteUrl)) {
        candidates.push(remoteUrl);
      }
    }

    // Hilangkan duplikat
    return Array.from(new Set(candidates));
  }

  /**
   * Melakukan single HTTP POST request ke satu URL endpoint dengan timeout
   */
  async function requestEndpoint(url, cleanId, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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

      clearTimeout(timeoutId);

      const rawText = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(rawText);
      } catch (_) {
        payload = null;
      }

      // Pastikan respons benar-benar berasal dari API JSON (bukan halaman HTML 404/405 dari Live Server)
      if (!payload || typeof payload !== 'object' || typeof payload.success !== 'boolean') {
        const notApiErr = new Error('Non-JSON API response');
        notApiErr.isNotApiEndpoint = true;
        throw notApiErr;
      }

      return { response, payload };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // 2. PUBLIC API CONTROLLER (window.SantriKioskAPI)
  // --------------------------------------------------------------------------
  const SantriKioskAPI = {
    /**
     * Mengambil data santri dari backend API (`https://ceksaldo.al-wafi.sch.id/api/lookup.php`)
     * Mendukung penuh eksekusi dari Local Development maupun Production Server.
     */
    async fetchSantriByCardId(cardId) {
      const cleanId = String(cardId || '').replace(/\s+/g, '');

      // Validasi panjang karakter UID
      if (cleanId.length < 3) {
        return {
          success: false,
          code: 'invalid_wallet',
          message: (CONFIG.messages && CONFIG.messages.invalidCard) || 'Nomor kartu tidak valid. Silakan hubungi tim IT.'
        };
      }

      // 1. Cek Micro-cache in-memory (TTL 5 detik)
      const cached = microCache.get(cleanId);
      if (cached && (Date.now() - cached.timestamp < CONFIG.api.cacheTtlMs)) {
        return { success: true, data: cached.data, fromCache: true };
      }

      // 2. Coba daftar kandidat endpoint secara berurutan (Local Proxy -> Direct Remote -> Fallback)
      const endpoints = getApiCandidateEndpoints();
      let lastError = null;

      for (let i = 0; i < endpoints.length; i++) {
        const endpointUrl = endpoints[i];
        try {
          const { response, payload } = await requestEndpoint(
            endpointUrl,
            cleanId,
            CONFIG.api.timeoutMs || 6000
          );

          // Jika sukses ditemukan
          if (response.ok && payload.success === true && payload.data) {
            microCache.set(cleanId, {
              data: payload.data,
              timestamp: Date.now()
            });
            return { success: true, data: payload.data, endpoint: endpointUrl };
          }

          // Jika kartu tidak terdaftar atau ditolak oleh server API (misal HTTP 404 / 400 dari lookup.php)
          let errMsg = payload.message || (CONFIG.messages && CONFIG.messages.cardNotRegistered);
          if (errMsg) {
            errMsg = errMsg.replace(/petugas/gi, 'tim IT');
          }
          const errCode = payload.code || `HTTP_${response.status}`;

          return {
            success: false,
            code: errCode,
            message: errMsg,
            endpoint: endpointUrl
          };
        } catch (err) {
          lastError = err;
          // Lanjut coba kandidat endpoint berikutnya
        }
      }

      // 3. Jika seluruh endpoint gagal dihubungi (misal benar-benar offline)
      if (CONFIG.api.fallbackToMockOnOffline && LOCAL_MOCK_DATABASE[cleanId]) {
        return { success: true, data: LOCAL_MOCK_DATABASE[cleanId], fromMock: true };
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

    /**
     * Menerapkan data santri ke tampilan UI dan mengisi seluruh elemen ber-ID unik
     * Aman dari nilai null / undefined di API (menampilkan "Tidak ada data")
     */
    setSantriData(data) {
      if (!data) return;
      currentActiveData = { ...data };

      // 1. Sinkronisasi elemen hidden
      const elRawBalance = document.getElementById('kiosk-api-raw-balance');
      const elCardUid = document.getElementById('kiosk-api-card-uid');
      const elSantriId = document.getElementById('kiosk-api-santri-id');

      if (elRawBalance) elRawBalance.value = data.balance || 0;
      if (elCardUid) elCardUid.value = data.cardUid || data.wallet || '';
      if (elSantriId) elSantriId.value = data.nis || '';

      // 2. Nomor kartu terproteksi (masking password)
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

      // 3. Nama, NIS, Kelas, Status, Avatar
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

      // 4. Dua Limit: Limit Harian & Limit Bulanan (Aman jika tidak memiliki value di API)
      const elDailyLimit = document.getElementById('kiosk-daily-limit');
      const elMonthlyLimit = document.getElementById('kiosk-monthly-limit');

      const dailyVal = (data.limitHarian !== undefined && data.limitHarian !== null)
        ? data.limitHarian
        : data.dailyLimit;

      const monthlyVal = (data.limitBulanan !== undefined && data.limitBulanan !== null)
        ? data.limitBulanan
        : data.monthlyLimit;

      if (elDailyLimit) {
        elDailyLimit.textContent = formatLimitValue(dailyVal, 'hari');
      }

      if (elMonthlyLimit) {
        elMonthlyLimit.textContent = formatLimitValue(monthlyVal, 'bulan');
      }

      // 5. Inisial avatar 2 huruf
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

      // 6. Label waktu pembaruan
      if (elTimestamp) {
        const d = new Date();
        const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        elTimestamp.textContent = `Diperbarui pukul ${timeStr} WIB`;
      }

      // 7. Sembunyikan toast dan picu animasi tampilan saldo
      window.dispatchEvent(new CustomEvent('kiosk:toast-hide'));
      window.dispatchEvent(new CustomEvent('kiosk:show-balance', {
        detail: {
          targetBalance: Number(data.balance) || 0,
          santri: data
        }
      }));
    },

    /**
     * Memproses tap kartu: mengambil data dari API lalu menampilkan.
     * Dilengkapi anti-jitter delay pada loading toast & cooldown antar-tap.
     */
    async tapCard(cardId) {
      if (isRequestBusy) return;

      const now = Date.now();
      const cooldownMs = (CONFIG.timing && CONFIG.timing.scanCooldownMs) || 600;
      if (now - lastTapFinishedTime < cooldownMs) {
        return;
      }

      const cleanId = String(cardId || '').replace(/\s+/g, '');
      if (!cleanId) return;

      isRequestBusy = true;

      // Tampilkan toast "Membaca kartu..." HANYA jika request memakan waktu > 160ms
      // sehingga tidak terjadi kedipan/jitter saat respons cepat
      const readingMsg = (CONFIG.messages && CONFIG.messages.readingCard) || 'Membaca kartu...';
      const loadingToastTimer = setTimeout(() => {
        if (isRequestBusy) {
          showToast(readingMsg, 'info', 0);
        }
      }, 160);

      try {
        const res = await this.fetchSantriByCardId(cleanId);
        clearTimeout(loadingToastTimer);

        if (res && res.success && res.data) {
          this.setSantriData(res.data);
        } else {
          const notRegMsg = (res && res.message) || (CONFIG.messages && CONFIG.messages.cardNotRegistered) || 'Kartu tidak terdaftar. Silakan hubungi tim IT.';
          showToast(notRegMsg, 'error', CONFIG.timing.toastDurationMs);
        }
      } catch (err) {
        clearTimeout(loadingToastTimer);
        const genErrMsg = (CONFIG.messages && CONFIG.messages.generalError) || 'Gagal memeriksa saldo. Silakan hubungi tim IT.';
        showToast(genErrMsg, 'error', CONFIG.timing.toastDurationMs);
      } finally {
        isRequestBusy = false;
        lastTapFinishedTime = Date.now();
      }
    },

    /**
     * Reset kios kembali ke State 1 (Standby)
     */
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

  // --------------------------------------------------------------------------
  // 3. HARDWARE RFID SCANNER DRIVER (USB KEYBOARD-WEDGE ANTI KETIKAN MANUSIA)
  // --------------------------------------------------------------------------
  let rfidScanBuffer = '';
  let lastStrokeTime = 0;

  window.addEventListener('keydown', function (e) {
    // Jangan proses jika pengguna sedang mengetik di input modal [Alt + S]
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return;
    }
    const devModal = document.getElementById('kiosk-dev-modal');
    if (devModal && devModal.open) {
      return;
    }

    // Abaikan tombol yang ditahan (repeat) atau menggunakan modifier (Ctrl, Alt, Meta)
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) {
      rfidScanBuffer = '';
      return;
    }

    const now = Date.now();
    const maxCharInterval = (CONFIG.timing && CONFIG.timing.scanCharMaxIntervalMs) || 55;
    const maxSubmitAge = (CONFIG.timing && CONFIG.timing.scanSubmitMaxAgeMs) || 120;
    const minChars = (CONFIG.timing && CONFIG.timing.scanMinChars) || 5;

    // Enter atau Tab menandakan akhir scan dari hardware reader RFID
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

    // Reader RFID USB mengetik sangat rapat (< 55ms antar karakter)
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
