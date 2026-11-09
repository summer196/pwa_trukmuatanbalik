/* admin-cari-muatan.js
   Modul pencarian muatan balik dan muatan sekitar untuk admin.
   Bergantung pada: supabase-config.js, auth.js, dashboard.js, search-engine.js, map.js */

function mountAdminCariMuatan(root, ctx) {
  const wadah = el('div', { class: 'admin-module dash-grid' });
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const daftarEl = el('div', { class: 'dash-list' });
  const petaEl = el('div', { id: 'admin-peta', class: 'peta', hidden: typeof L === 'undefined' });
  let peta = null;

  const btnGps = el('button', { type: 'button', class: 'btn btn--ghost dash-btn-sm' }, 'Pakai lokasi GPS saya');
  const btnSekitar = el('button', { type: 'button', class: 'btn btn--primary' }, 'Cari Muatan Sekitar');
  const btnBalik = el('button', { type: 'button', class: 'btn btn--primary' }, 'Cari Muatan Balik');

  const form = el('form', { class: 'dash-form', novalidate: true },
    lokasiField('sekarang', 'Lokasi sekarang'),
    btnGps,
    lokasiField('pulang', 'Kota pulang (untuk muatan balik)'),
    field('Radius pencarian (km)', numberInput('radius', { min: '5', max: '500', step: '5', value: '50' }), 'Muatan balik: tujuan boleh sampai 2x radius dari kota pulang.'),
    msg,
    el('div', { class: 'dash-actions' }, btnSekitar, btnBalik));

  const formCard = el('section', { class: 'dash-card' },
    el('h2', {}, 'Pencarian Muatan (Akses Admin)'),
    el('p', { class: 'dash-meta', style: 'margin-bottom:14px' }, 'Uji pencarian muatan langsung dari akun admin tanpa perlu berpindah ke akun sopir.'),
    form);

  const hasilCard = el('section', { class: 'dash-card' },
    el('h2', {}, 'Hasil Pencarian'),
    petaEl,
    daftarEl);

  wadah.append(formCard, hasilCard);
  root.replaceChildren(wadah);

  btnGps.addEventListener('click', async () => {
    try {
      const p = await SearchEngine.ambilLokasiGPS();
      form.elements.sekarang_lat.value = p.lat.toFixed(6);
      form.elements.sekarang_lon.value = p.lon.toFixed(6);
      form.elements.sekarang_nama.value = 'Lokasi saat ini (GPS)';
      setMsg(msg, 'Lokasi GPS berhasil didapatkan.', 'ok');
    } catch (err) {
      setMsg(msg, err.message);
    }
  });

  function kartuHasil(m) {
    const jarak = m.jarakTujuanKm != null
      ? `Titik muat ${SearchEngine.formatKm(m.jarakAsalKm)} dari Anda, tujuan ${SearchEngine.formatKm(m.jarakTujuanKm)} dari kota pulang`
      : `${SearchEngine.formatKm(m.jarakKm)} dari Anda`;

    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' },
        el('strong', {}, `${m.jenis}, ${m.berat_ton} ton`),
        badge('Terbuka', 'ok')),
      el('p', {}, `${m.asal_nama} ke ${m.tujuan_nama}`),
      el('p', { class: 'dash-meta' }, jarak),
      el('p', { class: 'dash-meta' }, `Jadwal: ${tanggal(m.jadwal_muat)}, Unit: ${m.jenis_unit}, Tawaran: ${rupiah(m.harga)}`),
      el('p', { class: 'dash-meta' }, `Dimensi: ${m.panjang_m} x ${m.lebar_m} x ${m.tinggi_m} m`));
  }

  function tampilkan(hasil, teks, tone = 'ok') {
    setMsg(msg, teks, tone);
    daftarEl.replaceChildren(...(hasil.length ? hasil.map(kartuHasil) : [kosong('Tidak ada muatan terbuka pada radius ini.')]));
    if (peta) MapUI.tampilkanMuatan(peta, hasil);
  }

  async function jalankan(mode) {
    const d = Object.fromEntries(new FormData(form));
    if (!d.sekarang_lat) {
      setMsg(msg, 'Tentukan lokasi sekarang terlebih dahulu (bisa pakai GPS, ketik lalu Cari titik, atau Pilih di Peta).');
      return;
    }
    if (mode === 'balik' && !d.pulang_lat) {
      setMsg(msg, 'Tentukan kota pulang terlebih dahulu untuk mode muatan balik.');
      return;
    }

    const lokasi = { lat: d.sekarang_lat, lon: d.sekarang_lon };
    const kotaPulang = { lat: d.pulang_lat, lon: d.pulang_lon };
    const r = Math.max(5, Number(d.radius) || 50);

    setMsg(msg, 'Mencari muatan terbuka...', 'ok');
    try {
      const muatanList = await SearchEngine.ambilMuatanTerbuka(lokasi, r);
      let hasil = [];
      if (mode === 'balik') {
        hasil = SearchEngine.cariMuatanBalik(muatanList, lokasi, kotaPulang, { radiusAsalKm: r, radiusTujuanKm: r * 2 });
      } else {
        hasil = SearchEngine.cariMuatanTerdekat(muatanList, lokasi, { radiusKm: r });
      }

      if (peta) MapUI.tandaiLokasi(peta, { lat: Number(d.sekarang_lat), lon: Number(d.sekarang_lon) }, 'Titik Pencarian');
      tampilkan(hasil, `${hasil.length} muatan terbuka ditemukan.`);
    } catch (err) {
      setMsg(msg, pesanDb(err));
    }
  }

  btnSekitar.addEventListener('click', () => jalankan('sekitar'));
  btnBalik.addEventListener('click', () => jalankan('balik'));

  // Inisialisasi Peta
  if (typeof L !== 'undefined') {
    peta = MapUI.init('admin-peta');
    MapUI.perbaruiUkuran(peta);
  }

  // Cek apakah ada parameter pencarian yang diteruskan dari halaman utama
  const params = new URLSearchParams(window.location.search);
  const sLat = params.get('sekarang_lat');
  const sLon = params.get('sekarang_lon');
  const sNama = params.get('sekarang_nama');
  const pLat = params.get('pulang_lat');
  const pLon = params.get('pulang_lon');
  const pNama = params.get('pulang_nama');
  const auto = params.get('auto') === '1' || params.get('mode') === 'balik';

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

  if (auto && sLat) {
    setTimeout(() => jalankan(pLat ? 'balik' : 'sekitar'), 300);
  }
}
