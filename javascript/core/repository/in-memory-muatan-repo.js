/* javascript/core/repository/in-memory-muatan-repo.js
   Implementasi InMemoryMuatanRepository untuk unit test tanpa jaringan (TC-13 s/d TC-16).
*/

const MuatanRepoBaseInMemory = typeof MuatanRepository !== 'undefined'
  ? MuatanRepository
  : (typeof require !== 'undefined' ? require('./muatan-repo-base.js').MuatanRepository : class {});

class InMemoryMuatanRepository extends MuatanRepoBaseInMemory {
  /**
   * @param {Array<Object>} data Data awal muatan dalam memori
   */
  constructor(data = []) {
    super();
    this.data = Array.isArray(data) ? [...data] : [];
  }

  async ambilSemuaAktif() {
    // Sesuai SRS: hanya muatan berstatus 'tersedia' atau 'terbuka' yang aktif
    return this.data.filter((m) => {
      const st = String(m.status || '').toLowerCase();
      return st === 'tersedia' || st === 'terbuka';
    });
  }

  async ambilById(id) {
    return this.data.find((m) => m.id === id) || null;
  }

  async simpan(muatan) {
    const idx = this.data.findIndex((m) => m.id === muatan.id);
    if (idx >= 0) {
      this.data[idx] = { ...this.data[idx], ...muatan };
      return this.data[idx];
    }
    const item = { ...muatan, id: muatan.id || `m-${Date.now()}` };
    this.data.push(item);
    return item;
  }
}

if (typeof window !== 'undefined') {
  window.InMemoryMuatanRepository = InMemoryMuatanRepository;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InMemoryMuatanRepository };
}
