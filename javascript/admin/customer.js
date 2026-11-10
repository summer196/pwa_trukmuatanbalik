/* javascript/admin/customer.js
   Fungsi-fungsi khusus modul data customer untuk dashboard admin.
*/

const STATUS_MUATAN_ADMIN = {
  terbuka: ['Terbuka', 'ok'],
  tersedia: ['Tersedia', 'ok'],
  terkunci: ['Sopir Dipilih', 'wait'],
  selesai: ['Selesai', 'ok'],
  dibatalkan: ['Dibatalkan', 'no'],
};

/**
 * Filter daftar customer berdasarkan nama atau nomor HP.
 */
function filterCustomerAdmin(daftarCustomer, kataKunci) {
  if (!kataKunci) return daftarCustomer;
  return daftarCustomer.filter((c) => {
    const teks = `${c.nama || ''} ${c.no_hp || ''}`.toLowerCase();
    return teks.includes(kataKunci);
  });
}

/**
 * Render kartu data satu customer dan muatan yang diposting.
 */
function renderKartuCustomerAdmin(c, muatanList) {
  const muatanCust = muatanList.filter((m) => (m.customer_id || m.id_customer) === c.id);
  const tanggalDaftar = c.created_at ? tanggal(String(c.created_at).slice(0, 10)) : '-';

  return el('article', { class: 'dash-item' },
    el('div', { class: 'dash-item__head' },
      el('strong', {}, c.nama || '(Customer Tanpa Nama)'),
      badge(`Posting: ${muatanCust.length}`, 'ok')
    ),
    el('p', { class: 'dash-meta' },
      `No. HP: ${c.no_hp || '-'} | Bergabung: ${tanggalDaftar}`
    ),
    el('h3', { class: 'dash-sub' }, `Muatan yang Diposting (${muatanCust.length})`),
    muatanCust.length
      ? el('div', { class: 'dash-list' }, muatanCust.map((m) => {
          const [lbl, tone] = STATUS_MUATAN_ADMIN[m.status] || ['Terbuka', 'ok'];
          const jenis = m.jenis_muatan || m.jenis || 'Muatan';
          return el('div', { class: 'dash-unit' },
            el('div', { class: 'dash-item__head' },
              el('span', {}, `${jenis}, ${m.berat_ton} ton`),
              badge(lbl, tone)
            ),
            el('p', { class: 'dash-meta' }, `${m.asal_nama || 'Asal'} → ${m.tujuan_nama || 'Tujuan'}`),
            el('p', { class: 'dash-meta' }, `Tawaran: ${rupiah(m.harga_tawaran || m.harga || 0)}`)
          );
        }))
      : el('p', { class: 'dash-empty' }, 'Customer ini belum pernah memposting muatan.')
  );
}

/**
 * Mengambil data semua pengguna customer dan data muatannya.
 */
async function ambilDataCustomerAdmin() {
  const [c, m] = await Promise.all([
    supabaseClient.from('profiles').select('id, nama, no_hp, created_at').eq('role', 'customer').order('created_at', { ascending: false }),
    supabaseClient.from('muatan').select('*').order('created_at', { ascending: false }),
  ]);
  if (c.error || m.error) throw (c.error || m.error);
  return { customerList: c.data || [], muatanList: m.data || [] };
}

/**
 * Pintu masuk utama modul data customer admin.
 */
function mountAdminCustomer(root) {
  let kataKunci = '';
  let daftarCustomer = [];
  let daftarMuatan = [];

  const wadah = el('div', { class: 'admin-module' });
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const ringkasan = el('p', { class: 'dash-meta' });
  const daftarEl = el('div', { class: 'dash-list' });

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

  async function muat() {
    setMsg(msg, 'Memuat data customer...', 'ok');
    try {
      const data = await ambilDataCustomerAdmin();
      daftarCustomer = data.customerList;
      daftarMuatan = data.muatanList;
      setMsg(msg, '');
      render();
    } catch (err) {
      setMsg(msg, pesanDb(err));
    }
  }

  function render() {
    const tampil = filterCustomerAdmin(daftarCustomer, kataKunci);
    ringkasan.textContent = `Menampilkan ${tampil.length} dari total ${daftarCustomer.length} pengguna customer terdaftar.`;

    daftarEl.replaceChildren(...(tampil.length
      ? tampil.map((c) => renderKartuCustomerAdmin(c, daftarMuatan))
      : [el('p', { class: 'dash-empty' }, 'Tidak ada data customer yang cocok.')]
    ));
  }

  muat();
}

if (typeof window !== 'undefined') {
  window.mountAdminCustomer = mountAdminCustomer;
  window.ambilDataCustomerAdmin = ambilDataCustomerAdmin;
  window.filterCustomerAdmin = filterCustomerAdmin;
  window.renderKartuCustomerAdmin = renderKartuCustomerAdmin;
  window.STATUS_MUATAN_ADMIN = STATUS_MUATAN_ADMIN;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mountAdminCustomer,
    ambilDataCustomerAdmin,
    filterCustomerAdmin,
    renderKartuCustomerAdmin,
    STATUS_MUATAN_ADMIN,
  };
}
