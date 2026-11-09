/* admin-dashboard.js - verifikasi akun sopir dan armadanya. Khusus peran admin.
   Bergantung pada: supabase-config.js, auth.js, dashboard.js (helper el, badge, setMsg, pesanDb, tanggal) */

const STATUS_VERIF = {
  pending: ['Menunggu', 'wait'],
  verified: ['Terverifikasi', 'ok'],
  rejected: ['Ditolak', 'no'],
};

async function initAdmin() {
  const admin = await requireRole(['admin']);   // bukan admin -> dialihkan ke halamannya
  if (!admin) return;
  document.getElementById('user-name').textContent = admin.nama || 'Admin';
  document.getElementById('user-role').textContent = 'Admin';
  document.getElementById('dash-title').textContent = 'Verifikasi Sopir';
  document.getElementById('btn-logout').addEventListener('click', logoutUser);
  mountAdminDashboard(document.getElementById('app'));
}

async function mountAdminDashboard(root) {
  let filter = 'perlu';
  let sopir = [];
  let armada = [];

  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const ringkasan = el('p', { class: 'dash-meta' });
  const daftar = el('div', { class: 'dash-list' });
  const FILTER = { perlu: 'Perlu diperiksa', verified: 'Terverifikasi', semua: 'Semua' };
  const tabs = el('div', { class: 'dash-tabs', role: 'tablist' },
    Object.entries(FILTER).map(([key, label]) => el('button', {
      type: 'button', role: 'tab', 'data-filter': key,
      onclick: () => { filter = key; render(); },
    }, label)));

  root.replaceChildren(el('section', { class: 'dash-card' }, tabs, ringkasan, msg, daftar));

  const armadaDari = (id) => armada.filter((a) => a.pengguna_id === id);
  const perluDiperiksa = (s) => s.status_verifikasi === 'pending' || armadaDari(s.id).some((a) => a.status_verifikasi === 'pending');

  async function muat() {
    const [p, a] = await Promise.all([
      supabaseClient.from('profiles').select('id, nama, no_hp, status_verifikasi, created_at').eq('role', 'sopir').order('created_at', { ascending: false }),
      supabaseClient.from('armada').select('*').order('created_at', { ascending: false }),
    ]);
    if (p.error || a.error) { setMsg(msg, pesanDb(p.error || a.error)); return; }
    sopir = p.data; armada = a.data;
    render();
  }

  async function ubah(tabel, id, status, konfirmasi) {
    if (konfirmasi && !confirm(konfirmasi)) return;
    setMsg(msg, 'Menyimpan...', 'ok');
    const { data, error } = await supabaseClient.from(tabel).update({ status_verifikasi: status }).eq('id', id).select('id');
    if (error) { setMsg(msg, pesanDb(error)); return; }
    if (!data || !data.length) { setMsg(msg, 'Tidak ada data yang berubah. Pastikan akun ini admin dan api/schema-armada-muatan.sql sudah dijalankan.'); return; }
    setMsg(msg, 'Status diperbarui.', 'ok');
    await muat();
  }

  function tombol(label, utama, fn) {
    return el('button', { type: 'button', class: `btn ${utama ? 'btn--primary' : 'btn--ghost'} dash-btn-sm`, onclick: fn }, label);
  }

  function kartuArmada(a) {
    const [label, tone] = STATUS_VERIF[a.status_verifikasi] || STATUS_VERIF.pending;
    return el('div', { class: 'dash-unit' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, a.plat_nomor), badge(label, tone)),
      el('p', {}, `${a.jenis_unit}, kapasitas ${a.kapasitas_ton} ton`),
      el('p', { class: 'dash-meta' }, `Bak ${a.panjang_m} x ${a.lebar_m} x ${a.tinggi_m} m`),
      el('div', { class: 'dash-actions' },
        a.status_verifikasi !== 'verified' ? tombol('Verifikasi unit', true, () => ubah('armada', a.id, 'verified')) : null,
        a.status_verifikasi !== 'rejected' ? tombol('Tolak unit', false, () => ubah('armada', a.id, 'rejected', `Tolak unit ${a.plat_nomor}?`)) : null));
  }

  function kartuSopir(s) {
    const [label, tone] = STATUS_VERIF[s.status_verifikasi] || STATUS_VERIF.pending;
    const unit = armadaDari(s.id);
    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, s.nama || '(tanpa nama)'), badge(label, tone)),
      el('p', { class: 'dash-meta' }, `HP ${s.no_hp || '-'}, daftar ${tanggal(String(s.created_at).slice(0, 10))}`),
      el('div', { class: 'dash-actions' },
        s.status_verifikasi !== 'verified' ? tombol('Verifikasi akun', true, () => ubah('profiles', s.id, 'verified')) : null,
        s.status_verifikasi !== 'rejected' ? tombol('Tolak akun', false, () => ubah('profiles', s.id, 'rejected', `Tolak akun ${s.nama}?`)) : null),
      el('h3', { class: 'dash-sub' }, `Armada (${unit.length})`),
      unit.length ? unit.map(kartuArmada) : el('p', { class: 'dash-empty' }, 'Belum mengisi data armada.'));
  }

  function render() {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === filter)));
    const tampil = sopir.filter((s) => filter === 'semua' || (filter === 'verified' ? s.status_verifikasi === 'verified' : perluDiperiksa(s)));
    ringkasan.textContent = `${sopir.filter(perluDiperiksa).length} dari ${sopir.length} sopir perlu diperiksa.`;
    daftar.replaceChildren(...(tampil.length ? tampil.map(kartuSopir) : [el('p', { class: 'dash-empty' }, 'Tidak ada sopir pada daftar ini.')]));
  }

  await muat();
}

if (document.body.dataset.halaman === 'admin') document.addEventListener('DOMContentLoaded', initAdmin);
