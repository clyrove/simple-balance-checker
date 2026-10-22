/**
 * ============================================================================
 * KIOSK API & HARDWARE RFID SCANNER CONTROLLER
 * ============================================================================
 * Modul ini menangani:
 * 1. Database santri & fallback dinamis untuk kartu baru.
 * 2. Masking nomor kartu RFID (seperti password, hanya 2 digit terakhir terlihat).
 * 3. Pendeteksi keyboard-wedge dari alat scan RFID USB fisik.
 * 4. Antarmuka global `window.SantriKioskAPI` yang mudah dibaca & di-maintain.
 * ============================================================================
 */

(function (window) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. MOCK DATABASE SANTRI
  // --------------------------------------------------------------------------
  const SANTRI_DATABASE = {
    'STR-202401': {
      cardUid: 'STR-202401',
      name: 'Ahmad Fauzi Ridwan',
      nis: '202401089',
      className: 'Kelas 10-A • Asrama Abu Bakar',
      balance: 350000,
      dailyLimit: 100000,
      status: 'Kartu Aktif',
      accountType: 'Tabungan Santri',
      initials: 'AF'
    },
    'STR-202402': {
      cardUid: 'STR-202402',
      name: 'Fathimah Az-Zahra',
      nis: '202402014',
      className: 'Kelas 11-Tahfidz • Asrama Maryam',
      balance: 1250000,
      dailyLimit: 150000,
      status: 'Kartu Aktif',
      accountType: 'Tabungan Santri',
      initials: 'FZ'
    },
    'STR-202403': {
      cardUid: 'STR-202403',
      name: 'Muhammad Al-Ghifari',
      nis: '202403072',
      className: 'Kelas 9-B • Asrama Umar',
      balance: 45000,
      dailyLimit: 50000,
      status: 'Kartu Aktif',
      accountType: 'Tabungan Santri',
      initials: 'MG'
    }
  };

  let currentActiveData = null;

  // --------------------------------------------------------------------------
  // 2. HELPER FUNCTIONS
  // --------------------------------------------------------------------------
  /**
   * Format angka Rupiah standar Indonesia (misal: 350000 -> "350.000")
   */
  function formatRupiahNumber(num) {
    return new Intl.NumberFormat('id-ID').format(Math.round(num || 0));
  }

  /**
   * Masking nomor kartu RFID seperti password.
   * Hanya menampilkan 2 digit terakhir, sisanya disamarkan dengan bullet titik.
   * Contoh: "STR-202401" -> "ID: •••• ••01"
   */
  function maskRfidCardNumber(cardUid) {
    if (!cardUid) return 'ID: •••• ••--';
    const cleanStr = String(cardUid).trim();
    // Ambil 2 digit/karakter paling belakang
    const lastTwoDigits = cleanStr.slice(-2);
    return `ID: •••• ••${lastTwoDigits}`;
  }

  // --------------------------------------------------------------------------
  // 3. PUBLIC API OBJECT (window.SantriKioskAPI)
  // --------------------------------------------------------------------------
  const SantriKioskAPI = {
    /**
     * Cari data santri dari database atau generate data santri jika kartu baru
     */
    async fetchSantriByCardId(cardId) {
      const cleanId = (cardId || '').trim();
      if (SANTRI_DATABASE[cleanId]) {
        return { success: true, data: SANTRI_DATABASE[cleanId] };
      }

      // Fallback dinamis jika ada kartu fisik baru di-tap pada scanner
      const randomLastTwo = cleanId.length >= 2 ? cleanId.slice(-2) : '88';
      return {
        success: true,
        data: {
          cardUid: cleanId || 'RFID-SCAN',
          name: 'Santri ID ' + randomLastTwo,
          nis: '2024' + Math.floor(10000 + Math.random() * 90000),
          className: 'Santri Reguler',
          balance: Math.floor(Math.random() * 150 + 10) * 5000,
          dailyLimit: 100000,
          status: 'Kartu Aktif',
          accountType: 'Tabungan Santri',
          initials: 'ST'
        }
      };
    },

    /**
     * Menerapkan data santri ke UI secara langsung dan memperbarui seluruh elemen ber-ID unik
     */
    setSantriData(data) {
      if (!data) return;
      currentActiveData = { ...data };

      // 1. Update elemen hidden untuk kemudahan integrasi API / form capture
      const elRawBalance = document.getElementById('kiosk-api-raw-balance');
      const elCardUid = document.getElementById('kiosk-api-card-uid');
      const elSantriId = document.getElementById('kiosk-api-santri-id');

      if (elRawBalance) elRawBalance.value = data.balance || 0;
      if (elCardUid) elCardUid.value = data.cardUid || '';
      if (elSantriId) elSantriId.value = data.nis || '';

      // 2. Update tampilan nomor kartu RFID dengan sensor masking (2 digit terakhir saja)
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

      // 3. Update nama santri, NIS, kelas, dan status kartu (Semua ber-ID Unik)
      const elName = document.getElementById('kiosk-user-name');
      const elNis = document.getElementById('kiosk-user-nis');
      const elClass = document.getElementById('kiosk-user-class');
      const elStatus = document.getElementById('kiosk-account-status');
      const elInitials = document.getElementById('kiosk-user-initials');
      const elLimit = document.getElementById('kiosk-daily-limit');
      const elAccountType = document.getElementById('kiosk-account-type');
      const elTimestamp = document.getElementById('kiosk-last-tap-time');

      if (elName) elName.textContent = data.name || 'Santri Al-Wafi';
      if (elNis) elNis.textContent = 'NIS: ' + (data.nis || '-');
      if (elClass) elClass.textContent = data.className || 'Santri Terdaftar';
      if (elStatus) elStatus.textContent = data.status || 'Kartu Aktif';
      if (elLimit) elLimit.textContent = 'Rp ' + formatRupiahNumber(data.dailyLimit || 100000) + ' / hari';
      if (elAccountType) elAccountType.textContent = data.accountType || 'Tabungan Santri';

      // 4. Inisial avatar
      if (elInitials) {
        if (data.initials) {
          elInitials.textContent = data.initials;
        } else if (data.name) {
          const words = data.name.trim().split(/\s+/);
          elInitials.textContent = (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
        }
      }

      // 5. Waktu pembaruan
      if (elTimestamp) {
        const d = new Date();
        const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        elTimestamp.textContent = `Diperbarui pukul ${timeStr} WIB`;
      }

      // 6. Terbangkan event ke GSAP Animation Engine
      window.dispatchEvent(new CustomEvent('kiosk:show-balance', {
        detail: {
          targetBalance: Number(data.balance) || 0,
          santri: data
        }
      }));
    },

    /**
     * Memproses tap kartu berdasarkan Card ID
     */
    async tapCard(cardId) {
      const res = await this.fetchSantriByCardId(cardId);
      if (res && res.data) {
        this.setSantriData(res.data);
      }
    },

    /**
     * Reset kios ke State 1 (Waiting RFID)
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

  // Ekspos ke global window
  window.SantriKioskAPI = SantriKioskAPI;

  // --------------------------------------------------------------------------
  // 4. LISTENER ALAT SCAN RFID USB HID (KEYBOARD EMULATION)
  // --------------------------------------------------------------------------
  let rfidScanBuffer = '';
  let lastStrokeTime = 0;

  window.addEventListener('keydown', function (e) {
    // Jangan proses jika user sedang mengetik di input modal [Alt + S]
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      return;
    }

    const now = Date.now();
    // Hardware RFID scanner mengetik karakter secara beruntun dan cepat (< 50ms)
    if (now - lastStrokeTime > 250) {
      rfidScanBuffer = '';
    }
    lastStrokeTime = now;

    if (e.key === 'Enter') {
      if (rfidScanBuffer.trim().length >= 3) {
        SantriKioskAPI.tapCard(rfidScanBuffer.trim());
        rfidScanBuffer = '';
        e.preventDefault();
      }
    } else if (e.key.length === 1) {
      rfidScanBuffer += e.key;
    }
  });

})(window);
