/* javascript/domain/Pengiriman.js
   Kelas Domain Pengiriman (SRS Subbab 4.2.1 Gambar 4.2).
*/

class Pengiriman {
  /**
   * @param {Object} data
   */
  constructor({
    id,
    id_penawaran,
    penawaran_id,
    idPenawaran,
    muatan_id,
    customer_id,
    sopir_id,
    status_saat_ini,
    status = 'menuju_muat',
    statusSaatIni,
    waktu_muat,
    waktuMuat,
    waktu_tiba,
    waktuTiba,
    created_at,
  } = {}) {
    this.id = id || null;
    this.idPenawaran = idPenawaran || id_penawaran || penawaran_id || null;
    this.idMuatan = muatan_id || null;
    this.idCustomer = customer_id || null;
    this.idSopir = sopir_id || null;
    this.statusSaatIni = statusSaatIni || status_saat_ini || status || 'menuju_muat';
    this.waktuMuat = waktuMuat || waktu_muat || null;
    this.waktuTiba = waktuTiba || waktu_tiba || null;
    this.createdAt = created_at || new Date().toISOString();
  }

  ubahStatus(statusBaru, waktu = new Date().toISOString()) {
    this.statusSaatIni = statusBaru;
    if (statusBaru === 'memuat' && !this.waktuMuat) {
      this.waktuMuat = waktu;
    }
    if (statusBaru === 'tiba' && !this.waktuTiba) {
      this.waktuTiba = waktu;
    }
  }

  selesai() {
    this.statusSaatIni = 'selesai';
    if (!this.waktuTiba) {
      this.waktuTiba = new Date().toISOString();
    }
  }
}

if (typeof window !== 'undefined') {
  window.Pengiriman = Pengiriman;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Pengiriman };
}
