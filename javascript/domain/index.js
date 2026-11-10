/* javascript/domain/index.js
   Ekspor seluruh kelas domain sistem Muatanku.
*/

if (typeof require !== 'undefined') {
  const { Pengguna } = require('./Pengguna.js');
  const { Sopir } = require('./Sopir.js');
  const { Customer } = require('./Customer.js');
  const { Admin } = require('./Admin.js');
  const { Armada } = require('./Armada.js');
  const { RencanaPulang } = require('./RencanaPulang.js');
  const { Muatan } = require('./Muatan.js');
  const { Penawaran } = require('./Penawaran.js');
  const { Pengiriman } = require('./Pengiriman.js');
  const { LogStatus } = require('./LogStatus.js');

  module.exports = {
    Pengguna,
    Sopir,
    Customer,
    Admin,
    Armada,
    RencanaPulang,
    Muatan,
    Penawaran,
    Pengiriman,
    LogStatus,
  };
}
