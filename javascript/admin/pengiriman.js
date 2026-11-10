/* javascript/admin/pengiriman.js
   Fungsi-fungsi khusus modul pelacakan paket & pengiriman khusus dashboard admin.
*/

const STATUS_PENGIRIMAN_ADMIN = {
  menuju_muat: ['Menuju lokasi muat', 'wait'],
  memuat: ['Sedang memuat', 'wait'],
  dalam_perjalanan: ['Dalam perjalanan', 'wait'],
  tiba: ['Tiba di tujuan', 'wait'],
  selesai: ['Selesai', 'ok'],
};

/**
 * Filter daftar pengiriman berdasarkan status dan kata kunci pencarian.
 */
function filterPengirimanAdmin(daftar, statusFilter, kataKunci) {
  return daftar.filter((item) => {
    let cocokStatus = true;
    if (statusFilter === 'berjalan') cocokStatus = item.status !== 'selesai';
    else if (statusFilter === 'selesai') cocokStatus = item.status === 'selesai';

    if (!cocokStatus) return false;

    if (!kataKunci) return true;
    const teksGabungan = [
      item.id,
      item.muatan?.jenis,
      item.muatan?.jenis_muatan,
      item.sopir?.nama,
      item.customer?.nama,
      item.muatan?.asal_nama,
      item.muatan?.tujuan_nama,
    ].filter(Boolean).join(' ').toLowerCase();

    return teksGabungan.includes(kataKunci);
  });
}

/**
 * Render kartu pengiriman untuk admin.
 */
function renderKartuPengirimanAdmin(item, { onUbahStatus, onMuatRiwayat }) {
  const [label, tone] = STATUS_PENGIRIMAN_ADMIN[item.status] || ['Tidak diketahui', 'wait'];
  const m = item.muatan || {};
  const sopir = item.sopir || {};
  const customer = item.customer || {};

  const jenisMuatan = m.jenis_muatan || m.jenis || 'Muatan';
  const berat = m.berat_ton ? `${m.berat_ton} ton` : '';

  const detailRiwayatEl = el('div', { class: 'dash-meta' });
  const det = el('details', { class: 'dash-details' },
    el('summary', {}, 'Riwayat log status'),
    detailRiwayatEl
  );

  det.addEventListener('toggle', async () => {
    if (det.open && !detailRiwayatEl.dataset.dimuat) {
      detailRiwayatEl.dataset.dimuat = '1';
      detailRiwayatEl.textContent = 'Memuat log...';
      const riwayat = await onMuatRiwayat(item.id);
      detailRiwayatEl.replaceChildren(...riwayat.map((l) =>
        el('p', {}, `${waktuLokal(l.waktu)}: ${STATUS_PENGIRIMAN_ADMIN[l.status]?.[0] || l.status}${l.catatan ? ` (${l.catatan})` : ''}`)
      ));
    }
  });

  return el('article', { class: 'dash-item' },
    el('div', { class: 'dash-item__head' },
      el('strong', {}, `${jenisMuatan} ${berat}`),
      badge(label, tone)
    ),
    el('p', {}, `${m.asal_nama || 'Asal'} → ${m.tujuan_nama || 'Tujuan'}`),
    el('p', { class: 'dash-meta' },
      `Sopir: ${sopir.nama || '-'} (${sopir.no_hp || '-'}) | Customer: ${customer.nama || '-'} (${customer.no_hp || '-'})`
    ),
    langkahStatus(item.status),
    det,
    item.status !== 'selesai' ? el('div', { class: 'dash-actions' },
      el('button', {
        type: 'button',
        class: 'btn btn--ghost dash-btn-sm',
        onclick: () => onUbahStatus(item.id, 'selesai', 'Admin menyelesaikan pengiriman secara manual'),
      }, 'Tandai Selesai')
    ) : null
  );
}

/**
 * Mengambil data seluruh pengiriman dari Supabase.
 */
async function ambilDataPengirimanAdmin() {
  const { data, error } = await supabaseClient
    .from('pengiriman')
    .select('*, muatan:muatan_id(*), sopir:sopir_id(nama, no_hp), customer:customer_id(nama, no_hp)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Mengubah status pengiriman secara manual oleh admin.
 */
async function ubahStatusPengirimanAdmin(pengirimanId, statusBaru, catatan, msg, onSelesai) {
  if (!confirm(`Konfirmasi perubahan status pengiriman menjadi "${statusBaru}"?`)) return;
  setMsg(msg, 'Menyimpan perubahan...', 'ok');
  try {
    const { error } = await supabaseClient
      .from('pengiriman')
      .update({ status: statusBaru, waktu_tiba: statusBaru === 'selesai' ? new Date().toISOString() : null })
      .eq('id', pengirimanId);

    if (error) throw error;

    await supabaseClient.from('log_status').insert({
      pengiriman_id: pengirimanId,
      status: statusBaru,
      catatan: catatan || 'Status diubah oleh Admin',
    });

    setMsg(msg, 'Status pengiriman berhasil diperbarui.', 'ok');
    if (typeof onSelesai === 'function') await onSelesai();
  } catch (err) {
    setMsg(msg, pesanDb(err));
  }
}

/**
 * Pintu masuk tampilan modul Pelacakan Paket Admin.
 */
function mountAdminPelacakan(root) {
  let filterStatus = 'semua';
  let kataKunci = '';
  let daftarPengiriman = [];

  const wadah = el('div', { class: 'admin-module' });
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const ringkasan = el('p', { class: 'dash-meta' });
  const daftarEl = el('div', { class: 'dash-list' });

  const STATUS_FILTER = { semua: 'Semua', berjalan: 'Sedang Berjalan', selesai: 'Selesai' };

  const tabs = el('div', { class: 'dash-tabs', role: 'tablist' },
    Object.entries(STATUS_FILTER).map(([k, label]) => el('button', {
      type: 'button', role: 'tab', 'data-filter': k,
      onclick: () => { filterStatus = k; render(); },
    }, label))
  );

  const searchInput = input('cari_pengiriman', 'text', {
    placeholder: 'Cari nomor ID, jenis muatan, sopir, customer, atau rute...',
    class: 'admin-search-input',
  });
  searchInput.addEventListener('input', (e) => {
    kataKunci = e.target.value.trim().toLowerCase();
    render();
  });

  const searchBox = el('div', { class: 'admin-search-box' }, searchInput);
  wadah.append(tabs, searchBox, ringkasan, msg, daftarEl);
  root.replaceChildren(wadah);

  async function muat() {
    setMsg(msg, 'Memuat data pengiriman...', 'ok');
    try {
      daftarPengiriman = await ambilDataPengirimanAdmin();
      setMsg(msg, '');
      render();
    } catch (err) {
      setMsg(msg, pesanDb(err));
    }
  }

  function render() {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === filterStatus)));
    const tampil = filterPengirimanAdmin(daftarPengiriman, filterStatus, kataKunci);
    const aktif = daftarPengiriman.filter((p) => p.status !== 'selesai').length;

    ringkasan.textContent = `${aktif} pengiriman sedang berjalan dari total ${daftarPengiriman.length} transaksi.`;

    const aksi = {
      onUbahStatus: (id, st, cat) => ubahStatusPengirimanAdmin(id, st, cat, msg, muat),
      onMuatRiwayat: async (id) => {
        const { data } = await supabaseClient.from('log_status').select('*').eq('pengiriman_id', id).order('waktu', { ascending: true });
        return data || [];
      },
    };

    daftarEl.replaceChildren(...(tampil.length
      ? tampil.map((p) => renderKartuPengirimanAdmin(p, aksi))
      : [el('p', { class: 'dash-empty' }, 'Tidak ada data pengiriman.')]
    ));
  }

  muat();
}

if (typeof window !== 'undefined') {
  window.mountAdminPelacakan = mountAdminPelacakan;
  window.ambilDataPengirimanAdmin = ambilDataPengirimanAdmin;
  window.filterPengirimanAdmin = filterPengirimanAdmin;
  window.renderKartuPengirimanAdmin = renderKartuPengirimanAdmin;
  window.ubahStatusPengirimanAdmin = ubahStatusPengirimanAdmin;
  window.STATUS_PENGIRIMAN_ADMIN = STATUS_PENGIRIMAN_ADMIN;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mountAdminPelacakan,
    ambilDataPengirimanAdmin,
    filterPengirimanAdmin,
    renderKartuPengirimanAdmin,
    ubahStatusPengirimanAdmin,
    STATUS_PENGIRIMAN_ADMIN,
  };
}
