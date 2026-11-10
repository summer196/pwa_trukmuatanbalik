/* javascript/core/validator/aturan-base.js
   Antarmuka dan kelas dasar strategi aturan kompatibilitas (Subbab 4.4.1 Gambar 4.5).
*/

class AturanKompatibilitas {
  /**
   * Memeriksa kesesuaian muatan dengan armada.
   * @param {Object} muatan Objek data muatan
   * @param {Object} armada Objek data armada
   * @returns {string|null} Alasan kegagalan jika tidak cocok, atau null jika lolos.
   */
  periksa(muatan, armada) {
    throw new Error('Metode periksa() harus diimplementasikan oleh turunan AturanKompatibilitas.');
  }
}

if (typeof window !== 'undefined') {
  window.AturanKompatibilitas = AturanKompatibilitas;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AturanKompatibilitas };
}
