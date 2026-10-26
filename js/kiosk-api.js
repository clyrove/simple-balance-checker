/**
 * ============================================================================
 * KIOSK API & HARDWARE RFID SCANNER CONTROLLER
 * ============================================================================
 * Modul ini menangani:
 * 1. Pengambilan data saldo santri dari API riil backend (`api/lookup.php`).
 * 2. Micro-cache in-memory (5 detik) untuk mencegah double-tap jaringan berulang.
 * 3. Masking nomor kartu RFID seperti sandi (hanya 2 digit terakhir terlihat).
 * 4. Driver pendeteksi keyboard-wedge dari scanner RFID USB fisik.
 * 5. Tampilan 2 Limit (Limit Harian & Limit Bulanan) dengan fallback "Tidak ada data".
 * 6. Seluruh pesan status & error terpusat dari `KIOSK_CONFIG.messages`.
 * ============================================================================
 */

(function (window, document) {
  'use strict';

  // Ambil referensi konfigurasi terpusat
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
    api: { endpoint: 'api/lookup.php', timeoutMs: 6000, cacheTtlMs: 5000, fallbackToMockOnOffline: true },
    timing: { autoCloseSeconds: 3, toastDurationMs: 4000, scanCharMaxIntervalMs: 400, scanSubmitMaxAgeMs: 2000 }
  };

  let currentActiveData = null;
  let isRequestBusy = false;

  // Micro-cache in-memory: Map(walletId => { data, timestamp })
  const microCache = new Map();

  // Mock Database Lokal sebagai fallback jika server offline / demo
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

  // --------------------------------------------------------------------------
  // 2. PUBLIC API CONTROLLER (window.SantriKioskAPI)
  // --------------------------------------------------------------------------
  const SantriKioskAPI = {
    /**
     * Mengambil data santri dari backend API /api/lookup.php
     * Menggunakan AbortController, timeout, micro-cache, dan offline fallback
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

      // 2. Request jaringan ke backend endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.api.timeoutMs);

      try {
        const response = await fetch(CONFIG.api.endpoint, {
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

        let payload;
        try {
          payload = await response.json();
        } catch (jsonErr) {
          payload = null;
        }

        // Tangani respons HTTP dan payload sukses
        if (response.ok && payload && payload.success === true && payload.data) {
          // Simpan ke micro-cache
          microCache.set(cleanId, {
            data: payload.data,
            timestamp: Date.now()
          });
          return { success: true, data: payload.data };
        }

        // Jika kartu tidak terdaftar di backend (HTTP 404 / 400)
        let errMsg = (payload && payload.message) || (CONFIG.messages && CONFIG.messages.cardNotRegistered);
        // Ganti kata "petugas" dengan "tim IT" jika ada di pesan dari backend
        if (errMsg) {
          errMsg = errMsg.replace(/petugas/gi, 'tim IT');
        }
        const errCode = (payload && payload.code) || `HTTP_${response.status}`;

        // Fallback ke mock jika server mengembalikan 404 pada data test
        if (LOCAL_MOCK_DATABASE[cleanId]) {
          return { success: true, data: LOCAL_MOCK_DATABASE[cleanId], fromMock: true };
        }

        return { success: false, code: errCode, message: errMsg };

      } catch (err) {
        clearTimeout(timeoutId);

        const isTimeout = err.name === 'AbortError';

        // Jika offline atau jaringan gagal, dan fallback diaktifkan
        if (CONFIG.api.fallbackToMockOnOffline && LOCAL_MOCK_DATABASE[cleanId]) {
          return { success: true, data: LOCAL_MOCK_DATABASE[cleanId], fromMock: true };
        }

        return {
          success: false,
          code: isTimeout ? 'timeout' : 'network_error',
          message: isTimeout
            ? (CONFIG.messages && CONFIG.messages.timeoutError) || 'Koneksi ke server timeout. Silakan coba lagi atau hubungi tim IT.'
            : (CONFIG.messages && CONFIG.messages.networkError) || 'Tidak dapat menghubungi server. Periksa koneksi atau hubungi tim IT.'
        };
      }
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
      if (elCardUid) elCardUid.value = data.cardUid || '';
      if (elSantriId) elSantriId.value = data.nis || '';

      // 2. Nomor kartu terproteksi (masking password)
      const elMaskedCard = document.getElementById('kiosk-card-masked-number');
      const maskedString = maskRfidCardNumber(data.cardUid);
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

      // Ambil nilai dari field API:
      // Limit Harian: data.limitHarian atau data.dailyLimit
      const dailyVal = (data.limitHarian !== undefined && data.limitHarian !== null)
        ? data.limitHarian
        : data.dailyLimit;

      // Limit Bulanan: data.limitBulanan atau data.monthlyLimit
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

      // 7. Sembunyikan toast dan pemicu animasi tampilan saldo
      window.dispatchEvent(new CustomEvent('kiosk:toast-hide'));
      window.dispatchEvent(new CustomEvent('kiosk:show-balance', {
        detail: {
          targetBalance: Number(data.balance) || 0,
          santri: data
        }
      }));
    },

    /**
     * Memproses tap kartu: mengambil data dari API lalu menampilkan
     */
    async tapCard(cardId) {
      if (isRequestBusy) return;
      const cleanId = String(cardId || '').replace(/\s+/g, '');
      if (!cleanId) return;

      isRequestBusy = true;
      const readingMsg = (CONFIG.messages && CONFIG.messages.readingCard) || 'Membaca kartu...';
      showToast(readingMsg, 'info', 0);

      try {
        const res = await this.fetchSantriByCardId(cleanId);
        if (res && res.success && res.data) {
          this.setSantriData(res.data);
        } else {
          const notRegMsg = (res && res.message) || (CONFIG.messages && CONFIG.messages.cardNotRegistered) || 'Kartu tidak terdaftar. Silakan hubungi tim IT.';
          showToast(notRegMsg, 'error', CONFIG.timing.toastDurationMs);
        }
      } catch (err) {
        const genErrMsg = (CONFIG.messages && CONFIG.messages.generalError) || 'Gagal memeriksa saldo. Silakan hubungi tim IT.';
        showToast(genErrMsg, 'error', CONFIG.timing.toastDurationMs);
      } finally {
        isRequestBusy = false;
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
  // 3. HARDWARE RFID SCANNER DRIVER (USB KEYBOARD-WEDGE)
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

    const now = Date.now();

    // Enter atau Tab menandakan akhir scan dari hardware reader
    if (e.key === 'Enter' || e.key === 'Tab') {
      const scanned = rfidScanBuffer.trim();
      const age = now - lastStrokeTime;
      rfidScanBuffer = '';
      lastStrokeTime = now;

      if (scanned.length >= 3 && age <= CONFIG.timing.scanSubmitMaxAgeMs) {
        e.preventDefault();
        SantriKioskAPI.tapCard(scanned);
      }
      return;
    }

    // Reader RFID USB mengetik sangat rapat (<400ms antar karakter)
    if (now - lastStrokeTime > CONFIG.timing.scanCharMaxIntervalMs) {
      rfidScanBuffer = '';
    }
    lastStrokeTime = now;

    if (e.key && e.key.length === 1) {
      rfidScanBuffer += e.key;
    }
  });

})(window, document);
