/* admin-verifikasi.js
   Modul verifikasi akun sopir dan armadanya khusus admin.
   Verifikasi lewat objek domain Admin (verifikasiAkun, verifikasiUnit).
   Bergantung pada: supabase-config.js, auth.js, dashboard.js, domain/Pengguna.js, domain/Admin.js */

const STATUS_VERIF_ADMIN = {
  pending: ['Menunggu', 'wait'],
  verified: ['Terverifikasi', 'ok'],
  rejected: ['Ditolak', 'no'],
};

function mountAdminVerifikasi(root, ctx = {}) {
  const admin = new Admin((ctx && ctx.profile) || {});
  let filter = 'perlu';
  let sopir = [];
  let armada = [];

  const wadah = el('div', { class: 'admin-module' });
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const ringkasan = el('p', { class: 'dash-meta' });
  const daftar = el('div', { class: 'dash-list' });
  const FILTER = { perlu: 'Perlu diperiksa', verified: 'Terverifikasi', semua: 'Semua' };

  const tabs = el('div', { class: 'dash-tabs', role: 'tablist' },
    Object.entries(FILTER).map(([key, label]) => el('button', {
      type: 'button', role: 'tab', 'data-filter': key,
      onclick: () => { filter = key; render(); },
    }, label)));

  wadah.append(tabs, ringkasan, msg, daftar);
  root.replaceChildren(wadah);

  const armadaDari = (id) => armada.filter((a) => a.pengguna_id === id);
  const perluDiperiksa = (s) => s.status_verifikasi === 'pending' || armadaDari(s.id).some((a) => a.status_verifikasi === 'pending');

  async function muat() {
    setMsg(msg, 'Memuat data sopir...', 'ok');
    const [p, a] = await Promise.all([
      supabaseClient.from('profiles').select('id, nama, no_hp, status_verifikasi, created_at').eq('role', 'sopir').order('created_at', { ascending: false }),
      supabaseClient.from('armada').select('*').order('created_at', { ascending: false }),
    ]);
    if (p.error || a.error) {
      setMsg(msg, pesanDb(p.error || a.error));
      return;
    }
    setMsg(msg, '');
    sopir = p.data || [];
    armada = a.data || [];
    render();
  }

  async function ubah(tabel, id, status, konfirmasi) {
    if (konfirmasi && !confirm(konfirmasi)) return;
    setMsg(msg, 'Menyimpan perubahan...', 'ok');
    try {
      if (tabel === 'armada') await admin.verifikasiUnit(id, status);
      else await admin.verifikasiAkun(id, status);
    } catch (err) {
      setMsg(msg, err && err.code ? pesanDb(err) : (err.message || 'Gagal memperbarui status.'));
      return;
    }
    await muat();
    setMsg(msg, 'Status berhasil diperbarui.', 'ok');   // setelah muat(), karena muat() membersihkan pesan
  }

  function tombol(label, utama, fn) {
    return el('button', { type: 'button', class: `btn ${utama ? 'btn--primary' : 'btn--ghost'} dash-btn-sm`, onclick: fn }, label);
  }

  function kartuArmada(a) {
    const [label, tone] = STATUS_VERIF_ADMIN[a.status_verifikasi] || STATUS_VERIF_ADMIN.pending;
    return el('div', { class: 'dash-unit' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, a.plat_nomor), badge(label, tone)),
      el('p', {}, `${a.jenis_unit}, kapasitas ${a.kapasitas_ton} ton`),
      el('p', { class: 'dash-meta' }, `Bak ${a.panjang_m} x ${a.lebar_m} x ${a.tinggi_m} m`),
      el('div', { class: 'dash-actions' },
        a.status_verifikasi !== 'verified' ? tombol('Verifikasi unit', true, () => ubah('armada', a.id, 'verified')) : null,
        a.status_verifikasi !== 'rejected' ? tombol('Tolak unit', false, () => ubah('armada', a.id, 'rejected', `Tolak unit ${a.plat_nomor}?`)) : null));
  }

  function kartuSopir(s) {
    const [label, tone] = STATUS_VERIF_ADMIN[s.status_verifikasi] || STATUS_VERIF_ADMIN.pending;
    const unit = armadaDari(s.id);
    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, s.nama || '(Tanpa nama)'), badge(label, tone)),
      el('p', { class: 'dash-meta' }, `HP: ${s.no_hp || '-'}, terdaftar ${tanggal(String(s.created_at).slice(0, 10))}`),
      el('div', { class: 'dash-actions' },
        s.status_verifikasi !== 'verified' ? tombol('Verifikasi akun', true, () => ubah('profiles', s.id, 'verified')) : null,
        s.status_verifikasi !== 'rejected' ? tombol('Tolak akun', false, () => ubah('profiles', s.id, 'rejected', `Tolak akun ${s.nama}?`)) : null),
      el('h3', { class: 'dash-sub' }, `Armada (${unit.length})`),
      unit.length ? unit.map(kartuArmada) : el('p', { class: 'dash-empty' }, 'Belum ada data armada yang didaftarkan.'));
  }

  function render() {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === filter)));
    const tampil = sopir.filter((s) => filter === 'semua' || (filter === 'verified' ? s.status_verifikasi === 'verified' : perluDiperiksa(s)));
    ringkasan.textContent = `${sopir.filter(perluDiperiksa).length} dari ${sopir.length} sopir perlu diperiksa.`;
    daftar.replaceChildren(...(tampil.length ? tampil.map(kartuSopir) : [el('p', { class: 'dash-empty' }, 'Tidak ada data sopir pada filter ini.')]));
  }

  muat();
}
