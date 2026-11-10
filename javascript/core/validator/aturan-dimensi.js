/* javascript/core/validator/aturan-dimensi.js
   Strategi pemeriksaan dimensi muatan vs ukuran bak armada (TC-08, TC-11).
   Mendukung pemutaran lantai muatan 90 derajat jika proporsinya memungkinkan.
*/

const AturanBaseDimensi = typeof AturanKompatibilitas !== 'undefined'
  ? AturanKompatibilitas
  : (typeof require !== 'undefined' ? require('./aturan-base.js').AturanKompatibilitas : class {});

class AturanDimensi extends AturanBaseDimensi {
  periksa(muatan, armada) {
    const mp = Number(muatan.panjangM ?? muatan.panjang_m ?? NaN);
    const ml = Number(muatan.lebarM ?? muatan.lebar_m ?? NaN);
    const mt = Number(muatan.tinggiM ?? muatan.tinggi_m ?? NaN);

    const bp = Number(armada.panjangBakM ?? armada.panjang_bak_m ?? armada.panjang_m ?? NaN);
    const bl = Number(armada.lebarBakM ?? armada.lebar_bak_m ?? armada.lebar_m ?? NaN);
    const bt = Number(armada.tinggiBakM ?? armada.tinggi_bak_m ?? armada.tinggi_m ?? NaN);

    if (![mp, ml, mt, bp, bl, bt].every(Number.isFinite)) {
      return 'Data dimensi muatan atau bak armada tidak lengkap.';
    }

    const EPS = 1e-9;
    const lantaiNormalOk = (mp <= bp + EPS) && (ml <= bl + EPS);
    const lantaiPutarOk = (ml <= bp + EPS) && (mp <= bl + EPS);
    const lantaiOk = lantaiNormalOk || lantaiPutarOk;
    const tinggiOk = mt <= bt + EPS;

    if (lantaiOk && tinggiOk) {
      return null;
    }

    const pelanggaran = [];
    if (!lantaiOk) {
      if (mp > bp + EPS && ml > bl + EPS) {
        pelanggaran.push(`panjang ${mp} m > ${bp} m, lebar ${ml} m > ${bl} m`);
      } else if (mp > bp + EPS && mp > bl + EPS) {
        pelanggaran.push(`panjang ${mp} m > ${bp} m`);
      } else if (ml > bl + EPS && ml > bp + EPS) {
        pelanggaran.push(`lebar ${ml} m > ${bl} m`);
      } else {
        pelanggaran.push(`ukuran lantai ${mp} × ${ml} m melebihi bak ${bp} × ${bl} m`);
      }
    }
    if (!tinggiOk) {
      pelanggaran.push(`tinggi ${mt} m > ${bt} m`);
    }

    return `Dimensi melebihi bak: ${pelanggaran.join(', ')}`;
  }
}

if (typeof window !== 'undefined') {
  window.AturanDimensi = AturanDimensi;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AturanDimensi };
}
