/* javascript/core/pencarian-service.js
   Implementasi PencarianMuatanService sesuai SRS Subbab 4.2.2 (Gambar 4.3) & 4.4.2 (Gambar 4.6).
   Menjalankan alur pencarian sekitar dan muatan balik menggunakan HaversineCalculator,
   KompatibilitasValidator, serta MuatanRepository.
   Memenuhi kasus uji TC-13 sampai TC-16.
*/

const HaversineReq = typeof HaversineCalculator !== 'undefined'
  ? HaversineCalculator
  : (typeof require !== 'undefined' ? require('./haversine.js').HaversineCalculator : null);

const ValidatorReq = typeof KompatibilitasValidator !== 'undefined'
  ? KompatibilitasValidator
  : (typeof require !== 'undefined' ? require('./validator/validator.js').KompatibilitasValidator : null);

class PencarianMuatanService {
  /**
   * @param {Object} repo Implementasi MuatanRepository
   * @param {Object} [validator] KompatibilitasValidator (default dibuat baru)
   * @param {number} [radiusKm] Radius pencarian default (km)
   */
  constructor(repo, validator = null, radiusKm = 50) {
    if (!repo) {
      throw new Error('PencarianMuatanService membutuhkan instance MuatanRepository.');
    }
    this.repo = repo;
    this.validator = validator || (ValidatorReq ? new ValidatorReq() : null);
    this.radiusKm = Number(radiusKm) || 50;
  }

  /**
   * Mengurai koordinat serbaguna ({lat, lon}, [lat, lon], atau pasangan field)
   * @private
   */
  _titik(val) {
    if (!val) return null;
    if (Array.isArray(val) && val.length >= 2) {
      return { lat: Number(val[0]), lon: Number(val[1]) };
    }
    if (typeof val === 'object') {
      const lat = val.lat ?? val.latitude;
      const lon = val.lon ?? val.longitude;
      if (lat != null && lon != null) {
        return { lat: Number(lat), lon: Number(lon) };
      }
    }
    return null;
  }

  /**
   * Ambil koordinat asal dari objek muatan
   * @private
   */
  _titikAsal(m) {
    if (m.asal && (m.asal.lat != null || Array.isArray(m.asal))) return this._titik(m.asal);
    const lat = m.asal_lat ?? m.asalLat;
    const lon = m.asal_lon ?? m.asalLon;
    return lat != null && lon != null ? { lat: Number(lat), lon: Number(lon) } : null;
  }

  /**
   * Ambil koordinat tujuan dari objek muatan
   * @private
   */
  _titikTujuan(m) {
    if (m.tujuan && (m.tujuan.lat != null || Array.isArray(m.tujuan))) return this._titik(m.tujuan);
    const lat = m.tujuan_lat ?? m.tujuanLat;
    const lon = m.tujuan_lon ?? m.tujuanLon;
    return lat != null && lon != null ? { lat: Number(lat), lon: Number(lon) } : null;
  }

  /**
   * FR-05: Cari muatan terdekat dari lokasi sopir dalam radius tertentu.
   * @param {Object|Array} lokasi Koordinat sopir { lat, lon }
   * @param {number} [radiusKm] Radius maksimal dalam km
   * @param {Array<Object>|Object} [armadaData] Armada atau daftar armada sopir untuk validasi
   * @returns {Promise<Array<Object>>} Daftar muatan dalam radius, terurut dari terdekat
   */
  async cariTerdekat(lokasi, radiusKm = this.radiusKm, armadaData = null) {
    const titikSopir = this._titik(lokasi);
    if (!titikSopir || !HaversineReq.titikValid(titikSopir)) {
      throw new RangeError('Lokasi sopir tidak valid.');
    }

    const radius = radiusKm !== undefined && radiusKm !== null ? Number(radiusKm) : this.radiusKm;
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError('Radius harus berupa angka positif.');
    }

    const semuaMuatan = (await this.repo.ambilSemuaAktif()) || [];
    // TC-16: Repository kosong mengembalikan array kosong []
    if (!semuaMuatan.length) {
      return [];
    }

    const hasil = [];
    for (const m of semuaMuatan) {
      const asal = this._titikAsal(m);
      if (!asal || !HaversineReq.titikValid(asal)) continue;

      const d = HaversineReq.jarakKm(titikSopir.lat, titikSopir.lon, asal.lat, asal.lon);
      // TC-14: Radius 0 hanya memasukkan muatan dengan jarak tepat 0
      if (Number.isFinite(d) && d <= radius) {
        const item = { ...m, jarakKm: d, jarak: d };
        if (armadaData && this.validator) {
          if (Array.isArray(armadaData)) {
            const val = this.validator.validasiUntukSopir(m, armadaData);
            item.kompatibilitas = val;
            item.bisaTawar = val.bolehTawar;
          } else {
            const val = this.validator.validasi(m, armadaData);
            item.hasilValidasi = val;
            item.kompatibilitas = { cocok: val.kompatibel, alasan: val.alasan };
            item.bisaTawar = val.bolehTawar();
          }
        }
        hasil.push(item);
      }
    }

    // Urutkan dari jarak terdekat (TC-13)
    return hasil.sort((a, b) => a.jarakKm - b.jarakKm);
  }

  /**
   * FR-06: Cari muatan balik dari lokasi sekarang menuju dekat kota pulang.
   * @param {Object|Array} lokasiSekarang Titik sopir sekarang
   * @param {Object|Array} kotaPulang Titik kota pulang sopir
   * @param {number} [radiusAsalKm=50] Radius toleransi penjemputan dari lokasi sekarang
   * @param {number} [radiusTujuanKm=100] Radius toleransi penurunan dari kota pulang
   * @param {Array<Object>|Object} [armadaData] Armada untuk validasi
   * @returns {Promise<Array<Object>>} Daftar muatan balik terurut skor penyimpangan rute
   */
  async cariMuatanBalik(lokasiSekarang, kotaPulang, radiusAsalKm = 50, radiusTujuanKm = 100, armadaData = null) {
    const dari = this._titik(lokasiSekarang);
    const pulang = this._titik(kotaPulang);

    if (!dari || !HaversineReq.titikValid(dari)) {
      throw new RangeError('Lokasi sekarang tidak valid.');
    }
    if (!pulang || !HaversineReq.titikValid(pulang)) {
      throw new RangeError('Kota pulang tidak valid.');
    }

    const rAsal = Number(radiusAsalKm) || 50;
    const rTujuan = Number(radiusTujuanKm) || 100;

    const semuaMuatan = (await this.repo.ambilSemuaAktif()) || [];
    if (!semuaMuatan.length) {
      return [];
    }

    const hasil = [];
    for (const m of semuaMuatan) {
      const asal = this._titikAsal(m);
      const tujuan = this._titikTujuan(m);
      if (!asal || !tujuan || !HaversineReq.titikValid(asal) || !HaversineReq.titikValid(tujuan)) {
        continue;
      }

      const dAsal = HaversineReq.jarakKm(dari.lat, dari.lon, asal.lat, asal.lon);
      const dTujuan = HaversineReq.jarakKm(pulang.lat, pulang.lon, tujuan.lat, tujuan.lon);

      // TC-15: Muatan harus memenuhi radius asal dan radius tujuan
      if (Number.isFinite(dAsal) && Number.isFinite(dTujuan) && dAsal <= rAsal && dTujuan <= rTujuan) {
        const item = {
          ...m,
          jarakKm: dAsal,
          jarakAsalKm: dAsal,
          jarakTujuanKm: dTujuan,
          skorKm: Math.round((dAsal + dTujuan) * 100) / 100,
        };

        if (armadaData && this.validator) {
          if (Array.isArray(armadaData)) {
            const val = this.validator.validasiUntukSopir(m, armadaData);
            item.kompatibilitas = val;
            item.bisaTawar = val.bolehTawar;
          } else {
            const val = this.validator.validasi(m, armadaData);
            item.hasilValidasi = val;
            item.kompatibilitas = { cocok: val.kompatibel, alasan: val.alasan };
            item.bisaTawar = val.bolehTawar();
          }
        }
        hasil.push(item);
      }
    }

    // Urutkan berdasarkan total simpangan terkecil (skor terendah lebih dahulu)
    return hasil.sort((a, b) => a.skorKm - b.skorKm);
  }
}

if (typeof window !== 'undefined') {
  window.PencarianMuatanService = PencarianMuatanService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PencarianMuatanService };
}
