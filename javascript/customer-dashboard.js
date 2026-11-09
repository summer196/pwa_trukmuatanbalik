/* customer-dashboard.js - dasbor customer dengan dua tab: Muatan (posting + penawaran masuk) dan Pengiriman.
   Bergantung pada: supabase-config.js, auth.js, dashboard.js, transaction.js */

const STATUS_MUATAN = {
  terbuka: ['Terbuka', 'ok'],
  terkunci: ['Sopir dipilih', 'wait'],
  selesai: ['Selesai', 'ok'],
  dibatalkan: ['Dibatalkan', 'no'],
};
const CONTOH_MUATAN = ['Trafo', 'Baja', 'Semen', 'Alat berat', 'Pipa', 'Beton pracetak'];

function mountCustomerDashboard(root, profile) {
  const ctx = { profile, terverifikasi: true, bus: {} };
  const berhenti = Transaksi.berlangganan({
    onPenawaranBaru: () => ctx.bus.penawaranBaru && ctx.bus.penawaranBaru(),
    onPengirimanBerubah: () => ctx.bus.segarkan && ctx.bus.segarkan(),
  });
  window.addEventListener('pagehide', berhenti);

  pasangPanelTab(root, {
    muatan: { label: 'Muatan', panel: panelMuatan },
    pengiriman: { label: 'Pengiriman', panel: panelPengirimanCustomer },
  }, 'muatan', ctx);
}

/* =====================================================================
   TAB 1 - MUATAN: posting, daftar, dan penawaran yang masuk
   ===================================================================== */
function panelMuatan({ profile, bus }) {
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const daftar = el('div', { class: 'dash-list' });
  const terbuka = new Set();            // id muatan yang daftar penawarannya sedang dibuka (dipertahankan saat penyegaran)

  const form = el('form', { class: 'dash-form' },
    field('Jenis muatan', input('jenis', 'text', { required: true, list: 'contoh-muatan', placeholder: 'Contoh: Trafo' })),
    el('datalist', { id: 'contoh-muatan' }, CONTOH_MUATAN.map((m) => el('option', { value: m }))),
    field('Berat (ton)', numberInput('berat_ton')),
    dimensiFieldset('Dimensi muatan (meter)'),
    lokasiField('asal', 'Lokasi asal (muat)'),
    lokasiField('tujuan', 'Lokasi tujuan (bongkar)'),
    field('Jadwal muat', input('jadwal_muat', 'date', { required: true, min: hariIni() })),
    field('Jenis unit yang dibutuhkan', select('jenis_unit', JENIS_UNIT)),
    field('Harga tawaran (Rp)', numberInput('harga', { min: '0', step: '1000', inputmode: 'numeric' })),
    msg,
    el('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Posting muatan'));

  /* --- penawaran yang masuk untuk satu muatan --- */
  async function isiPenawaran(m, wadah) {
    wadah.replaceChildren(el('p', { class: 'dash-meta' }, 'Memuat penawaran...'));
    const r = await Transaksi.penawaranUntukMuatan(m.id);
    if (!r.ok) { wadah.replaceChildren(el('p', { class: 'dash-meta' }, r.message)); return; }
    if (!r.data.length) { wadah.replaceChildren(el('p', { class: 'dash-meta' }, 'Belum ada penawaran. Daftar ini diperbarui otomatis saat ada yang menawar.')); return; }
    wadah.replaceChildren(...r.data.map((w) => el('div', { class: 'dash-unit' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, w.sopir ? w.sopir.nama : 'Sopir'), el('strong', {}, rupiah(w.harga))),
      w.armada ? el('p', { class: 'dash-meta' }, `${w.armada.plat_nomor}, ${w.armada.jenis_unit}, ${w.armada.kapasitas_ton} ton`) : null,
      w.sopir && w.sopir.no_hp ? el('p', { class: 'dash-meta' }, 'HP: ', el('a', { href: `tel:${w.sopir.no_hp}` }, w.sopir.no_hp)) : null,
      w.status === 'menunggu' && m.status === 'terbuka' ? el('button', {
        type: 'button', class: 'btn btn--primary dash-btn-sm',
        onclick: async () => {
          if (!confirm(`Pilih ${w.sopir ? w.sopir.nama : 'sopir ini'} (${rupiah(w.harga)})? Penawaran lain akan ditolak.`)) return;
          const p = await Transaksi.pilihPenawaran(w.id);
          setMsg(msg, p.ok ? 'Sopir dipilih. Pantau perjalanannya di tab Pengiriman.' : p.message, p.ok ? 'ok' : 'error');
          muatDaftar();
        },
      }, 'Pilih sopir') : badge(w.status === 'dipilih' ? 'Dipilih' : 'Tidak dipilih', w.status === 'dipilih' ? 'ok' : 'no'))));
  }

  function kartuMuatan(m) {
    const [label, tone] = STATUS_MUATAN[m.status] || STATUS_MUATAN.terbuka;
    const wadah = el('div', { class: 'dash-list' });
    const det = el('details', { class: 'dash-details' }, el('summary', {}, 'Penawaran masuk'), wadah);
    det.addEventListener('toggle', () => {
      if (det.open) { terbuka.add(m.id); isiPenawaran(m, wadah); } else terbuka.delete(m.id);
    });
    if (terbuka.has(m.id)) { det.open = true; }                          // memicu toggle -> memuat ulang isi

    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, `${m.jenis}, ${m.berat_ton} ton`), badge(label, tone)),
      el('p', {}, `${m.asal_nama} ke ${m.tujuan_nama}`),
      el('p', { class: 'dash-meta' }, `Muat ${tanggal(m.jadwal_muat)}, ${m.jenis_unit}, ${rupiah(m.harga)}`),
      el('p', { class: 'dash-meta' }, `Dimensi ${m.panjang_m} x ${m.lebar_m} x ${m.tinggi_m} m`),
      det,
      m.status === 'terbuka' ? el('button', {
        type: 'button', class: 'btn btn--ghost dash-btn-sm',
        onclick: async () => {
          if (!confirm('Hapus muatan ini? Penawaran yang masuk ikut terhapus.')) return;
          const { error } = await supabaseClient.from('muatan').delete().eq('id', m.id);
          if (error) setMsg(msg, pesanDb(error)); else muatDaftar();
        },
      }, 'Hapus') : null);
  }

  async function muatDaftar() {
    const { data, error } = await supabaseClient.from('muatan').select('*').order('created_at', { ascending: false });
    if (error) { daftar.replaceChildren(kosong(pesanDb(error))); return; }
    daftar.replaceChildren(...(data.length ? data.map(kartuMuatan) : [kosong('Belum ada muatan. Isi form untuk memposting muatan pertama Anda.')]));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.asal_lat || !d.tujuan_lat) { setMsg(msg, 'Tentukan titik asal dan tujuan dengan tombol "Cari titik".'); return; }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; setMsg(msg, 'Menyimpan...', 'ok');
    const { error } = await supabaseClient.from('muatan').insert({
      customer_id: profile.id,
      jenis: d.jenis.trim(), berat_ton: Number(d.berat_ton),
      panjang_m: Number(d.panjang_m), lebar_m: Number(d.lebar_m), tinggi_m: Number(d.tinggi_m),
      asal_nama: d.asal_nama.trim(), asal_lat: Number(d.asal_lat), asal_lon: Number(d.asal_lon),
      tujuan_nama: d.tujuan_nama.trim(), tujuan_lat: Number(d.tujuan_lat), tujuan_lon: Number(d.tujuan_lon),
      jadwal_muat: d.jadwal_muat, jenis_unit: d.jenis_unit, harga: Number(d.harga),
      status: 'terbuka',
    });
    btn.disabled = false;
    if (error) { setMsg(msg, pesanDb(error)); return; }

    form.reset();
    form.querySelectorAll('[name$="_nama"]').forEach((i) => i.dispatchEvent(new Event('input'))); // kosongkan koordinat
    setMsg(msg, 'Muatan berhasil diposting. Sopir yang cocok akan melihatnya.', 'ok');
    muatDaftar();
  });

  bus.penawaranBaru = () => { setMsg(msg, 'Ada penawaran baru masuk.', 'ok'); muatDaftar(); };
  bus.segarkan = muatDaftar;
  muatDaftar();
  return { el: el('div', { class: 'dash-grid' },
    el('section', { class: 'dash-card' }, el('h2', {}, 'Muatan baru'), form),
    el('section', { class: 'dash-card' }, el('h2', {}, 'Muatan Anda'), daftar)) };
}

/* =====================================================================
   TAB 2 - PENGIRIMAN: pantau status perjalanan
   ===================================================================== */
function panelPengirimanCustomer({ bus }) {
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const daftar = el('div', { class: 'dash-list' });

  function kartu(g) {
    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, `${g.muatan.jenis}, ${g.muatan.berat_ton} ton`), badge(Transaksi.LABEL_STATUS[g.status], g.status === 'selesai' ? 'ok' : 'wait')),
      el('p', {}, `${g.muatan.asal_nama} ke ${g.muatan.tujuan_nama}`),
      g.sopir ? el('p', { class: 'dash-meta' }, 'Sopir: ', g.sopir.nama, g.sopir.no_hp ? [', ', el('a', { href: `tel:${g.sopir.no_hp}` }, g.sopir.no_hp)] : null) : null,
      langkahStatus(g.status),
      g.waktu_muat ? el('p', { class: 'dash-meta' }, `Berangkat ${waktuLokal(g.waktu_muat)}`) : null,
      g.waktu_tiba ? el('p', { class: 'dash-meta' }, `Tiba ${waktuLokal(g.waktu_tiba)}`) : null,
      detailRiwayat(g.id));
  }

  async function muat() {
    const r = await Transaksi.pengirimanSaya();
    if (!r.ok) { setMsg(msg, r.message); return; }
    daftar.replaceChildren(...(r.data.length ? r.data.map(kartu) : [kosong('Belum ada pengiriman. Pilih sopir di tab Muatan untuk memulai.')]));
  }

  bus.segarkan = muat;
  muat();
  return { el: el('section', { class: 'dash-card' }, el('h2', {}, 'Pengiriman Anda'), msg, daftar) };
}
