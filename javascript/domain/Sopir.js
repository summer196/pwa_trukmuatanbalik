/* javascript/domain/Sopir.js
   Kelas Domain Sopir turunan dari Pengguna (SRS Subbab 4.2.1 Gambar 4.2).
*/

const PenggunaBaseSopir = typeof Pengguna !== 'undefined'
  ? Pengguna
  : (typeof require !== 'undefined' ? require('./Pengguna.js').Pengguna : class {});

class Sopir extends PenggunaBaseSopir {
  constructor(data = {}) {
    super({ ...data, peran: 'sopir' });
    this.daftarArmada = [];
  }

  kelolaArmada(armada) {
    if (Array.isArray(armada)) {
      this.daftarArmada = armada;
    } else if (armada) {
      this.daftarArmada.push(armada);
    }
    return this.daftarArmada;
  }

  async cariMuatan(pencarianService, lokasi, radius) {
    if (!pencarianService || typeof pencarianService.cariTerdekat !== 'function') {
      throw new Error('PencarianService tidak valid.');
    }
    return await pencarianService.cariTerdekat(lokasi, radius, this.daftarArmada);
  }

  async cariMuatanBalik(pencarianService, lokasi, kotaPulang, r1 = 50, r2 = 100) {
    if (!pencarianService || typeof pencarianService.cariMuatanBalik !== 'function') {
      throw new Error('PencarianService tidak valid.');
    }
    return await pencarianService.cariMuatanBalik(lokasi, kotaPulang, r1, r2, this.daftarArmada);
  }

  async ajukanPenawaran(muatan, harga, armadaTerpilih = null) {
    const unit = armadaTerpilih || this.daftarArmada[0];
    if (typeof Transaksi !== 'undefined' && typeof Transaksi.buatPenawaran === 'function') {
      return await Transaksi.buatPenawaran({ muatan, armada: unit, harga });
    }
    return { ok: true, muatanId: muatan.id, harga, armadaId: unit?.id };
  }

  async perbaruiStatus(pengiriman, status, catatan = '') {
    if (typeof Transaksi !== 'undefined' && typeof Transaksi.ubahStatus === 'function') {
      const id = typeof pengiriman === 'object' ? pengiriman.id : pengiriman;
      return await Transaksi.ubahStatus(id, status, catatan);
    }
    return { ok: true, pengirimanId: pengiriman.id, status, catatan };
  }
}

if (typeof window !== 'undefined') {
  window.Sopir = Sopir;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Sopir };
}
