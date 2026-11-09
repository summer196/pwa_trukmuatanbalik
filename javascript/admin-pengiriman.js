/* admin-pengiriman.js
   Modul pelacakan paket dan status pengiriman untuk admin.
   Bergantung pada: supabase-config.js, auth.js, dashboard.js */

const STATUS_PENGIRIMAN_LABEL = {
  menuju_muat: ['Menuju lokasi muat', 'wait'],
  memuat: ['Sedang memuat', 'wait'],
  dalam_perjalanan: ['Dalam perjalanan', 'wait'],
  tiba: ['Tiba di tujuan', 'wait'],
  selesai: ['Selesai', 'ok'],
};

function mountAdminPelacakan(root) {
  let filterStatus = 'semua';
  let kataKunci = '';
  let daftarPengiriman = [];

  const wadah = el('div', { class: 'admin-module' });
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const ringkasan = el('p', { class: 'dash-meta' });
  const daftarEl = el('div', { class: 'dash-list' });

  // Filter Status
  const STATUS_FILTER = {
    semua: 'Semua',
    berjalan: 'Sedang Berjalan',
    selesai: 'Selesai',
  };

  const tabs = el('div', { class: 'dash-tabs', role: 'tablist' },
    Object.entries(STATUS_FILTER).map(([k, label]) => el('button', {
      type: 'button', role: 'tab', 'data-filter': k,
      onclick: () => { filterStatus = k; render(); },
    }, label)));

  // Pencarian
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

  async function muatData() {
    setMsg(msg, 'Memuat data pengiriman...', 'ok');
    const { data, error } = await supabaseClient
      .from('pengiriman')
      .select('*, muatan:muatan_id(jenis, berat_ton, panjang_m, lebar_m, tinggi_m, asal_nama, tujuan_nama, harga), sopir:sopir_id(nama, no_hp), customer:customer_id(nama, no_hp)')
      .order('created_at', { ascending: false });

    if (error) {
      setMsg(msg, pesanDb(error));
      return;
    }

    setMsg(msg, '');
    daftarPengiriman = data || [];
    render();
  }

  async function bukaRiwayatPelacakan(pengiriman) {
    const dialog = el('dialog', { class: 'dash-dialog admin-dialog-tracking', 'aria-label': 'Riwayat Pelacakan' });
    const judul = el('h2', {}, 'Riwayat Pelacakan Paket');
    const noId = el('p', { class: 'dash-meta' }, `ID Pengiriman: ${pengiriman.id}`);
    const [labelStatus, tone] = STATUS_PENGIRIMAN_LABEL[pengiriman.status] || [pengiriman.status, 'wait'];
    const statusSaatIni = el('div', { class: 'admin-status-box' },
      el('span', { class: 'dash-meta' }, 'Status Terkini: '),
      badge(labelStatus, tone));

    const rute = el('p', {}, `${pengiriman.muatan ? pengiriman.muatan.asal_nama : '-'} ke ${pengiriman.muatan ? pengiriman.muatan.tujuan_nama : '-'}`);
    const muatanInfo = el('p', { class: 'dash-meta' }, pengiriman.muatan ? `Muatan: ${pengiriman.muatan.jenis} (${pengiriman.muatan.berat_ton} ton)` : '');

    const logWadah = el('div', { class: 'admin-timeline' }, el('p', { class: 'dash-meta' }, 'Memuat riwayat status...'));
    const btnTutup = el('button', { type: 'button', class: 'btn btn--primary btn--block', onclick: () => { dialog.close(); dialog.remove(); } }, 'Tutup');

    dialog.append(el('div', { class: 'dash-form' }, judul, noId, statusSaatIni, rute, muatanInfo, logWadah, btnTutup));
    document.body.appendChild(dialog);
    dialog.showModal();

    const { data: logs, error } = await supabaseClient
      .from('log_status')
      .select('status, waktu, catatan')
      .eq('pengiriman_id', pengiriman.id)
      .order('waktu', { ascending: true });

    if (error || !logs || !logs.length) {
      logWadah.replaceChildren(el('p', { class: 'dash-empty' }, 'Belum ada catatan riwayat status.'));
      return;
    }

    logWadah.replaceChildren(...logs.map((l) => {
      const [lbl] = STATUS_PENGIRIMAN_LABEL[l.status] || [l.status];
      return el('div', { class: 'admin-timeline__item' },
        el('strong', {}, lbl),
        l.catatan ? el('span', {}, ` - ${l.catatan}`) : null,
        el('div', { class: 'dash-meta', style: 'font-size:.8rem' }, waktuLokal(l.waktu)));
    }));
  }

  function kartuPengiriman(g) {
    const [statusLabel, statusTone] = STATUS_PENGIRIMAN_LABEL[g.status] || [g.status, 'wait'];
    const muatan = g.muatan || {};
    const sopir = g.sopir || {};
    const customer = g.customer || {};

    const btnLacak = el('button', {
      type: 'button', class: 'btn btn--ghost dash-btn-sm',
      onclick: () => bukaRiwayatPelacakan(g),
    }, 'Lihat Riwayat Pelacakan');

    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' },
        el('strong', {}, `${muatan.jenis || 'Muatan'}, ${muatan.berat_ton || 0} ton`),
        badge(statusLabel, statusTone)),
      el('p', { class: 'dash-meta', style: 'font-size:.8rem; word-break:break-all' }, `ID: ${g.id}`),
      el('p', {}, `${muatan.asal_nama || '-'} ke ${muatan.tujuan_nama || '-'}`),
      el('p', { class: 'dash-meta' }, `Customer: ${customer.nama || '-'} (${customer.no_hp || '-'})`),
      el('p', { class: 'dash-meta' }, `Sopir: ${sopir.nama || '-'} (${sopir.no_hp || '-'})`),
      g.waktu_muat ? el('p', { class: 'dash-meta' }, `Waktu Berangkat: ${waktuLokal(g.waktu_muat)}`) : null,
      g.waktu_tiba ? el('p', { class: 'dash-meta' }, `Waktu Tiba: ${waktuLokal(g.waktu_tiba)}`) : null,
      langkahStatus(g.status),
      el('div', { class: 'dash-actions', style: 'margin-top:8px' }, btnLacak));
  }

  function render() {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filter === filterStatus)));

    let hasil = daftarPengiriman;

    if (filterStatus === 'berjalan') {
      hasil = hasil.filter((g) => g.status !== 'selesai');
    } else if (filterStatus === 'selesai') {
      hasil = hasil.filter((g) => g.status === 'selesai');
    }

    if (kataKunci) {
      hasil = hasil.filter((g) => {
        const idCocok = String(g.id).toLowerCase().includes(kataKunci);
        const muatan = g.muatan ? `${g.muatan.jenis} ${g.muatan.asal_nama} ${g.muatan.tujuan_nama}`.toLowerCase() : '';
        const sopir = g.sopir ? `${g.sopir.nama} ${g.sopir.no_hp}`.toLowerCase() : '';
        const cust = g.customer ? `${g.customer.nama} ${g.customer.no_hp}`.toLowerCase() : '';
        return idCocok || muatan.includes(kataKunci) || sopir.includes(kataKunci) || cust.includes(kataKunci);
      });
    }

    const totalBerjalan = daftarPengiriman.filter((g) => g.status !== 'selesai').length;
    const totalSelesai = daftarPengiriman.filter((g) => g.status === 'selesai').length;
    ringkasan.textContent = `Menampilkan ${hasil.length} dari ${daftarPengiriman.length} pengiriman (${totalBerjalan} aktif, ${totalSelesai} selesai).`;

    daftarEl.replaceChildren(...(hasil.length ? hasil.map(kartuPengiriman) : [el('p', { class: 'dash-empty' }, 'Tidak ada data pengiriman yang sesuai.')]));
  }

  muatData();
}
