/* javascript/domain/Admin.js
   Kelas Domain Admin turunan dari Pengguna (SRS Subbab 4.2.1 Gambar 4.2).
*/

const PenggunaBaseAdmin = typeof Pengguna !== 'undefined'
  ? Pengguna
  : (typeof require !== 'undefined' ? require('./Pengguna.js').Pengguna : class {});

class Admin extends PenggunaBaseAdmin {
  constructor(data = {}) {
    super({ ...data, peran: 'admin' });
  }

  async verifikasiAkun(penggunaId, status = 'verified', supabase = (typeof supabaseClient !== 'undefined' ? supabaseClient : null)) {
    if (!supabase) throw new Error('Supabase client belum tersedia.');
    const { data, error } = await supabase
      .from('profiles')
      .update({ status_verifikasi: status })
      .eq('id', penggunaId)
      .select('id, status_verifikasi');
    if (error) throw error;
    if (!data || !data.length) throw new Error('Tidak ada data yang berubah. Pastikan izin admin aktif.');
    return data[0];
  }

  async verifikasiUnit(armadaId, status = 'verified', supabase = (typeof supabaseClient !== 'undefined' ? supabaseClient : null)) {
    if (!supabase) throw new Error('Supabase client belum tersedia.');
    const { data, error } = await supabase
      .from('armada')
      .update({ status_verifikasi: status })
      .eq('id', armadaId)
      .select('id, status_verifikasi');
    if (error) throw error;
    if (!data || !data.length) throw new Error('Tidak ada data yang berubah. Pastikan izin admin aktif.');
    return data[0];
  }

  async pantauPengiriman(supabase = (typeof supabaseClient !== 'undefined' ? supabaseClient : null)) {
    if (!supabase) throw new Error('Supabase client belum tersedia.');
    const { data, error } = await supabase
      .from('pengiriman')
      .select('*, muatan:muatan_id(*), sopir:sopir_id(nama, no_hp), customer:customer_id(nama, no_hp)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
}

if (typeof window !== 'undefined') {
  window.Admin = Admin;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Admin };
}
