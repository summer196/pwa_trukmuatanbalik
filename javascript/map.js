/* map.js - helper Leaflet + OpenStreetMap untuk Muatanku.

   PANDUAN INTEGRASI (4 langkah)
   1) Di <head> halaman (mis. html/dashboard.html), SEBELUM stylesheet dasbor:
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"
              integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
      Di akhir <body>, SEBELUM file ini:
        <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"
                integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
        <script src="../javascript/map.js"></script>
   2) Siapkan wadah BERTINGGI di HTML:  <div id="peta" class="peta"></div>   (kelas .peta ada di css/dashboard.css)
   3) Buat peta dan tampilkan hasil pencarian:
        const peta = MapUI.init('peta');
        MapUI.tampilkanMuatan(peta, hasilPencarian, { onTawar: (m) => contohTawar(m, msg) });
   4) Untuk memilih titik di form posting muatan:
        MapUI.pilihTitik(peta, ({ lat, lon }) => { form.elements.asal_lat.value = lat; form.elements.asal_lon.value = lon; });
   Jika peta ada di tab/modal yang awalnya tersembunyi, panggil MapUI.perbaruiUkuran(peta) saat ditampilkan.
   Butuh: Leaflet (global `L`) dimuat sebelum file ini. */

const MapUI = (() => {
  const PUSAT_INDONESIA = [-2.5, 118];
  const WARNA = { cocok: '#1565d8', tidakCocok: '#8a97ab', saya: '#067647' };
  const buat = (tag, teks, kelas) => { const n = document.createElement(tag); if (teks != null) n.textContent = teks; if (kelas) n.className = kelas; return n; };

  /** Buat peta di elemen ber-id `idElemen` (elemen WAJIB punya tinggi, lihat .peta di dashboard.css). */
  function init(idElemen, { pusat = PUSAT_INDONESIA, zoom = 5 } = {}) {
    const peta = L.map(idElemen).setView(pusat, zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true,   // tile dimuat dengan CORS agar service worker bisa menyimpannya (bukan respons opaque)
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',   // atribusi wajib
    }).addTo(peta);
    peta._muatan = L.layerGroup().addTo(peta);
    return peta;
  }

  /** Gambar hasil pencarian: titik di lokasi muat, garis putus-putus ke tujuan, popup berisi ringkasan dan tombol Tawar. */
  function tampilkanMuatan(peta, hasil, { onTawar } = {}) {
    peta._muatan.clearLayers();
    const titik = [];
    hasil.forEach((m) => {
      const asal = [Number(m.asal_lat), Number(m.asal_lon)];
      const tujuan = [Number(m.tujuan_lat), Number(m.tujuan_lon)];
      const warna = m.bisaTawar ? WARNA.cocok : WARNA.tidakCocok;
      L.polyline([asal, tujuan], { color: warna, weight: 2, opacity: 0.5, dashArray: '6 6' }).addTo(peta._muatan);
      L.circleMarker(asal, { radius: 9, color: '#fff', weight: 2, fillColor: warna, fillOpacity: 1 })
        .bindPopup(() => popupMuatan(m, onTawar)).addTo(peta._muatan);
      L.circleMarker(tujuan, { radius: 5, color: warna, weight: 2, fillColor: '#fff', fillOpacity: 1 }).addTo(peta._muatan);
      titik.push(asal, tujuan);
    });
    if (titik.length) peta.fitBounds(L.latLngBounds(titik), { padding: [30, 30], maxZoom: 12 });
  }

  function popupMuatan(m, onTawar) {           // elemen DOM + textContent: aman dari XSS
    const kotak = buat('div', null, 'peta-popup');
    kotak.append(buat('strong', `${m.jenis}, ${m.berat_ton} ton`), buat('div', `${m.asal_nama} ke ${m.tujuan_nama}`));
    if (m.jarakKm != null) kotak.append(buat('div', `${Math.round(m.jarakKm * 10) / 10} km dari lokasi Anda`));
    (m.kompatibilitas ? m.kompatibilitas.alasan : []).forEach((a) => kotak.append(buat('div', a, 'peta-popup__alasan')));
    const tombol = buat('button', 'Tawar', 'btn btn--primary dash-btn-sm');
    tombol.type = 'button'; tombol.disabled = !m.bisaTawar;
    tombol.addEventListener('click', () => onTawar && onTawar(m));
    kotak.append(tombol);
    return kotak;
  }

  function tandaiLokasi(peta, { lat, lon }, label = 'Lokasi Anda') {
    return L.circleMarker([lat, lon], { radius: 8, color: '#fff', weight: 2, fillColor: WARNA.saya, fillOpacity: 1 })
      .bindTooltip(label).addTo(peta);
  }

  /** Klik peta untuk memilih titik (misalnya asal/tujuan di form posting). Mengembalikan fungsi untuk berhenti. */
  function pilihTitik(peta, onPilih) {
    let pin = null;
    const klik = (e) => {
      if (pin) pin.setLatLng(e.latlng); else pin = L.marker(e.latlng).addTo(peta);
      onPilih({ lat: +e.latlng.lat.toFixed(6), lon: +e.latlng.lng.toFixed(6) });
    };
    peta.on('click', klik);
    return () => { peta.off('click', klik); if (pin) peta.removeLayer(pin); };
  }

  /** Nama tempat dari titik (Nominatim reverse). Panggil hanya atas aksi pengguna, bukan otomatis saat peta bergerak. */
  async function namaDariTitik(lat, lon) {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=id&lat=${lat}&lon=${lon}`);
    const d = await r.json();
    return d.display_name || `${lat}, ${lon}`;
  }

  /** Panggil saat wadah peta baru terlihat (tab/modal), agar ukuran dihitung ulang. */
  const perbaruiUkuran = (peta) => setTimeout(() => peta.invalidateSize(), 50);

  return { init, tampilkanMuatan, tandaiLokasi, pilihTitik, namaDariTitik, perbaruiUkuran };
})();
