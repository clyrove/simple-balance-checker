/**
 * ============================================================================
 * KIOSK API & HARDWARE RFID SCANNER CONTROLLER
 * ============================================================================
 * Modul ini menangani:
 * 1. Pengambilan data saldo santri dari API riil backend (`api/lookup.php`).
 * 2. Micro-cache in-memory (5 detik) untuk mencegah double-tap jaringan berulang.
 * 3. Masking nomor kartu RFID seperti sandi (hanya 2 digit terakhir terlihat).
 * 4. Driver pendeteksi keyboard-wedge dari scanner RFID USB fisik.
 * 5. Antarmuka global `window.SantriKioskAPI` yang mudah dibaca & di-maintain.
 * ============================================================================
 */

(function (window, document) {
  'use strict';

  // Ambil referensi konfigurasi terpusat
  const CONFIG = window.KIOSK_CONFIG || {
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
      limitBulanan: 500000,
      limitSaldo: 0,
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
      limitBulanan: 500000,
      limitSaldo: 0,
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
      limitBulanan: 1500000,
      limitSaldo: 0,
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
      limitBulanan: 300000,
      limitSaldo: 20000,
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
          message: 'Nomor kartu tidak valid.'
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

        // Tangani respons HTTP dan payload
        if (response.ok && payload && payload.success === true && payload.data) {
          // Simpan ke micro-cache
          microCache.set(cleanId, {
            data: payload.data,
            timestamp: Date.now()
          });
          return { success: true, data: payload.data };
        }

        // Jika kartu tidak terdaftar di backend (HTTP 404 / 400)
        const errMsg = (payload && payload.message) || 'Kartu tidak terdaftar. Silakan hubungi petugas.';
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
            ? 'Koneksi ke server timeout. Silakan coba lagi.'
            : 'Tidak dapat menghubungi server. Periksa koneksi.'
        };
      }
    },

    /**
     * Menerapkan data santri ke tampilan UI dan mengisi seluruh elemen ber-ID unik
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
      const elLimit = document.getElementById('kiosk-daily-limit');
      const elAccountType = document.getElementById('kiosk-account-type');
      const elTimestamp = document.getElementById('kiosk-last-tap-time');

      if (elName) elName.textContent = data.name || 'Pemilik Wallet';
      if (elNis) elNis.textContent = 'NIS: ' + (data.nis || '-');
      if (elClass) elClass.textContent = data.className || 'Pemilik Wallet';
      if (elStatus) elStatus.textContent = data.status || 'Kartu Aktif';
      if (elAccountType) elAccountType.textContent = data.accountType || 'Saldo Wallet';

      // 4. Format Limit Belanja (Bulanan / Minimum Saldo)
      if (elLimit) {
        const bulanan = Number(data.limitBulanan || data.dailyLimit || 0);
        const minimal = Number(data.limitSaldo || 0);
        if (bulanan > 0) {
          elLimit.textContent = 'Rp ' + formatRupiahNumber(bulanan) + ' / bulan';
        } else if (minimal > 0) {
          elLimit.textContent = 'Saldo min. Rp ' + formatRupiahNumber(minimal);
        } else {
          elLimit.textContent = 'Tanpa limit';
        }
      }

      // 5. Inisial avatar 2 huruf
      if (elInitials) {
        if (data.initials) {
          elInitials.textContent = data.initials;
        } else if (data.name) {
          const words = data.name.trim().split(/\s+/);
          elInitials.textContent = (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
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
      showToast('Membaca kartu...', 'info', 0);

      try {
        const res = await this.fetchSantriByCardId(cleanId);
        if (res && res.success && res.data) {
          this.setSantriData(res.data);
        } else {
          showToast((res && res.message) || 'Kartu tidak terdaftar. Silakan hubungi petugas.', 'error', CONFIG.timing.toastDurationMs);
        }
      } catch (err) {
        showToast('Gagal memeriksa saldo. Silakan coba lagi.', 'error', CONFIG.timing.toastDurationMs);
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
