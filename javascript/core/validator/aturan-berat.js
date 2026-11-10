/* javascript/core/validator/aturan-berat.js
   Strategi pemeriksaan beban muatan vs kapasitas muat armada (TC-07, TC-11).
*/

const AturanBaseBerat = typeof AturanKompatibilitas !== 'undefined'
  ? AturanKompatibilitas
  : (typeof require !== 'undefined' ? require('./aturan-base.js').AturanKompatibilitas : class {});

class AturanBerat extends AturanBaseBerat {
  periksa(muatan, armada) {
    const berat = Number(muatan.beratTon ?? muatan.berat_ton ?? NaN);
    const kapasitas = Number(armada.kapasitasTon ?? armada.kapasitas_ton ?? NaN);

    if (!Number.isFinite(berat) || !Number.isFinite(kapasitas)) {
      return 'Data berat muatan atau kapasitas armada tidak valid.';
    }

    const EPS = 1e-9;
    if (berat <= kapasitas + EPS) {
      return null;
    }

    return `Kelebihan berat: ${berat} t > kapasitas ${kapasitas} t`;
  }
}

if (typeof window !== 'undefined') {
  window.AturanBerat = AturanBerat;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AturanBerat };
}
