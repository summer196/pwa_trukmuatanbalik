/* javascript/core/validator/hasil-validasi.js
   Hasil evaluasi kompatibilitas muatan dan armada (Gambar 4.3).
*/

class HasilValidasi {
  /**
   * @param {boolean} kompatibel Apakah muatan cocok dengan armada
   * @param {string[]} alasan Daftar alasan ketidakcocokan
   */
  constructor(kompatibel, alasan = []) {
    this.kompatibel = Boolean(kompatibel);
    this.alasan = Array.isArray(alasan) ? alasan : [];
  }

  /**
   * Menentukan apakah tombol penawaran boleh aktif.
   * @returns {boolean}
   */
  bolehTawar() {
    return this.kompatibel;
  }
}

if (typeof window !== 'undefined') {
  window.HasilValidasi = HasilValidasi;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HasilValidasi };
}
