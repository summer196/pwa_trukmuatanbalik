/* javascript/domain/LogStatus.js
   Kelas Domain LogStatus (SRS Subbab 4.2.1 Gambar 4.2).
*/

class LogStatus {
  /**
   * @param {Object} data
   */
  constructor({
    id,
    id_pengiriman,
    pengiriman_id,
    idPengiriman,
    status,
    waktu,
    catatan = '',
  } = {}) {
    this.id = id || null;
    this.idPengiriman = idPengiriman || id_pengiriman || pengiriman_id || null;
    this.status = status || '';
    this.waktu = waktu || new Date().toISOString();
    this.catatan = catatan || '';
  }
}

if (typeof window !== 'undefined') {
  window.LogStatus = LogStatus;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LogStatus };
}
