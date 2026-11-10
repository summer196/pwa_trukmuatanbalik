/* javascript/core/validator/index.js
   Ekspor modul validator kompatibilitas sesuai SRS Bab IV & Bab V.
*/

if (typeof require !== 'undefined') {
  const { AturanKompatibilitas } = require('./aturan-base.js');
  const { AturanBerat } = require('./aturan-berat.js');
  const { AturanDimensi } = require('./aturan-dimensi.js');
  const { AturanJenisUnit } = require('./aturan-unit.js');
  const { HasilValidasi } = require('./hasil-validasi.js');
  const { KompatibilitasValidator } = require('./validator.js');

  module.exports = {
    AturanKompatibilitas,
    AturanBerat,
    AturanDimensi,
    AturanJenisUnit,
    HasilValidasi,
    KompatibilitasValidator,
  };
}
