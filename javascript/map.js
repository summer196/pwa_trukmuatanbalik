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

  /**
   * Modal dialog interaktif untuk memilih titik lokasi di peta dengan Leaflet.
   * Parameter:
   * - judul: string (mis. "Pilih Lokasi Asal")
   * - lat, lon: number | null (koordinat awal jika sudah ada)
   * - namaAwal: string (nama lokasi awal jika ada)
   * - onPilih: function({ lat, lon, nama })
   */
  function bukaModalPilihTitik({ judul = 'Pilih Titik di Peta', lat = null, lon = null, namaAwal = '', onPilih } = {}) {
    let dialog = document.getElementById('modal-pilih-peta');
    if (!dialog) {
      dialog = buat('dialog', null, 'peta-modal');
      dialog.id = 'modal-pilih-peta';
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = '';

    const box = buat('div', null, 'peta-modal__box');

    // Header
    const head = buat('div', null, 'peta-modal__head');
    const h3 = buat('h3', judul);
    const closeBtn = buat('button', '×', 'peta-modal__close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Tutup');
    head.append(h3, closeBtn);

    // Search bar di dalam peta (opsi cari cepat agar bisa langsung melompat ke kota/area)
    const searchBar = buat('div', null, 'peta-modal__search');
    const searchInput = buat('input', null, 'peta-modal__search-input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Ketik kota / jalan untuk melompat ke area...';
    if (namaAwal) searchInput.value = namaAwal;
    const searchBtn = buat('button', 'Cari', 'btn btn--ghost dash-btn-sm');
    searchBtn.type = 'button';
    const gpsBtn = buat('button', 'Lokasi Saya', 'btn btn--ghost dash-btn-sm');
    gpsBtn.type = 'button';
    searchBar.append(searchInput, searchBtn, gpsBtn);

    // Wadah Peta
    const mapContainer = buat('div', null, 'peta-modal__map');
    const mapId = 'map-picker-' + Date.now();
    mapContainer.id = mapId;

    // Hint & preview info
    const infoBox = buat('div', null, 'peta-modal__info');
    const hintText = buat('p', 'Klik pada peta atau geser pin untuk menentukan titik presisi.', 'peta-modal__hint');
    const addrText = buat('p', namaAwal || 'Belum ada titik yang dipilih.', 'peta-modal__addr');
    const validLatLon = (lat != null && lon != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)));
    const coordText = buat('small', validLatLon ? `Koordinat: ${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}` : '', 'peta-modal__coord');
    infoBox.append(hintText, addrText, coordText);

    // Footer actions
    const foot = buat('div', null, 'peta-modal__foot');
    const cancelBtn = buat('button', 'Batal', 'btn btn--ghost');
    cancelBtn.type = 'button';
    const confirmBtn = buat('button', 'Gunakan Titik Ini', 'btn btn--primary');
    confirmBtn.type = 'button';
    confirmBtn.disabled = !validLatLon;
    foot.append(cancelBtn, confirmBtn);

    box.append(head, searchBar, mapContainer, infoBox, foot);
    dialog.appendChild(box);

    dialog.showModal();

    // Inisialisasi peta Leaflet
    const defaultCenter = validLatLon ? [Number(lat), Number(lon)] : [-6.2088, 106.8456];
    const defaultZoom = validLatLon ? 15 : 9;

    const pickerMap = L.map(mapId).setView(defaultCenter, defaultZoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(pickerMap);

    let marker = null;
    let selectedPoint = validLatLon ? { lat: Number(lat), lon: Number(lon), nama: namaAwal } : null;

    function pasangEventMarker(m) {
      m.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        updateSelection(+pos.lat.toFixed(6), +pos.lng.toFixed(6));
      });
    }

    if (selectedPoint) {
      marker = L.marker([selectedPoint.lat, selectedPoint.lon], { draggable: true }).addTo(pickerMap);
      pasangEventMarker(marker);
    }

    perbaruiUkuran(pickerMap);

    let reverseTimer = null;
    function updateSelection(newLat, newLon, customName = null) {
      selectedPoint = { lat: newLat, lon: newLon, nama: customName || '' };
      coordText.textContent = `Koordinat: ${newLat.toFixed(6)}, ${newLon.toFixed(6)}`;
      confirmBtn.disabled = false;

      if (!customName) {
        addrText.textContent = 'Mencari alamat detail...';
        clearTimeout(reverseTimer);
        reverseTimer = setTimeout(() => {
          namaDariTitik(newLat, newLon).then((name) => {
            selectedPoint.nama = name;
            addrText.textContent = name;
          }).catch(() => {
            selectedPoint.nama = `${newLat.toFixed(6)}, ${newLon.toFixed(6)}`;
            addrText.textContent = selectedPoint.nama;
          });
        }, 200);
      } else {
        addrText.textContent = customName;
      }
    }

    // Klik pada peta untuk pindahkan marker
    pickerMap.on('click', (e) => {
      const clickLat = +e.latlng.lat.toFixed(6);
      const clickLon = +e.latlng.lng.toFixed(6);
      if (marker) {
        marker.setLatLng([clickLat, clickLon]);
      } else {
        marker = L.marker([clickLat, clickLon], { draggable: true }).addTo(pickerMap);
        pasangEventMarker(marker);
      }
      updateSelection(clickLat, clickLon);
    });

    // Tombol cari di modal
    async function cariLokasiModal() {
      const q = searchInput.value.trim();
      if (!q) return;
      searchBtn.disabled = true;
      searchBtn.textContent = '...';
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(q)}`;
        const [hit] = await (await fetch(url)).json();
        if (hit) {
          const hitLat = +Number(hit.lat).toFixed(6);
          const hitLon = +Number(hit.lon).toFixed(6);
          pickerMap.setView([hitLat, hitLon], 14);
          if (marker) {
            marker.setLatLng([hitLat, hitLon]);
          } else {
            marker = L.marker([hitLat, hitLon], { draggable: true }).addTo(pickerMap);
            pasangEventMarker(marker);
          }
          updateSelection(hitLat, hitLon, hit.display_name);
        } else {
          alert('Lokasi tidak ditemukan. Coba tambahkan nama kota.');
        }
      } catch (err) {
        alert('Gagal mencari lokasi. Periksa koneksi internet.');
      } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Cari';
      }
    }

    searchBtn.addEventListener('click', cariLokasiModal);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        cariLokasiModal();
      }
    });

    // Tombol GPS
    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('GPS tidak didukung perangkat ini.');
        return;
      }
      gpsBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsBtn.disabled = false;
          const myLat = +pos.coords.latitude.toFixed(6);
          const myLon = +pos.coords.longitude.toFixed(6);
          pickerMap.setView([myLat, myLon], 15);
          if (marker) {
            marker.setLatLng([myLat, myLon]);
          } else {
            marker = L.marker([myLat, myLon], { draggable: true }).addTo(pickerMap);
            pasangEventMarker(marker);
          }
          updateSelection(myLat, myLon);
        },
        () => {
          gpsBtn.disabled = false;
          alert('Gagal mengambil lokasi GPS. Pastikan izin lokasi browser aktif.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

    function tutup() {
      pickerMap.remove();
      dialog.close();
    }

    closeBtn.addEventListener('click', tutup);
    cancelBtn.addEventListener('click', tutup);

    confirmBtn.addEventListener('click', () => {
      if (selectedPoint && onPilih) {
        onPilih(selectedPoint);
      }
      tutup();
    });
  }

  return { init, tampilkanMuatan, tandaiLokasi, pilihTitik, namaDariTitik, perbaruiUkuran, bukaModalPilihTitik };
})();
