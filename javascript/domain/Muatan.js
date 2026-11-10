/* javascript/domain/Muatan.js
   Kelas Domain Muatan (SRS Subbab 4.2.1 Gambar 4.2).
*/

class Muatan {
  /**
   * @param {Object} data
   */
  constructor({
    id,
    id_customer,
    customer_id,
    idCustomer,
    jenis_muatan,
    jenis,
    jenisMuatan,
    berat_ton,
    beratTon,
    panjang_m,
    panjangM,
    lebar_m,
    lebarM,
    tinggi_m,
    tinggiM,
    asal_nama,
    asal_lat,
    asalLat,
    asal_lon,
    asalLon,
    tujuan_nama,
    tujuan_lat,
    tujuanLat,
    tujuan_lon,
    tujuanLon,
    jadwal_muat,
    jadwalMuat,
    jenis_unit_dibutuhkan,
    jenis_unit,
    jenisUnitDibutuhkan,
    harga_tawaran,
    harga,
    hargaTawaran,
    status = 'terbuka',
  } = {}) {
    this.id = id || null;
    this.idCustomer = idCustomer || id_customer || customer_id || null;
    this.jenisMuatan = jenisMuatan || jenis_muatan || jenis || '';
    this.beratTon = Number(beratTon ?? berat_ton ?? 0);
    this.panjangM = Number(panjangM ?? panjang_m ?? 0);
    this.lebarM = Number(lebarM ?? lebar_m ?? 0);
    this.tinggiM = Number(tinggiM ?? tinggi_m ?? 0);

    this.asalNama = asal_nama || '';
    this.asalLat = Number(asalLat ?? asal_lat ?? NaN);
    this.asalLon = Number(asalLon ?? asal_lon ?? NaN);

    this.tujuanNama = tujuan_nama || '';
    this.tujuanLat = Number(tujuanLat ?? tujuan_lat ?? NaN);
    this.tujuanLon = Number(tujuanLon ?? tujuan_lon ?? NaN);

    this.jadwalMuat = jadwalMuat || jadwal_muat || null;

    // Normalisasi jenis unit dibutuhkan ke dalam bentuk array (SRS Bab IV: array enum)
    const rawUnit = jenisUnitDibutuhkan ?? jenis_unit_dibutuhkan ?? jenis_unit;
    if (Array.isArray(rawUnit)) {
      this.jenisUnitDibutuhkan = rawUnit;
    } else if (typeof rawUnit === 'string' && rawUnit.trim()) {
      this.jenisUnitDibutuhkan = rawUnit.split(',').map((u) => u.trim());
    } else {
      this.jenisUnitDibutuhkan = [];
    }

    this.hargaTawaran = Number(hargaTawaran ?? harga_tawaran ?? harga ?? 0);
    this.status = status;

    // Kompatibilitas properti database lama
    this.jenis = this.jenisMuatan;
    this.berat_ton = this.beratTon;
    this.panjang_m = this.panjangM;
    this.lebar_m = this.lebarM;
    this.tinggi_m = this.tinggiM;
    this.asal_lat = this.asalLat;
    this.asal_lon = this.asalLon;
    this.tujuan_lat = this.tujuanLat;
    this.tujuan_lon = this.tujuanLon;
    this.harga = this.hargaTawaran;
    this.jenis_unit = this.jenisUnitDibutuhkan.join(', ');
  }

  tersedia() {
    return this.status === 'terbuka' || this.status === 'tersedia';
  }

  kunci() {
    this.status = 'terkunci';
  }
}

if (typeof window !== 'undefined') {
  window.Muatan = Muatan;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Muatan };
}
