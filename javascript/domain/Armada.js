/* javascript/domain/Armada.js
   Kelas Domain Armada (SRS Subbab 4.2.1 Gambar 4.2).
*/

class Armada {
  /**
   * @param {Object} data
   */
  constructor({
    id,
    pengguna_id,
    id_pengguna,
    idPengguna,
    jenis_unit,
    jenisUnit,
    plat_nomor,
    platNomor,
    kapasitas_ton,
    kapasitasTon,
    panjang_bak_m,
    panjang_m,
    panjangBakM,
    lebar_bak_m,
    lebar_m,
    lebarBakM,
    tinggi_bak_m,
    tinggi_m,
    tinggiBakM,
    status_verifikasi,
    statusVerifikasi = 'pending',
  } = {}) {
    this.id = id || null;
    this.idPengguna = idPengguna || id_pengguna || pengguna_id || null;
    this.jenisUnit = jenisUnit || jenis_unit || '';
    this.platNomor = platNomor || plat_nomor || '';
    this.kapasitasTon = Number(kapasitasTon ?? kapasitas_ton ?? 0);
    this.panjangBakM = Number(panjangBakM ?? panjang_bak_m ?? panjang_m ?? 0);
    this.lebarBakM = Number(lebarBakM ?? lebar_bak_m ?? lebar_m ?? 0);
    this.tinggiBakM = Number(tinggiBakM ?? tinggi_bak_m ?? tinggi_m ?? 0);
    this.statusVerifikasi = statusVerifikasi || status_verifikasi || 'pending';

    // Alias untuk kompatibilitas database Supabase lama
    this.panjang_m = this.panjangBakM;
    this.lebar_m = this.lebarBakM;
    this.tinggi_m = this.tinggiBakM;
    this.jenis_unit = this.jenisUnit;
    this.plat_nomor = this.platNomor;
    this.kapasitas_ton = this.kapasitasTon;
    this.status_verifikasi = this.statusVerifikasi;
  }

  isTerverifikasi() {
    return this.statusVerifikasi === 'verified';
  }

  perbarui(dataBaru = {}) {
    if (dataBaru.jenisUnit || dataBaru.jenis_unit) this.jenisUnit = dataBaru.jenisUnit || dataBaru.jenis_unit;
    if (dataBaru.platNomor || dataBaru.plat_nomor) this.platNomor = dataBaru.platNomor || dataBaru.plat_nomor;
    if (dataBaru.kapasitasTon != null || dataBaru.kapasitas_ton != null) this.kapasitasTon = Number(dataBaru.kapasitasTon ?? dataBaru.kapasitas_ton);
    if (dataBaru.panjangBakM != null || dataBaru.panjang_bak_m != null || dataBaru.panjang_m != null) {
      this.panjangBakM = Number(dataBaru.panjangBakM ?? dataBaru.panjang_bak_m ?? dataBaru.panjang_m);
      this.panjang_m = this.panjangBakM;
    }
    if (dataBaru.lebarBakM != null || dataBaru.lebar_bak_m != null || dataBaru.lebar_m != null) {
      this.lebarBakM = Number(dataBaru.lebarBakM ?? dataBaru.lebar_bak_m ?? dataBaru.lebar_m);
      this.lebar_m = this.lebarBakM;
    }
    if (dataBaru.tinggiBakM != null || dataBaru.tinggi_bak_m != null || dataBaru.tinggi_m != null) {
      this.tinggiBakM = Number(dataBaru.tinggiBakM ?? dataBaru.tinggi_bak_m ?? dataBaru.tinggi_m);
      this.tinggi_m = this.tinggiBakM;
    }
    this.jenis_unit = this.jenisUnit;
    this.plat_nomor = this.platNomor;
    this.kapasitas_ton = this.kapasitasTon;
    return this;
  }
}

if (typeof window !== 'undefined') {
  window.Armada = Armada;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Armada };
}
