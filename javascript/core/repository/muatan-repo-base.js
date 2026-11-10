/* javascript/core/repository/muatan-repo-base.js
   Antarmuka abstraksi MuatanRepository (SRS Subbab 4.4.2 Gambar 4.6).
   Menerapkan prinsip Dependency Inversion (SOLID).
*/

class MuatanRepository {
  /**
   * Mengambil semua muatan yang berstatus aktif/tersedia.
   * @returns {Promise<Array<Object>>}
   */
  async ambilSemuaAktif() {
    throw new Error('Metode ambilSemuaAktif() harus diimplementasikan.');
  }

  /**
   * Mengambil satu muatan berdasarkan id.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async ambilById(id) {
    throw new Error('Metode ambilById() harus diimplementasikan.');
  }

  /**
   * Menyimpan data muatan baru atau memperbarui muatan yang ada.
   * @param {Object} muatan
   * @returns {Promise<Object>}
   */
  async simpan(muatan) {
    throw new Error('Metode simpan() harus diimplementasikan.');
  }
}

if (typeof window !== 'undefined') {
  window.MuatanRepository = MuatanRepository;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MuatanRepository };
}
