/* driver-dashboard.js - dasbor sopir dengan tiga tab: Cari muatan, Pengiriman, Armada.
   Bergantung pada: supabase-config.js, auth.js, dashboard.js, search-engine.js, transaction.js, map.js (Leaflet) */

const STATUS_ARMADA = {
  pending: ['Menunggu verifikasi', 'wait'],
  verified: ['Terverifikasi', 'ok'],
  rejected: ['Ditolak', 'no'],
};
const STATUS_PENAWARAN = { menunggu: ['Menunggu customer', 'wait'], dipilih: ['Dipilih', 'ok'], ditolak: ['Tidak dipilih', 'no'] };

function normalisasiPlat(s) { return s.toUpperCase().replace(/\s+/g, ' ').trim(); }

function mountDriverDashboard(root, profile) {
  const terverifikasi = profile.status_verifikasi === 'verified';
  const ctx = { profile, terverifikasi, bus: {} };

  // Satu langganan realtime untuk seluruh dasbor; kabarnya diteruskan ke panel yang sedang aktif
  const berhenti = Transaksi.berlangganan({
    onMuatanBaru: (m) => ctx.bus.muatanBaru && ctx.bus.muatanBaru(m),
    onPenawaranBerubah: () => ctx.bus.segarkan && ctx.bus.segarkan(),
    onPengirimanBerubah: () => ctx.bus.segarkan && ctx.bus.segarkan(),
  });
  window.addEventListener('pagehide', berhenti);

  const queryTab = new URLSearchParams(window.location.search).get('tab') || (window.location.hash ? window.location.hash.slice(1) : null);
  const tabDefault = (queryTab && ['cari', 'pengiriman', 'armada'].includes(queryTab))
    ? queryTab
    : (terverifikasi ? 'cari' : 'armada');

  pasangPanelTab(root, {
    cari: { label: 'Cari muatan', panel: panelCari },
    pengiriman: { label: 'Pengiriman', panel: panelPengiriman },
    armada: { label: 'Armada', panel: panelArmada },
  }, tabDefault, ctx);
}

/* =====================================================================
   TAB 1 - CARI MUATAN (Haversine, muatan balik, validasi kompatibilitas, peta, tawar)
   ===================================================================== */
function panelCari({ profile, terverifikasi, bus }) {
  if (!terverifikasi) {
    return { el: el('section', { class: 'dash-card' }, el('h2', {}, 'Cari muatan'),
      kosong('Fitur ini aktif setelah admin memverifikasi akun dan armada Anda. Lengkapi data di tab Armada.')) };
  }

  const KUNCI = `muatanku:cari:${profile.id}`;     // hasil terakhir, ditampilkan saat sinyal hilang
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const daftar = el('div', { class: 'dash-list' });
  const petaEl = el('div', { id: 'peta', class: 'peta', hidden: typeof L === 'undefined' });
  let peta = null;

  const btnGps = el('button', { type: 'button', class: 'btn btn--ghost dash-btn-sm' }, 'Pakai lokasi GPS saya');
  const btnSekitar = el('button', { type: 'button', class: 'btn btn--primary' }, 'Cari muatan sekitar');
  const btnBalik = el('button', { type: 'button', class: 'btn btn--primary' }, 'Cari muatan balik');
  const form = el('form', { class: 'dash-form', novalidate: true },
    lokasiField('sekarang', 'Lokasi sekarang'), btnGps,
    lokasiField('pulang', 'Kota pulang (untuk muatan balik)'),
    field('Radius pencarian (km)', numberInput('radius', { min: '5', max: '500', step: '5', value: '50' }), 'Muatan balik: tujuan boleh sampai 2x radius dari kota pulang.'),
    msg, el('div', { class: 'dash-actions' }, btnSekitar, btnBalik));

  const panel = el('div', { class: 'dash-grid' },
    el('section', { class: 'dash-card' }, el('h2', {}, 'Cari muatan'), form),
    el('section', { class: 'dash-card' }, el('h2', {}, 'Hasil'), petaEl, daftar));

  /* --- hasil terakhir (offline) --- */
  const simpan = (mode, hasil) => { try { localStorage.setItem(KUNCI, JSON.stringify({ waktu: new Date().toISOString(), mode, hasil })); } catch (e) { /* penyimpanan penuh/diblokir */ } };
  const ambil = () => { try { return JSON.parse(localStorage.getItem(KUNCI)); } catch (e) { return null; } };

  /* --- tampilan --- */
  function kartuHasil(m) {
    const jarak = m.jarakTujuanKm != null
      ? `Titik muat ${SearchEngine.formatKm(m.jarakAsalKm)} dari Anda, tujuan ${SearchEngine.formatKm(m.jarakTujuanKm)} dari kota pulang`
      : `${SearchEngine.formatKm(m.jarakKm)} dari Anda`;
    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, `${m.jenis}, ${m.berat_ton} ton`), badge(m.bisaTawar ? 'Cocok' : 'Tidak cocok', m.bisaTawar ? 'ok' : 'no')),
      el('p', {}, `${m.asal_nama} ke ${m.tujuan_nama}`),
      el('p', { class: 'dash-meta' }, `${jarak}`),
      el('p', { class: 'dash-meta' }, `Muat ${tanggal(m.jadwal_muat)}, ${m.jenis_unit}, tawaran customer ${rupiah(m.harga)}`),
      m.kompatibilitas.alasan.map((a) => el('p', { class: 'dash-meta' }, a)),
      el('button', {
        type: 'button', class: 'btn btn--primary dash-btn-sm', disabled: !m.bisaTawar,
        title: m.bisaTawar ? '' : m.kompatibilitas.alasan.join(' '), onclick: () => tawar(m),
      }, 'Tawar'));
  }

  function tampilkan(hasil, teks, tone = 'ok') {
    setMsg(msg, teks, tone);
    daftar.replaceChildren(...(hasil.length ? hasil.map(kartuHasil) : [kosong('Tidak ada muatan di radius ini.')]));
    if (peta) MapUI.tampilkanMuatan(peta, hasil, { onTawar: tawar });
  }

  /* --- menawar --- */
  async function tawar(m) {
    const armada = m.kompatibilitas.armadaCocok[0];
    const harga = await mintaAngka({ judul: `Tawar: ${m.jenis}, ${m.berat_ton} ton`, label: 'Harga tawaran Anda (Rp)', nilai: Math.round(m.harga) });
    if (harga === null) return;
    const r = await Transaksi.buatPenawaran({ muatan: m, armada, harga });
    setMsg(msg, r.ok ? 'Penawaran terkirim. Pantau statusnya di tab Pengiriman.' : r.message, r.ok ? 'ok' : 'error');
  }

  /* --- pencarian --- */
  btnGps.addEventListener('click', async () => {
    try {
      const p = await SearchEngine.ambilLokasiGPS();
      form.elements.sekarang_lat.value = p.lat.toFixed(6);
      form.elements.sekarang_lon.value = p.lon.toFixed(6);
      form.elements.sekarang_nama.value = 'Lokasi saat ini (GPS)';   // .value tidak memicu reset koordinat
      setMsg(msg, 'Lokasi GPS didapat.', 'ok');
    } catch (err) { setMsg(msg, err.message); }
  });

  async function jalankan(mode) {
    const d = Object.fromEntries(new FormData(form));
    if (!d.sekarang_lat) { setMsg(msg, 'Tentukan lokasi sekarang dulu (GPS, atau ketik lalu "Cari titik").'); return; }
    if (mode === 'balik' && !d.pulang_lat) { setMsg(msg, 'Tentukan kota pulang dulu.'); return; }
    const lokasi = { lat: d.sekarang_lat, lon: d.sekarang_lon };
    const kotaPulang = { lat: d.pulang_lat, lon: d.pulang_lon };
    const r = Math.max(5, Number(d.radius) || 50);

    setMsg(msg, 'Mencari...', 'ok');
    try {
      const [muatanList, armadaList] = await Promise.all([SearchEngine.ambilMuatanTerbuka(lokasi, r), SearchEngine.ambilArmadaSaya()]);
      const hasil = SearchEngine.cari({ mode, muatanList, armadaList, lokasi, kotaPulang, opsi: { radiusKm: r, radiusAsalKm: r, radiusTujuanKm: r * 2 } });
      simpan(mode, hasil);
      if (peta) MapUI.tandaiLokasi(peta, { lat: Number(d.sekarang_lat), lon: Number(d.sekarang_lon) });
      tampilkan(hasil, `${hasil.length} muatan ditemukan, diurutkan dari yang terdekat.`);
    } catch (err) {
      const t = ambil();
      if (t) tampilkan(t.hasil, `Tidak bisa memuat data baru. Menampilkan hasil pencarian terakhir (${waktuLokal(t.waktu)}).`, 'error');
      else setMsg(msg, pesanDb(err));
    }
  }
  btnSekitar.addEventListener('click', () => jalankan('sekitar'));
  btnBalik.addEventListener('click', () => jalankan('balik'));

  bus.muatanBaru = () => setMsg(msg, 'Ada muatan baru diposting. Tekan cari lagi untuk memperbarui hasil.', 'ok');

  function prosesPencarianAwal() {
    const params = new URLSearchParams(window.location.search);
    let sLat = params.get('sekarang_lat');
    let sLon = params.get('sekarang_lon');
    let sNama = params.get('sekarang_nama');
    let pLat = params.get('pulang_lat');
    let pLon = params.get('pulang_lon');
    let pNama = params.get('pulang_nama');
    let auto = params.get('auto') === '1' || params.get('mode') === 'balik';

    if (!sLat && !pLat) {
      try {
        const pending = sessionStorage.getItem('muatanku:pending_search');
        if (pending) {
          sessionStorage.removeItem('muatanku:pending_search');
          const p = JSON.parse(pending);
          sLat = p.sekarang_lat; sLon = p.sekarang_lon; sNama = p.sekarang_nama;
          pLat = p.pulang_lat; pLon = p.pulang_lon; pNama = p.pulang_nama;
          auto = true;
        }
      } catch (e) { /* abaikan */ }
    }

    if (sLat && sLon) {
      form.elements.sekarang_lat.value = sLat;
      form.elements.sekarang_lon.value = sLon;
      form.elements.sekarang_nama.value = sNama ? decodeURIComponent(sNama) : `${sLat}, ${sLon}`;
    }
    if (pLat && pLon) {
      form.elements.pulang_lat.value = pLat;
      form.elements.pulang_lon.value = pLon;
      form.elements.pulang_nama.value = pNama ? decodeURIComponent(pNama) : `${pLat}, ${pLon}`;
    }

    if (auto && sLat && pLat) {
      setTimeout(() => jalankan('balik'), 300);
      return true;
    }
    return false;
  }

  return {
    el: panel,
    setelahTampil() {
      if (typeof L !== 'undefined') peta = MapUI.init('peta');
      const sudahJalan = prosesPencarianAwal();
      if (!sudahJalan) {
        const t = ambil();
        if (t) tampilkan(t.hasil, `Hasil pencarian terakhir (${waktuLokal(t.waktu)}). Tekan cari untuk memperbarui.`);
      }
    },
    hancurkan() { if (peta) peta.remove(); peta = null; },
  };
}

/* =====================================================================
   TAB 2 - PENGIRIMAN: penawaran saya dan pembaruan status
   ===================================================================== */
function panelPengiriman({ bus }) {
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const daftarKirim = el('div', { class: 'dash-list' });
  const daftarTawar = el('div', { class: 'dash-list' });

  function kartuPengiriman(g) {
    const berikut = Transaksi.statusBerikutnya(g.status);
    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, `${g.muatan.jenis}, ${g.muatan.berat_ton} ton`), badge(Transaksi.LABEL_STATUS[g.status], g.status === 'selesai' ? 'ok' : 'wait')),
      el('p', {}, `${g.muatan.asal_nama} ke ${g.muatan.tujuan_nama}`),
      g.customer ? el('p', { class: 'dash-meta' }, 'Customer: ', g.customer.nama, g.customer.no_hp ? [', ', el('a', { href: `tel:${g.customer.no_hp}` }, g.customer.no_hp)] : null) : null,
      langkahStatus(g.status),
      berikut ? el('button', {
        type: 'button', class: 'btn btn--primary dash-btn-sm',
        onclick: async () => {
          const r = await Transaksi.ubahStatus(g.id, berikut);
          setMsg(msg, r.ok ? `Status: ${Transaksi.LABEL_STATUS[berikut]}.` : r.message, r.ok ? 'ok' : 'error');
          if (r.ok) muat();
        },
      }, Transaksi.LABEL_AKSI[berikut]) : null,
      detailRiwayat(g.id));
  }

  function kartuPenawaran(w) {
    const [label, tone] = STATUS_PENAWARAN[w.status] || STATUS_PENAWARAN.menunggu;
    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, w.muatan ? `${w.muatan.jenis}, ${w.muatan.berat_ton} ton` : 'Muatan'), badge(label, tone)),
      el('p', {}, w.muatan ? `${w.muatan.asal_nama} ke ${w.muatan.tujuan_nama}` : ''),
      el('p', { class: 'dash-meta' }, `Tawaran ${rupiah(w.harga)}, armada ${w.armada ? w.armada.plat_nomor : '-'}`),
      w.status === 'menunggu' ? el('button', {
        type: 'button', class: 'btn btn--ghost dash-btn-sm',
        onclick: async () => {
          if (!confirm('Tarik penawaran ini?')) return;
          const r = await Transaksi.tarikPenawaran(w.id);
          if (r.ok) muat(); else setMsg(msg, r.message);
        },
      }, 'Tarik penawaran') : null);
  }

  async function muat() {
    const [p, g] = await Promise.all([Transaksi.penawaranSaya(), Transaksi.pengirimanSaya()]);
    if (!p.ok || !g.ok) { setMsg(msg, (!p.ok ? p.message : g.message)); return; }
    daftarKirim.replaceChildren(...(g.data.length ? g.data.map(kartuPengiriman) : [kosong('Belum ada pengiriman. Muncul setelah customer memilih penawaran Anda.')]));
    const aktif = p.data.filter((w) => w.status !== 'dipilih');                 // yang dipilih sudah menjadi pengiriman
    daftarTawar.replaceChildren(...(aktif.length ? aktif.map(kartuPenawaran) : [kosong('Tidak ada penawaran lain.')]));
  }

  bus.segarkan = muat;
  muat();
  return { el: el('div', { class: 'dash-grid' },
    el('section', { class: 'dash-card' }, el('h2', {}, 'Pengiriman'), msg, daftarKirim),
    el('section', { class: 'dash-card' }, el('h2', {}, 'Penawaran saya'), daftarTawar)) };
}

/* =====================================================================
   TAB 3 - ARMADA (profil armada)
   ===================================================================== */
function panelArmada({ profile }) {
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const daftar = el('div', { class: 'dash-list' });

  const form = el('form', { class: 'dash-form' },
    field('Jenis unit', select('jenis_unit', JENIS_UNIT)),
    field('Plat nomor', input('plat_nomor', 'text', {
      required: true, autocapitalize: 'characters', placeholder: 'B 1234 XYZ',
      pattern: '[A-Za-z]{1,2} ?[0-9]{1,4} ?[A-Za-z]{0,3}', title: 'Contoh: B 1234 XYZ',
    })),
    field('Kapasitas maksimal (ton)', numberInput('kapasitas_ton', { min: '1', max: '100' })),
    dimensiFieldset('Dimensi bak (meter)'),
    msg,
    el('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Simpan armada'));

  async function muatDaftar() {
    const { data, error } = await supabaseClient.from('armada').select('*').order('created_at', { ascending: false });
    if (error) { daftar.replaceChildren(kosong(pesanDb(error))); return; }
    daftar.replaceChildren(...(data.length ? data.map(kartuArmada) : [kosong('Belum ada armada. Isi form untuk menambahkan unit pertama Anda.')]));
  }

  function kartuArmada(a) {
    const [label, tone] = STATUS_ARMADA[a.status_verifikasi] || STATUS_ARMADA.pending;
    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, a.plat_nomor), badge(label, tone)),
      el('p', {}, `${a.jenis_unit}, kapasitas ${a.kapasitas_ton} ton`),
      el('p', { class: 'dash-meta' }, `Bak ${a.panjang_m} x ${a.lebar_m} x ${a.tinggi_m} m`),
      el('button', {
        type: 'button', class: 'btn btn--ghost dash-btn-sm',
        onclick: async () => {
          if (!confirm(`Hapus armada ${a.plat_nomor}?`)) return;
          const { error } = await supabaseClient.from('armada').delete().eq('id', a.id);
          if (error) setMsg(msg, pesanDb(error)); else muatDaftar();
        },
      }, 'Hapus'));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; setMsg(msg, 'Menyimpan...', 'ok');
    const { error } = await supabaseClient.from('armada').insert({
      pengguna_id: profile.id,
      jenis_unit: d.jenis_unit,
      plat_nomor: normalisasiPlat(d.plat_nomor),
      kapasitas_ton: Number(d.kapasitas_ton),
      panjang_m: Number(d.panjang_m), lebar_m: Number(d.lebar_m), tinggi_m: Number(d.tinggi_m),
      status_verifikasi: 'pending', // wajib 'pending'; hanya admin yang bisa memverifikasi
    });
    btn.disabled = false;
    if (error) { setMsg(msg, pesanDb(error)); return; }
    form.reset(); setMsg(msg, 'Armada tersimpan dan menunggu verifikasi admin.', 'ok');
    muatDaftar();
  });

  muatDaftar();
  return { el: el('div', { class: 'dash-grid' },
    el('section', { class: 'dash-card' }, el('h2', {}, 'Tambah armada'), form),
    el('section', { class: 'dash-card' }, el('h2', {}, 'Armada Anda'), daftar)) };
}
