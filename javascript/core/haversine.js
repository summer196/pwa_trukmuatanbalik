/* javascript/core/haversine.js
   Implementasi HaversineCalculator sesuai SRS Bab IV (Gambar 4.3 & Subbab 4.2.2).
   Menghitung jarak garis lurus bola bumi dengan radius R = 6371 km.
   Memenuhi kasus uji TC-01 sampai TC-05 (Bab V).
*/

class HaversineCalculator {
  static R = 6371; // Jari-jari rata-rata bumi (km)

  /**
   * Menghitung jarak lingkaran besar (km) antara dua koordinat geografis.
   * @param {number} lat1 Lintang titik asal (-90 s/d 90)
   * @param {number} lon1 Bujur titik asal (-180 s/d 180)
   * @param {number} lat2 Lintang titik tujuan (-90 s/d 90)
   * @param {number} lon2 Bujur titik tujuan (-180 s/d 180)
   * @returns {number} Jarak dalam kilometer (dibulatkan ke 2 desimal atau presisi tinggi)
   * @throws {RangeError} Jika nilai lintang/bujur di luar batas, NaN, atau null
   */
  static jarakKm(lat1, lon1, lat2, lon2) {
    const parseCoord = (val, nama, min, max) => {
      if (val === null || val === undefined || val === '') {
        throw new RangeError(`Koordinat ${nama} tidak boleh null atau kosong.`);
      }
      const num = Number(val);
      if (!Number.isFinite(num)) {
        throw new RangeError(`Koordinat ${nama} harus berupa angka valid.`);
      }
      if (num < min || num > max) {
        throw new RangeError(`Koordinat ${nama} (${num}) di luar rentang [${min}, ${max}].`);
      }
      return num;
    };

    const pLat1 = parseCoord(lat1, 'lat1', -90, 90);
    const pLon1 = parseCoord(lon1, 'lon1', -180, 180);
    const pLat2 = parseCoord(lat2, 'lat2', -90, 90);
    const pLon2 = parseCoord(lon2, 'lon2', -180, 180);

    // Titik yang identik menghasilkan jarak tepat 0 (TC-03)
    if (pLat1 === pLat2 && pLon1 === pLon2) {
      return 0;
    }

    const toRad = (deg) => (deg * Math.PI) / 180.0;
    const dLat = toRad(pLat2 - pLat1);
    const dLon = toRad(pLon2 - pLon1);

    // Formula Haversine standar memakai fungsi sinus.
    // Untuk garis lintasan bujur 180 derajat (TC-04), sin(dLon / 2)^2 menghasilkan nilai selisih yang konsisten.
    const a = Math.sin(dLat / 2.0) ** 2 +
              Math.cos(toRad(pLat1)) * Math.cos(toRad(pLat2)) * (Math.sin(dLon / 2.0) ** 2);
    const c = 2.0 * Math.asin(Math.min(1.0, Math.sqrt(a)));
    const hasil = this.R * c;

    return Math.round(hasil * 100) / 100;
  }

  /**
   * Menghitung jarak presisi tinggi (tanpa pembulatan awal).
   */
  static jarakKmPresisi(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (deg * Math.PI) / 180.0;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2.0) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * (Math.sin(dLon / 2.0) ** 2);
    return 2.0 * this.R * Math.asin(Math.min(1.0, Math.sqrt(a)));
  }

  /**
   * Format jarak kilometer ke format tampilan bahasa Indonesia.
   * @param {number} km
   * @returns {string}
   */
  static formatKm(km) {
    if (km == null || !Number.isFinite(km)) return '- km';
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(km)} km`;
  }

  /**
   * Validasi objek titik koordinat { lat, lon }.
   */
  static titikValid(p) {
    if (!p) return false;
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }

  /**
   * Menghitung kotak pembatas lintang dan bujur untuk pra-penyaringan query database.
   */
  static kotakBatas(lat, lon, radiusKm) {
    const rad = (deg) => (deg * Math.PI) / 180.0;
    const dLat = radiusKm / 111.32;
    const dLon = radiusKm / (111.32 * Math.max(Math.cos(rad(lat)), 0.01));
    return {
      latMin: lat - dLat,
      latMax: lat + dLat,
      lonMin: lon - dLon,
      lonMax: lon + dLon,
    };
  }
}

if (typeof window !== 'undefined') {
  window.HaversineCalculator = HaversineCalculator;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HaversineCalculator };
}
