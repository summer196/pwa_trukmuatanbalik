/* transaction.js
   Penawaran dan status pengiriman: sopir menawar -> customer memilih -> sopir memperbarui status.
   Butuh: supabase-config.js (supabaseClient) dan api/schema-transaksi.sql sudah dijalankan.
   Opsional: search-engine.js (cek kecocokan cepat sebelum penawaran dikirim).
   Aturan yang sebenarnya dijaga di database (trigger + RPC + RLS); validasi di sini hanya untuk respons cepat. */

const Transaksi = (() => {
  /* ---------- Status pengiriman ---------- */
  const URUTAN = ['menuju_muat', 'memuat', 'dalam_perjalanan', 'tiba', 'selesai'];
  const LABEL_STATUS = {
    menuju_muat: 'Menuju lokasi muat', memuat: 'Sedang memuat', dalam_perjalanan: 'Dalam perjalanan',
    tiba: 'Tiba di tujuan', selesai: 'Selesai',
  };
  const LABEL_AKSI = { memuat: 'Mulai memuat', dalam_perjalanan: 'Berangkat', tiba: 'Tiba di tujuan', selesai: 'Selesaikan pengiriman' };
  const statusBerikutnya = (s) => URUTAN[URUTAN.indexOf(s) + 1] || null;

  /* ---------- Pesan error ---------- */
  function pesan(error) {
    if (!error) return 'Terjadi kesalahan.';
    if (error.code === 'P0001') return error.message;                       // pesan dari RAISE EXCEPTION di database (sudah berbahasa Indonesia)
    if (error.code === '23505') return 'Anda sudah menawar muatan ini dengan armada tersebut.';
    if (error.code === '42501') return 'Anda tidak punya izin untuk tindakan ini.';
    if (error.code === '42P01' || error.code === 'PGRST202' || error.code === 'PGRST205') return 'Tabel atau fungsi transaksi belum dibuat. Jalankan api/schema-transaksi.sql.';
    return typeof pesanError === 'function' ? pesanError(error) : (error.message || 'Terjadi kesalahan.');
  }
  const gagal = (error) => ({ ok: false, message: pesan(error) });

  /* ---------- Sopir: menawar ---------- */
  /** muatan & armada berupa baris database. Mengembalikan { ok, data } atau { ok:false, message }. */
  async function buatPenawaran({ muatan, armada, harga }) {
    const h = Number(harga);
    if (!Number.isFinite(h) || h < 0) return { ok: false, message: 'Harga tidak valid.' };
    if (armada.status_verifikasi !== 'verified') return { ok: false, message: 'Armada belum diverifikasi admin.' };
    if (typeof SearchEngine !== 'undefined') {
      const k = SearchEngine.cekKompatibilitas(muatan, armada);
      if (!k.cocok) return { ok: false, message: k.alasan.join(' ') };
    }
    const { data, error } = await supabaseClient.from('penawaran')
      .insert({ muatan_id: muatan.id, armada_id: armada.id, harga: Math.round(h) }).select().single();
    return error ? gagal(error) : { ok: true, data };
  }

  async function tarikPenawaran(id) {
    const { error } = await supabaseClient.from('penawaran').delete().eq('id', id).eq('status', 'menunggu');
    return error ? gagal(error) : { ok: true };
  }

  async function penawaranSaya() {            // milik sopir yang login
    const { data, error } = await supabaseClient.from('penawaran')
      .select('*, muatan:muatan_id(jenis, berat_ton, asal_nama, tujuan_nama, status), armada:armada_id(plat_nomor)')
      .order('created_at', { ascending: false });
    return error ? gagal(error) : { ok: true, data };
  }

  /* ---------- Customer: melihat dan memilih ---------- */
  async function penawaranUntukMuatan(muatanId) {
    const { data, error } = await supabaseClient.from('penawaran')
      .select('*, sopir:sopir_id(nama, no_hp), armada:armada_id(plat_nomor, jenis_unit, kapasitas_ton)')
      .eq('muatan_id', muatanId).order('harga', { ascending: true });
    return error ? gagal(error) : { ok: true, data };
  }

  /** Memilih satu penawaran: muatan terkunci, penawaran lain ditolak, pengiriman dibuat. Mengembalikan id pengiriman. */
  async function pilihPenawaran(penawaranId) {
    const { data, error } = await supabaseClient.rpc('pilih_penawaran', { p_penawaran: penawaranId });
    return error ? gagal(error) : { ok: true, pengirimanId: data };
  }

  /* ---------- Pengiriman dan status ---------- */
  async function pengirimanSaya() {           // sopir dan customer: RLS hanya mengembalikan milik sendiri
    const { data, error } = await supabaseClient.from('pengiriman')
      .select('*, muatan:muatan_id(jenis, berat_ton, asal_nama, tujuan_nama), sopir:sopir_id(nama, no_hp), customer:customer_id(nama, no_hp)')
      .order('created_at', { ascending: false });
    return error ? gagal(error) : { ok: true, data };
  }

  /** Hanya sopir pengiriman itu, dan hanya ke status berikutnya (berurutan). */
  async function ubahStatus(pengirimanId, statusBaru, catatan = null) {
    const { error } = await supabaseClient.rpc('ubah_status_pengiriman', {
      p_pengiriman: pengirimanId, p_status: statusBaru, p_catatan: catatan,
    });
    return error ? gagal(error) : { ok: true };
  }

  async function riwayatStatus(pengirimanId) {
    const { data, error } = await supabaseClient.from('log_status')
      .select('status, waktu, catatan').eq('pengiriman_id', pengirimanId).order('waktu', { ascending: true });
    return error ? gagal(error) : { ok: true, data };
  }

  /* ---------- Realtime ---------- */
  /** Mengembalikan fungsi untuk berhenti berlangganan. RLS tetap berlaku: tiap pengguna hanya menerima data yang boleh dilihatnya. */
  function berlangganan({ onMuatanBaru, onPenawaranBaru, onPengirimanBerubah } = {}) {
    const kanal = supabaseClient.channel('muatanku-' + Math.random().toString(36).slice(2));
    const pasang = (tabel, event, fn) => fn && kanal.on('postgres_changes', { event, schema: 'public', table: tabel }, (p) => fn(p.new, p.old));
    pasang('muatan', 'INSERT', onMuatanBaru);
    pasang('penawaran', 'INSERT', onPenawaranBaru);
    pasang('pengiriman', '*', onPengirimanBerubah);
    kanal.subscribe();
    return () => supabaseClient.removeChannel(kanal);
  }

  return {
    URUTAN, LABEL_STATUS, LABEL_AKSI, statusBerikutnya,
    buatPenawaran, tarikPenawaran, penawaranSaya,
    penawaranUntukMuatan, pilihPenawaran,
    pengirimanSaya, ubahStatus, riwayatStatus, berlangganan,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Transaksi;
