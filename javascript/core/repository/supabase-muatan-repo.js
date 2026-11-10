/* javascript/core/repository/supabase-muatan-repo.js
   Implementasi SupabaseMuatanRepository untuk akses data PostgreSQL online (Gambar 4.6).
*/

const MuatanRepoBaseSupa = typeof MuatanRepository !== 'undefined'
  ? MuatanRepository
  : (typeof require !== 'undefined' ? require('./muatan-repo-base.js').MuatanRepository : class {});

class SupabaseMuatanRepository extends MuatanRepoBaseSupa {
  /**
   * @param {Object} client Supabase client instance
   */
  constructor(client = (typeof supabaseClient !== 'undefined' ? supabaseClient : null)) {
    super();
    this.client = client;
  }

  async ambilSemuaAktif(pusat = null, radiusKm = 50) {
    if (!this.client) throw new Error('Supabase client belum diinisialisasi.');

    let q = this.client
      .from('muatan')
      .select('*')
      .or('status.eq.terbuka,status.eq.tersedia');

    if (pusat && typeof HaversineCalculator !== 'undefined' && HaversineCalculator.titikValid(pusat)) {
      const k = HaversineCalculator.kotakBatas(pusat.lat, pusat.lon, radiusKm);
      q = q.gte('asal_lat', k.latMin).lte('asal_lat', k.latMax)
           .gte('asal_lon', k.lonMin).lte('asal_lon', k.lonMax);
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
