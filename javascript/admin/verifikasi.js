/* javascript/admin/verifikasi.js
   Fungsi-fungsi khusus modul verifikasi akun sopir dan armada untuk admin (FR-02, Mockup M-05).
*/

const STATUS_VERIF_ADMIN = {
  pending: ['Menunggu', 'wait'],
  verified: ['Terverifikasi', 'ok'],
  rejected: ['Ditolak', 'no'],
};

/**
 * Filter data sopir berdasarkan kriteria verifikasi.
 */
function filterDataVerifikasi(sopirList, armadaList, filter) {
  const armadaDari = (id) => armadaList.filter((a) => (a.pengguna_id || a.id_pengguna) === id);
  const perluDiperiksa = (s) => s.status_verifikasi === 'pending' || armadaDari(s.id).some((a) => a.status_verifikasi === 'pending');

  if (filter === 'verified') {
    return sopirList.filter((s) => s.status_verifikasi === 'verified');
  }
  if (filter === 'semua') {
    return sopirList;
  }
  // Default 'perlu'
  return sopirList.filter(perluDiperiksa);
}

/**
 * Membuat kartu representasi satu unit armada untuk verifikasi admin.
 */
function renderKartuArmada(a, { onVerifikasi, onTolak }) {
  const [label, tone] = STATUS_VERIF_ADMIN[a.status_verifikasi] || STATUS_VERIF_ADMIN.pending;
  const panjang = a.panjang_bak_m ?? a.panjang_m;
  const lebar = a.lebar_bak_m ?? a.lebar_m;
  const tinggi = a.tinggi_bak_m ?? a.tinggi_m;

  return el('div', { class: 'dash-unit' },
    el('div', { class: 'dash-item__head' }, el('strong', {}, a.plat_nomor), badge(label, tone)),
    el('p', {}, `${a.jenis_unit}, kapasitas ${a.kapasitas_ton} ton`),
    el('p', { class: 'dash-meta' }, `Bak ${panjang} × ${lebar} × ${tinggi} m`),
    el('div', { class: 'dash-actions' },
      a.status_verifikasi !== 'verified' ? el('button', {
        type: 'button',
        class: 'btn btn--primary dash-btn-sm',
        onclick: () => onVerifikasi(a.id),
      }, 'Verifikasi unit') : null,
      a.status_verifikasi !== 'rejected' ? el('button', {
        type: 'button',
        class: 'btn btn--ghost dash-btn-sm',
        onclick: () => onTolak(a.id, a.plat_nomor),
      }, 'Tolak unit') : null
    )
  );
}

/**
 * Membuat kartu data akun sopir beserta daftar armadanya.
 */
function renderKartuSopir(s, armadaSopir, { onVerifikasiAkun, onTolakAkun, onVerifikasiArmada, onTolakArmada }) {
  const [label, tone] = STATUS_VERIF_ADMIN[s.status_verifikasi] || STATUS_VERIF_ADMIN.pending;
  const tanggalDaftar = s.created_at ? tanggal(String(s.created_at).slice(0, 10)) : '-';

  return el('article', { class: 'dash-item' },
    el('div', { class: 'dash-item__head' }, el('strong', {}, s.nama || '(Tanpa nama)'), badge(label, tone)),
    el('p', { class: 'dash-meta' }, `HP: ${s.no_hp || '-'}, terdaftar ${tanggalDaftar}`),
    el('div', { class: 'dash-actions' },
      s.status_verifikasi !== 'verified' ? el('button', {
        type: 'button',
        class: 'btn btn--primary dash-btn-sm',
        onclick: () => onVerifikasiAkun(s.id),
      }, 'Verifikasi akun') : null,
      s.status_verifikasi !== 'rejected' ? el('button', {
        type: 'button',
        class: 'btn btn--ghost dash-btn-sm',
        onclick: () => onTolakAkun(s.id, s.nama),
      }, 'Tolak akun') : null
    ),
    el('h3', { class: 'dash-sub' }, `Armada (${armadaSopir.length})`),
    armadaSopir.length
      ? armadaSopir.map((a) => renderKartuArmada(a, { onVerifikasi: onVerifikasiArmada, onTolak: onTolakArmada }))
      : el('p', { class: 'dash-empty' }, 'Belum ada data armada yang didaftarkan.')
  );
}

/**
 * Memperbarui status verifikasi data di Supabase (profiles atau armada).
 */
async function ubahStatusVerifikasi(tabel, id, statusBaru, msg, onSelesai) {
  setMsg(msg, 'Menyimpan perubahan...', 'ok');
  const { data, error } = await supabaseClient
    .from(tabel)
    .update({ status_verifikasi: statusBaru })
    .eq('id', id)
    .select('id');

  if (error) {
    setMsg(msg, pesanDb(error));
    return;
  }
  if (!data || !data.length) {
    setMsg(msg, 'Tidak ada data yang berubah. Pastikan izin admin aktif.');
    return;
  }
  setMsg(msg, 'Status verifikasi berhasil diperbarui.', 'ok');
  if (typeof onSelesai === 'function') await onSelesai();
}

/**
 * Mengambil data sopir dan seluruh armada dari database.
 */
async function ambilDataVerifikasi() {
  const [p, a] = await Promise.all([
    supabaseClient.from('profiles').select('id, nama, no_hp, status_verifikasi, created_at').eq('role', 'sopir').order('created_at', { ascending: false }),
    supabaseClient.from('armada').select('*').order('created_at', { ascending: false }),
  ]);
  if (p.error || a.error) {
    throw (p.error || a.error);
  }
  return { sopirList: p.data || [], armadaList: a.data || [] };
}

/**
 * Pintu masuk utama tampilan modul Verifikasi Admin.
 */
function mountAdminVerifikasi(root) {
  let filter = 'perlu';
  let sopir = [];
  let armada = [];

  const wadah = el('div', { class: 'admin-module' });
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const ringkasan = el('p', { class: 'dash-meta' });
  const daftar = el('div', { class: 'dash-list' });
  const FILTER_TABS = { perlu: 'Perlu diperiksa', verified: 'Terverifikasi', semua: 'Semua' };

  const tabs = el('div', { class: 'dash-tabs', role: 'tablist' },
    Object.entries(FILTER_TABS).map(([key, label]) => el('button', {
      type: 'button', role: 'tab', 'data-filter': key,
      onclick: () => { filter = key; render(); },
    }, label))
  );

  wadah.append(tabs, ringkasan, msg, daftar);
  root.replaceChildren(wadah);

  async function muat() {
    setMsg(msg, 'Memuat data sopir...', 'ok');
    try {
      const data = await ambilDataVerifikasi();
      sopir = data.sopirList;
      armada = data.armadaList;
      setMsg(msg, '');
      render();
    } catch (err) {
      setMsg(msg, pesanDb(err));
    }
  }

  function render() {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === filter)));
    const tampil = filterDataVerifikasi(sopir, armada, filter);
    const armadaDari = (id) => armada.filter((a) => (a.pengguna_id || a.id_pengguna) === id);
    const perluDiperiksa = (s) => s.status_verifikasi === 'pending' || armadaDari(s.id).some((a) => a.status_verifikasi === 'pending');

    ringkasan.textContent = `${sopir.filter(perluDiperiksa).length} dari ${sopir.length} sopir perlu diperiksa.`;

    const aksi = {
      onVerifikasiAkun: (id) => ubahStatusVerifikasi('profiles', id, 'verified', msg, muat),
      onTolakAkun: (id, nama) => {
        if (confirm(`Tolak akun ${nama}?`)) ubahStatusVerifikasi('profiles', id, 'rejected', msg, muat);
      },
      onVerifikasiArmada: (id) => ubahStatusVerifikasi('armada', id, 'verified', msg, muat),
      onTolakArmada: (id, plat) => {
        if (confirm(`Tolak unit armada ${plat}?`)) ubahStatusVerifikasi('armada', id, 'rejected', msg, muat);
      },
    };

    daftar.replaceChildren(...(tampil.length
      ? tampil.map((s) => renderKartuSopir(s, armadaDari(s.id), aksi))
      : [el('p', { class: 'dash-empty' }, 'Tidak ada data sopir pada filter ini.')]
    ));
  }

  muat();
}

if (typeof window !== 'undefined') {
  window.mountAdminVerifikasi = mountAdminVerifikasi;
  window.ambilDataVerifikasi = ambilDataVerifikasi;
  window.filterDataVerifikasi = filterDataVerifikasi;
  window.renderKartuSopir = renderKartuSopir;
  window.renderKartuArmada = renderKartuArmada;
  window.ubahStatusVerifikasi = ubahStatusVerifikasi;
  window.STATUS_VERIF_ADMIN = STATUS_VERIF_ADMIN;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mountAdminVerifikasi,
    ambilDataVerifikasi,
    filterDataVerifikasi,
    renderKartuSopir,
    renderKartuArmada,
    ubahStatusVerifikasi,
    STATUS_VERIF_ADMIN,
  };
}
