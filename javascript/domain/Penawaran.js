/* javascript/domain/Penawaran.js
   Kelas Domain Penawaran (SRS Subbab 4.2.1 Gambar 4.2).
*/

class Penawaran {
  /**
   * @param {Object} data
   */
  constructor({
    id,
    id_muatan,
    muatan_id,
    idMuatan,
    id_armada,
    armada_id,
    idArmada,
    sopir_id,
    id_sopir,
    harga,
    status = 'menunggu',
    created_at,
  } = {}) {
    this.id = id || null;
    this.idMuatan = idMuatan || id_muatan || muatan_id || null;
    this.idArmada = idArmada || id_armada || armada_id || null;
    this.idSopir = id_sopir || sopir_id || null;
    this.harga = Number(harga || 0);
    this.status = status;
    this.createdAt = created_at || new Date().toISOString();
  }

  terima() {
    this.status = 'diterima';
  }

  tolak() {
    this.status = 'ditolak';
  }
}

if (typeof window !== 'undefined') {
  window.Penawaran = Penawaran;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Penawaran };
}
