/* javascript/core/repository/cache-muatan-repo.js
   Implementasi CacheMuatanRepository untuk mode offline saat sinyal lemah (Gambar 4.6).
*/

const MuatanRepoBaseCache = typeof MuatanRepository !== 'undefined'
  ? MuatanRepository
  : (typeof require !== 'undefined' ? require('./muatan-repo-base.js').MuatanRepository : class {});

class CacheMuatanRepository extends MuatanRepoBaseCache {
  constructor(kunciStorage = 'muatanku:cache:muatan') {
    super();
    this.kunciStorage = kunciStorage;
  }

  async ambilSemuaAktif() {
    try {
      const dataStr = localStorage.getItem(this.kunciStorage);
      if (!dataStr) return [];
      const parse = JSON.parse(dataStr);
      const list = Array.isArray(parse) ? parse : (parse.hasil || []);
      return list.filter((m) => {
        const st = String(m.status || '').toLowerCase();
        return st === 'tersedia' || st === 'terbuka';
      });
    } catch (e) {
      console.warn('Gagal membaca cache muatan:', e);
      return [];
    }
  }

  async ambilById(id) {
    const list = await this.ambilSemuaAktif();
    return list.find((m) => m.id === id) || null;
  }

  async simpan(muatan) {
    const list = await this.ambilSemuaAktif();
    const idx = list.findIndex((m) => m.id === muatan.id);
    if (idx >= 0) list[idx] = muatan;
    else list.push(muatan);

    try {
      localStorage.setItem(this.kunciStorage, JSON.stringify(list));
    } catch (e) {
      console.warn('Gagal menyimpan cache:', e);
    }
    return muatan;
  }
}

if (typeof window !== 'undefined') {
  window.CacheMuatanRepository = CacheMuatanRepository;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CacheMuatanRepository };
}
