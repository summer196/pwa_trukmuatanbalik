/* admin-customer.js
   Modul pengelolaan dan monitoring data customer khusus admin.
   Bergantung pada: supabase-config.js, auth.js, dashboard.js */

const STATUS_MUATAN_CUSTOMER = {
  terbuka: ['Terbuka', 'ok'],
  terkunci: ['Sopir Dipilih', 'wait'],
  selesai: ['Selesai', 'ok'],
  dibatalkan: ['Dibatalkan', 'no'],
};

function mountAdminCustomer(root) {
  let kataKunci = '';
  let daftarCustomer = [];
  let daftarMuatan = [];

  const wadah = el('div', { class: 'admin-module' });
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const ringkasan = el('p', { class: 'dash-meta' });
  const daftarEl = el('div', { class: 'dash-list' });

  // Pencarian
  const searchInput = input('cari_customer', 'text', {
    placeholder: 'Cari nama customer atau nomor HP...',
    class: 'admin-search-input',
  });
  searchInput.addEventListener('input', (e) => {
    kataKunci = e.target.value.trim().toLowerCase();
    render();
  });

  const searchBox = el('div', { class: 'admin-search-box' }, searchInput);

  wadah.append(searchBox, ringkasan, msg, daftarEl);
  root.replaceChildren(wadah);

  async function muatData() {
    setMsg(msg, 'Memuat data customer...', 'ok');
    const [c, m] = await Promise.all([
      supabaseClient.from('profiles').select('id, nama, no_hp, created_at').eq('role', 'customer').order('created_at', { ascending: false }),
      supabaseClient.from('muatan').select('*').order('created_at', { ascending: false }),
    ]);

    if (c.error || m.error) {
      setMsg(msg, pesanDb(c.error || m.error));
      return;
    }

    setMsg(msg, '');
    daftarCustomer = c.data || [];
    daftarMuatan = m.data || [];
    render();
  }

  function muatanDariCustomer(customerId) {
    return daftarMuatan.filter((m) => m.customer_id === customerId);
  }

  function kartuMuatanKecil(m) {
    const [labelStatus, tone] = STATUS_MUATAN_CUSTOMER[m.status] || [m.status, 'wait'];
    return el('div', { class: 'dash-unit' },
      el('div', { class: 'dash-item__head' },
        el('strong', {}, `${m.jenis}, ${m.berat_ton} ton`),
        badge(labelStatus, tone)),
      el('p', {}, `${m.asal_nama} ke ${m.tujuan_nama}`),
      el('p', { class: 'dash-meta' }, `Unit: ${m.jenis_unit}, Tawaran: ${rupiah(m.harga)}, Muat: ${tanggal(m.jadwal_muat)}`));
  }

  function kartuCustomer(cust) {
    const muatanList = muatanDariCustomer(cust.id);
    const aktif = muatanList.filter((m) => m.status === 'terbuka' || m.status === 'terkunci').length;
    const selesai = muatanList.filter((m) => m.status === 'selesai').length;

    const listMuatanEl = el('div', { class: 'dash-list', style: 'margin-top:8px' });
    const detailMuatan = el('details', { class: 'dash-details' },
      el('summary', {}, `Daftar Muatan Diposting (${muatanList.length})`),
      listMuatanEl);

    detailMuatan.addEventListener('toggle', () => {
      if (detailMuatan.open) {
        listMuatanEl.replaceChildren(...(muatanList.length
          ? muatanList.map(kartuMuatanKecil)
          : [el('p', { class: 'dash-empty' }, 'Customer ini belum memposting muatan.')]));
      }
    });

    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' },
        el('strong', {}, cust.nama || '(Tanpa nama)'),
        badge('Customer', 'ok')),
      el('p', { class: 'dash-meta' }, 'Nomor HP: ', cust.no_hp ? el('a', { href: `tel:${cust.no_hp}` }, cust.no_hp) : '-'),
      el('p', { class: 'dash-meta' }, `Terdaftar sejak: ${tanggal(String(cust.created_at).slice(0, 10))}`),
      el('p', { class: 'dash-meta' }, `Statistik: ${muatanList.length} total muatan (${aktif} aktif, ${selesai} selesai)`),
      detailMuatan);
  }

  function render() {
    let hasil = daftarCustomer;

    if (kataKunci) {
      hasil = hasil.filter((c) => {
        const nama = String(c.nama || '').toLowerCase();
        const noHp = String(c.no_hp || '').toLowerCase();
        return nama.includes(kataKunci) || noHp.includes(kataKunci);
      });
    }

    ringkasan.textContent = `Menampilkan ${hasil.length} dari ${daftarCustomer.length} customer terdaftar. Total muatan customer: ${daftarMuatan.length}.`;
    daftarEl.replaceChildren(...(hasil.length ? hasil.map(kartuCustomer) : [el('p', { class: 'dash-empty' }, 'Tidak ada data customer yang cocok.')]));
  }

  muatData();
}
