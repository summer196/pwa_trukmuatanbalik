/* javascript/core/repository/index.js
   Ekspor modul Repository Muatan.
*/

if (typeof require !== 'undefined') {
  const { MuatanRepository } = require('./muatan-repo-base.js');
  const { InMemoryMuatanRepository } = require('./in-memory-muatan-repo.js');
  const { SupabaseMuatanRepository } = require('./supabase-muatan-repo.js');
  const { CacheMuatanRepository } = require('./cache-muatan-repo.js');

  module.exports = {
    MuatanRepository,
    InMemoryMuatanRepository,
    SupabaseMuatanRepository,
    CacheMuatanRepository,
  };
}
