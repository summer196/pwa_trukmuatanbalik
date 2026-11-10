/* javascript/domain/RencanaPulang.js
   Kelas Domain RencanaPulang (SRS Subbab 4.2.1 Gambar 4.2).
*/

class RencanaPulang {
  /**
   * @param {Object} data
   */
  constructor({
    id,
    id_armada,
    idArmada,
    lokasi_lat,
    lokasiLat,
    lokasi_lon,
    lokasiLon,
    kota_pulang,
    kotaPulang,
    pulang_lat,
    pulangLat,
    pulang_lon,
    pulangLon,
    tanggal_tersedia,
    tanggalTersedia,
  } = {}) {
    this.id = id || null;
    this.idArmada = idArmada || id_armada || null;
    this.lokasiLat = Number(lokasiLat ?? lokasi_lat ?? NaN);
    this.lokasiLon = Number(lokasiLon ?? lokasi_lon ?? NaN);
    this.kotaPulang = kotaPulang || kota_pulang || '';
    this.pulangLat = Number(pulangLat ?? pulang_lat ?? NaN);
    this.pulangLon = Number(pulangLon ?? pulang_lon ?? NaN);
    this.tanggalTersedia = tanggalTersedia || tanggal_tersedia || null;
  }

  /**
   * Memeriksa apakah rencana pulang masih aktif (tanggal tersedia belum lewat).
   * @returns {boolean}
   */
  aktif() {
    if (!this.tanggalTersedia) return true;
    const hariIni = new Date().toISOString().slice(0, 10);
    const tgl = typeof this.tanggalTersedia === 'string'
      ? this.tanggalTersedia.slice(0, 10)
      : new Date(this.tanggalTersedia).toISOString().slice(0, 10);
    return tgl >= hariIni;
  }
}

if (typeof window !== 'undefined') {
  window.RencanaPulang = RencanaPulang;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RencanaPulang };
}
