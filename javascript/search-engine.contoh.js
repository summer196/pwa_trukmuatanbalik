/* search-engine.contoh.js
   CONTOH cara memanggil SearchEngine dari UI. File ini TIDAK dimuat di halaman mana pun;
   salin pola ini ke driver-dashboard.js saat siap dipasang.
   Butuh: dashboard.js (el, field, lokasiField, badge, setMsg), search-engine.js */

async function contohPencarianSopir(root) {
  const armadaList = await SearchEngine.ambilArmadaSaya();   // armada milik sopir yang login
  const hasilEl = el('div', { class: 'dash-list' });
  const msg = el('p', { class: 'dash-msg', role: 'status' });

  const btnGps = el('button', { type: 'button', class: 'btn btn--ghost dash-btn-sm' }, 'Pakai lokasi GPS saya');
  const btnSekitar = el('button', { type: 'button', class: 'btn btn--primary' }, 'Cari muatan sekitar');
  const btnBalik = el('button', { type: 'button', class: 'btn btn--primary' }, 'Cari muatan balik');
  const form = el('form', { class: 'dash-form', novalidate: true },
    lokasiField('sekarang', 'Lokasi sekarang'), btnGps,
    lokasiField('pulang', 'Kota pulang (hanya untuk muatan balik)'),
    msg, btnSekitar, btnBalik);

  root.replaceChildren(el('div', { class: 'dash-grid' },
    el('section', { class: 'dash-card' }, el('h2', {}, 'Cari muatan'), form),
    el('section', { class: 'dash-card' }, el('h2', {}, 'Hasil'), hasilEl)));

  // GPS mengisi koordinat "lokasi sekarang" (isi kolom lewat .value tidak memicu reset koordinat)
  btnGps.addEventListener('click', async () => {
    try {
      const p = await SearchEngine.ambilLokasiGPS();
      form.elements.sekarang_lat.value = p.lat.toFixed(6);
      form.elements.sekarang_lon.value = p.lon.toFixed(6);
      form.elements.sekarang_nama.value = 'Lokasi saat ini (GPS)';
      setMsg(msg, 'Lokasi GPS didapat.', 'ok');
    } catch (err) { setMsg(msg, err.message); }
  });

  async function jalankan(mode) {
    const d = Object.fromEntries(new FormData(form));
    if (!d.sekarang_lat) { setMsg(msg, 'Tentukan lokasi sekarang dulu.'); return; }
    if (mode === 'balik' && !d.pulang_lat) { setMsg(msg, 'Tentukan kota pulang dulu.'); return; }
    const lokasi = { lat: d.sekarang_lat, lon: d.sekarang_lon };
    const kotaPulang = { lat: d.pulang_lat, lon: d.pulang_lon };
    const opsi = { radiusKm: 50, radiusAsalKm: 50, radiusTujuanKm: 100 };

    setMsg(msg, 'Mencari...', 'ok');
    try {
      const muatanList = await SearchEngine.ambilMuatanTerbuka(lokasi, opsi.radiusKm);
      const hasil = SearchEngine.cari({ mode, muatanList, armadaList, lokasi, kotaPulang, opsi });
      setMsg(msg, `${hasil.length} muatan ditemukan.`, 'ok');
      hasilEl.replaceChildren(...(hasil.length ? hasil.map(kartuHasil) : [el('p', { class: 'dash-empty' }, 'Tidak ada muatan di radius ini.')]));
    } catch (err) { setMsg(msg, err.message); }
  }
  btnSekitar.addEventListener('click', () => jalankan('sekitar'));
  btnBalik.addEventListener('click', () => jalankan('balik'));
}

function kartuHasil(m) {
  const jarakTeks = m.jarakTujuanKm != null
    ? `Titik muat ${SearchEngine.formatKm(m.jarakAsalKm)} dari Anda, tujuan ${SearchEngine.formatKm(m.jarakTujuanKm)} dari kota pulang`
    : `${SearchEngine.formatKm(m.jarakKm)} dari Anda`;
  return el('article', { class: 'dash-item' },
    el('div', { class: 'dash-item__head' },
      el('strong', {}, `${m.jenis}, ${m.berat_ton} ton`),
      badge(m.bisaTawar ? 'Cocok' : 'Tidak cocok', m.bisaTawar ? 'ok' : 'no')),
    el('p', {}, `${m.asal_nama} ke ${m.tujuan_nama}`),
    el('p', { class: 'dash-meta' }, jarakTeks),
    m.kompatibilitas.alasan.map((a) => el('p', { class: 'dash-meta' }, a)),   // alasan tidak cocok
    el('button', {
      type: 'button', class: 'btn btn--primary dash-btn-sm',
      disabled: !m.bisaTawar,                                                  // tombol Tawar nonaktif jika tidak cocok
      title: m.bisaTawar ? '' : m.kompatibilitas.alasan.join(' '),
      onclick: () => alert('Penawaran dibuat di langkah berikutnya.'),
    }, 'Tawar'));
}
