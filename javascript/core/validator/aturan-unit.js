/* javascript/core/validator/aturan-unit.js
   Strategi pemeriksaan tipe unit armada vs kebutuhan jenis unit muatan (TC-09, TC-10).
*/

const AturanBaseUnit = typeof AturanKompatibilitas !== 'undefined'
  ? AturanKompatibilitas
  : (typeof require !== 'undefined' ? require('./aturan-base.js').AturanKompatibilitas : class {});

class AturanJenisUnit extends AturanBaseUnit {
  periksa(muatan, armada) {
    const rawUnitMuatan = muatan.jenisUnitDibutuhkan ?? muatan.jenis_unit_dibutuhkan ?? muatan.jenis_unit;
    const unitArmada = (armada.jenisUnit ?? armada.jenis_unit ?? '').toString().trim().toLowerCase();

    let unitList = [];
    if (Array.isArray(rawUnitMuatan)) {
      unitList = rawUnitMuatan.map((u) => String(u || '').trim().toLowerCase()).filter(Boolean);
    } else if (typeof rawUnitMuatan === 'string' && rawUnitMuatan.trim().length > 0) {
      unitList = rawUnitMuatan.split(',').map((u) => u.trim().toLowerCase()).filter(Boolean);
    }

    // TC-10: Daftar jenis unit dibutuhkan kosong atau tidak ada -> Gagal (tidak dianggap cocok dengan semua unit)
    if (!unitList.length) {
      return 'Jenis unit tidak sesuai: muatan tidak mendefinisikan unit yang dibutuhkan.';
    }

    if (!unitArmada) {
      return 'Jenis unit tidak sesuai: data unit armada tidak lengkap.';
    }

    // Periksa apakah unit armada termasuk dalam unit yang diizinkan muatan
    const cocok = unitList.some((u) => u === unitArmada || unitArmada.includes(u) || u.includes(unitArmada));
    if (cocok) {
      return null;
    }

    const formatNama = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const labelArmada = formatNama(armada.jenisUnit ?? armada.jenis_unit ?? 'Truk');
    const labelDibutuhkan = unitList.map(formatNama).join(', ');

    return `Jenis unit tidak sesuai: armada Anda ${labelArmada}, muatan butuh ${labelDibutuhkan}`;
  }
}

if (typeof window !== 'undefined') {
  window.AturanJenisUnit = AturanJenisUnit;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AturanJenisUnit };
}
