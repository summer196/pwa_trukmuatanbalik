/* dashboard.js
   Kerangka dasbor: penjaga halaman, header, dan helper DOM yang dipakai bersama
   oleh driver-dashboard.js dan customer-dashboard.js.
   Semua data pengguna dimasukkan lewat textContent/createTextNode (tanpa innerHTML), jadi aman dari XSS. */

/* Daftar jenis unit: dipakai di profil armada DAN posting muatan agar bisa dicocokkan nanti. */
const JENIS_UNIT = ['Tronton Bak', 'Tronton Wingbox', 'Trailer Flatbed', 'Trailer Kontainer', 'Lowbed', 'Dump Truck'];

/* ---------- Helper DOM ---------- */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

function input(name, type = 'text', attrs = {}) { return el('input', { name, type, ...attrs }); }
function numberInput(name, attrs = {}) {
  return input(name, 'number', { required: true, min: '0.1', step: '0.1', inputmode: 'decimal', ...attrs });
}
function select(name, options, attrs = {}) {
  return el('select', { name, required: true, ...attrs }, options.map((o) => el('option', { value: o }, o)));
}
function field(label, control, hint) {
  return el('label', { class: 'dash-field' }, el('span', {}, label), control, hint ? el('small', { class: 'dash-hint' }, hint) : null);
}
function dimensiFieldset(legend = 'Dimensi (meter)') {
  return el('fieldset', { class: 'dash-dim' }, el('legend', {}, legend),
    field('Panjang', numberInput('panjang_m')), field('Lebar', numberInput('lebar_m')), field('Tinggi', numberInput('tinggi_m')));
}
function setMsg(node, text, type = 'error') { node.textContent = text; node.dataset.type = type; }
function badge(text, tone) { return el('span', { class: `dash-badge dash-badge--${tone}` }, text); }

/* ---------- Format ---------- */
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const tanggal = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const hariIni = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (waktu lokal)
const waktuLokal = (iso) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const kosong = (teks) => el('p', { class: 'dash-empty' }, teks);

function pesanDb(error) {
  if (error && error.code === '23505') return 'Data sudah terdaftar (plat nomor tidak boleh sama).';
  if (error && error.code === '23514') return 'Ada nilai yang tidak valid. Periksa angka yang diisi.';
  if (error && error.code === '42501') return 'Anda tidak punya izin untuk tindakan ini.';
  return pesanError(error);
}

/* ---------- Lokasi: nama tempat -> koordinat (OpenStreetMap Nominatim) ----------
   Dipakai untuk asal/tujuan muatan. Koordinat disimpan di input tersembunyi
   <prefix>_lat dan <prefix>_lon, dan dibutuhkan nanti untuk rumus Haversine. */
function lokasiField(prefix, label) {
  const petunjuk = 'Ketik lokasi lalu tekan "Cari titik".';
  const nama = input(`${prefix}_nama`, 'text', { required: true, autocomplete: 'off', 'aria-label': label, placeholder: 'Contoh: Pelabuhan Tanjung Priok, Jakarta' });
  const lat = input(`${prefix}_lat`, 'hidden');
  const lon = input(`${prefix}_lon`, 'hidden');
  const info = el('small', { class: 'dash-hint', 'aria-live': 'polite' }, petunjuk);
  const cari = el('button', { type: 'button', class: 'btn btn--ghost dash-btn-sm' }, 'Cari titik');

  nama.addEventListener('input', () => { lat.value = ''; lon.value = ''; info.textContent = petunjuk; delete info.dataset.ok; });
  cari.addEventListener('click', async () => {
    const q = nama.value.trim();
    if (!q) return;
    cari.disabled = true; info.textContent = 'Mencari...';
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&accept-language=id&q=' + encodeURIComponent(q);
      const [hit] = await (await fetch(url)).json();
      if (!hit) { info.textContent = 'Lokasi tidak ditemukan. Tambahkan nama kota atau kabupaten.'; return; }
      lat.value = Number(hit.lat).toFixed(6);
      lon.value = Number(hit.lon).toFixed(6);
      info.textContent = `Titik ditemukan: ${hit.display_name}`; info.dataset.ok = '1';
    } catch (err) {
      info.textContent = 'Gagal mencari lokasi. Periksa koneksi internet.';
    } finally { cari.disabled = false; }
  });

  return el('div', { class: 'dash-field' }, el('span', {}, label),
    el('div', { class: 'dash-loc' }, nama, cari), info, lat, lon);
}

/* ---------- Panel bertab (dipakai dasbor sopir dan customer) ----------
   definisi: { kunci: { label, panel: (ctx) => ({ el, setelahTampil?, hancurkan? }) } }
   ctx.bus dikosongkan tiap pindah tab; panel mengisinya untuk menerima kabar realtime. */
function pasangPanelTab(root, definisi, awal, ctx) {
  let sekarang = null;
  const konten = el('div', { class: 'dash-panel' });
  const tabs = el('div', { class: 'dash-tabs', role: 'tablist' },
    Object.entries(definisi).map(([k, d]) => el('button', { type: 'button', role: 'tab', 'data-tab': k, onclick: () => buka(k) }, d.label)));
  root.replaceChildren(tabs, konten);

  function buka(k) {
    if (sekarang && sekarang.hancurkan) sekarang.hancurkan();
    Object.keys(ctx.bus).forEach((x) => delete ctx.bus[x]);
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === k)));
    sekarang = definisi[k].panel(ctx);
    konten.replaceChildren(sekarang.el);
    if (sekarang.setelahTampil) sekarang.setelahTampil();
  }
  buka(awal);
}

/* ---------- Dialog isian angka (pengganti prompt) -> Promise<number|null> ---------- */
function mintaAngka({ judul, label, nilai = '', min = '0', step = '1000' }) {
  return new Promise((selesai) => {
    const isi = input('nilai', 'number', { required: true, min, step, inputmode: 'numeric', value: String(nilai) });
    const dlg = el('dialog', { class: 'dash-dialog', 'aria-label': judul });
    dlg.append(el('form', { method: 'dialog', class: 'dash-form' },
      el('h2', {}, judul), field(label, isi),
      el('div', { class: 'dash-actions' },
        el('button', { type: 'submit', value: 'kirim', class: 'btn btn--primary dash-btn-sm' }, 'Kirim'),
        el('button', { type: 'button', class: 'btn btn--ghost dash-btn-sm', onclick: () => dlg.close('batal') }, 'Batal'))));
    dlg.addEventListener('close', () => {
      const v = dlg.returnValue === 'kirim' ? Number(isi.value) : null;   // Esc/Batal -> null
      dlg.remove(); selesai(Number.isFinite(v) ? v : null);
    });
    document.body.append(dlg); dlg.showModal(); isi.focus();
  });
}

/* ---------- Riwayat status pengiriman (dimuat saat dibuka) ---------- */
function detailRiwayat(pengirimanId) {
  const isi = el('div', { class: 'dash-meta' });
  const det = el('details', { class: 'dash-details' }, el('summary', {}, 'Riwayat status'), isi);
  det.addEventListener('toggle', async () => {
    if (!det.open || isi.dataset.dimuat) return;
    isi.dataset.dimuat = '1';
    const r = await Transaksi.riwayatStatus(pengirimanId);
    isi.replaceChildren(...(r.ok
      ? r.data.map((l) => el('p', {}, `${waktuLokal(l.waktu)}: ${Transaksi.LABEL_STATUS[l.status] || l.status}${l.catatan ? ` (${l.catatan})` : ''}`))
      : [el('p', {}, r.message)]));
  });
  return det;
}

/* Langkah-langkah status (yang sudah dilewati ditebalkan) */
function langkahStatus(status) {
  const sekarang = Transaksi.URUTAN.indexOf(status);
  return el('div', { class: 'dash-steps' }, Transaksi.URUTAN.map((s, i) =>
    el('span', { class: `dash-step${i <= sekarang ? ' dash-step--on' : ''}` }, Transaksi.LABEL_STATUS[s])));
}

/* ---------- Bootstrap ---------- */
async function initDashboard() {
  const profile = await requireRole(['customer', 'sopir']); // admin diarahkan ke halamannya sendiri
  if (!profile) return;

  const isSopir = profile.role === 'sopir';
  document.getElementById('user-name').textContent = profile.nama || 'Pengguna';
  document.getElementById('user-role').textContent = isSopir ? 'Sopir' : 'Customer';
  document.getElementById('dash-title').textContent = isSopir ? 'Dasbor Sopir' : 'Dasbor Customer';
  document.getElementById('btn-logout').addEventListener('click', logoutUser);

  const banner = document.getElementById('status-banner');
  if (isSopir && profile.status_verifikasi !== 'verified') {
    banner.textContent = profile.status_verifikasi === 'rejected'
      ? 'Akun Anda ditolak admin. Perbaiki data armada Anda atau hubungi admin.'
      : 'Akun Anda menunggu verifikasi admin. Lengkapi profil armada agar bisa segera diperiksa.';
    banner.hidden = false;
  }

  const root = document.getElementById('app');
  if (isSopir) mountDriverDashboard(root, profile);
  else mountCustomerDashboard(root, profile);
}

// Bootstrap hanya untuk dasbor customer/sopir; halaman lain (admin.html) hanya memakai helper di atas
if (document.body.dataset.halaman === 'dasbor') document.addEventListener('DOMContentLoaded', initDashboard);
