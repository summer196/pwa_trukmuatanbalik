/* javascript/core/validator/validator.js
   KompatibilitasValidator memakai Pola Strategy (SRS Subbab 4.4.1 Gambar 4.5).
   Menggabungkan aturan berat, dimensi, dan jenis unit, serta mendukung penambahan
   aturan baru tanpa mengubah kode validator (OCP - SOLID).
*/

const AturanBeratReq = typeof AturanBerat !== 'undefined'
  ? AturanBerat
  : (typeof require !== 'undefined' ? require('./aturan-berat.js').AturanBerat : null);

const AturanDimensiReq = typeof AturanDimensi !== 'undefined'
  ? AturanDimensi
  : (typeof require !== 'undefined' ? require('./aturan-dimensi.js').AturanDimensi : null);

const AturanJenisUnitReq = typeof AturanJenisUnit !== 'undefined'
  ? AturanJenisUnit
  : (typeof require !== 'undefined' ? require('./aturan-unit.js').AturanJenisUnit : null);

const HasilValidasiReq = typeof HasilValidasi !== 'undefined'
  ? HasilValidasi
  : (typeof require !== 'undefined' ? require('./hasil-validasi.js').HasilValidasi : null);

class KompatibilitasValidator {
  /**
   * @param {Array<Object|Function>} aturan Daftar strategi aturan kompatibilitas
   */
  constructor(aturan) {
    if (aturan && Array.isArray(aturan)) {
      this.aturan = aturan;
    } else {
      this.aturan = [
        new AturanBeratReq(),
        new AturanDimensiReq(),
        new AturanJenisUnitReq(),
      ];
    }
  }

  /**
   * Menilai kompatibilitas muatan terhadap satu unit armada.
   * @param {Object} muatan
   * @param {Object} armada
   * @returns {HasilValidasi}
   */
  validasi(muatan, armada) {
    const alasan = [];

    for (const rule of this.aturan) {
      let hasil = null;
      if (typeof rule === 'function') {
        hasil = rule(muatan, armada);
      } else if (rule && typeof rule.periksa === 'function') {
        hasil = rule.periksa(muatan, armada);
      }

      if (hasil && typeof hasil === 'string') {
        alasan.push(hasil);
      }
    }

    const HasilClass = HasilValidasiReq || (typeof HasilValidasi !== 'undefined' ? HasilValidasi : class {
      constructor(kompatibel, alasan = []) {
        this.kompatibel = kompatibel;
        this.alasan = alasan;
      }
      bolehTawar() { return this.kompatibel; }
    });

    return new HasilClass(alasan.length === 0, alasan);
  }

  /**
   * Validasi kecocokan muatan terhadap daftar armada sopir.
   * Cocok jika minimal 1 armada yang terverifikasi memenuhi semua aturan.
   * @param {Object} muatan
   * @param {Array<Object>} armadaList
   * @returns {{ cocok: boolean, alasan: string[], armadaCocok: Object[], hasilTerdekat: Object }}
   */
  validasiUntukSopir(muatan, armadaList = []) {
    const terverifikasi = armadaList.filter((a) => (a.statusVerifikasi ?? a.status_verifikasi) === 'verified');
    if (!terverifikasi.length) {
      return {
        cocok: false,
        alasan: ['Belum ada armada terverifikasi. Tunggu verifikasi admin.'],
        armadaCocok: [],
        bolehTawar: false,
      };
    }

    const evaluasi = terverifikasi.map((armada) => ({
      armada,
      hasil: this.validasi(muatan, armada),
    }));

    const armadaCocok = evaluasi.filter((e) => e.hasil.kompatibel).map((e) => e.armada);
    if (armadaCocok.length > 0) {
      return {
        cocok: true,
        alasan: [],
        armadaCocok,
        bolehTawar: true,
      };
    }

    // Ambil armada yang paling mendekati (jumlah pelanggaran paling sedikit)
    const terdekat = evaluasi.reduce((prev, curr) =>
      curr.hasil.alasan.length < prev.hasil.alasan.length ? curr : prev
    );

    return {
      cocok: false,
      alasan: terdekat.hasil.alasan,
      armadaCocok: [],
      bolehTawar: false,
    };
  }
}

if (typeof window !== 'undefined') {
  window.KompatibilitasValidator = KompatibilitasValidator;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KompatibilitasValidator };
}
