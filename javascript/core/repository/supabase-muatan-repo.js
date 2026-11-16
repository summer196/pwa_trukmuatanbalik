/* javascript/core/repository/supabase-muatan-repo.js
   Implementasi SupabaseMuatanRepository untuk akses data PostgreSQL online (Gambar 4.6).
*/

const MuatanRepoBaseSupa = typeof MuatanRepository !== 'undefined'
  ? MuatanRepository
  : (typeof require !== 'undefined' ? require('./muatan-repo-base.js').MuatanRepository : class {});

// Dependensi dimuat sendiri agar penyaringan kotak lintang/bujur juga jalan di Node (CommonJS).
const HaversineDiRepoSupa = typeof HaversineCalculator !== 'undefined'
  ? HaversineCalculator
  : (typeof require !== 'undefined' ? require('../haversine.js').HaversineCalculator : null);

class SupabaseMuatanRepository extends MuatanRepoBaseSupa {
  /**
   * @param {Object} client Supabase client instance
   * @param {number} [timeoutMs] Batas tunggu pengambilan data. Pustaka Supabase mencoba ulang sendiri saat jaringan
   *   gagal (sekitar 7 detik); batas ini memutus lebih awal agar aplikasi segera memakai hasil terakhir dari perangkat.
   */
  constructor(client = (typeof supabaseClient !== 'undefined' ? supabaseClient : null), timeoutMs = 5000) {
    super();
    this.client = client;
    this.timeoutMs = timeoutMs;
  }

  async ambilSemuaAktif(pusat = null, radiusKm = 50) {
    if (!this.client) throw new Error('Supabase client belum diinisialisasi.');

    let q = this.client
      .from('muatan')
      .select('*')
      .or('status.eq.terbuka,status.eq.tersedia');

    if (pusat && HaversineDiRepoSupa && HaversineDiRepoSupa.titikValid(pusat)) {
      const k = HaversineDiRepoSupa.kotakBatas(pusat.lat, pusat.lon, radiusKm);
      q = q.gte('asal_lat', k.latMin).lte('asal_lat', k.latMax)
           .gte('asal_lon', k.lonMin).lte('asal_lon', k.lonMax);
    }

    if (this.timeoutMs > 0 && typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      q = q.abortSignal(AbortSignal.timeout(this.timeoutMs));
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async ambilById(id) {
    if (!this.client) throw new Error('Supabase client belum diinisialisasi.');
    const { data, error } = await this.client.from('muatan').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  async simpan(muatan) {
    if (!this.client) throw new Error('Supabase client belum diinisialisasi.');
    const { data, error } = await this.client.from('muatan').upsert(muatan).select().single();
    if (error) throw error;
    return data;
  }
}

if (typeof window !== 'undefined') {
  window.SupabaseMuatanRepository = SupabaseMuatanRepository;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SupabaseMuatanRepository };
}
