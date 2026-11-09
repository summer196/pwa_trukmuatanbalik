/* search-engine.js
   Logika pencarian muatan: Haversine, Mode Muatan Balik, dan Validasi Kompatibilitas.
   Fungsi-fungsinya murni (tanpa DOM), jadi mudah diuji. Dipakai di browser lewat objek global
   `SearchEngine`, dan di Node lewat require() untuk pengujian.
   Hanya ambilMuatanTerbuka() dan ambilArmadaSaya() yang butuh supabase-config.js. */

const SearchEngine = (() => {
  const R_BUMI_KM = 6371.0088;   // jari-jari rata-rata bumi
  const EPS = 1e-9;              // toleransi pembulatan desimal

  const rad = (d) => (d * Math.PI) / 180;
  const angka = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const titik = (p) => ({ lat: angka(p && p.lat), lon: angka(p && p.lon) });
  const titikValid = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
  const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

  /* ---------- 1. Haversine ---------- */
  /** Jarak garis lurus (km) antara dua koordinat. NaN jika ada koordinat yang tidak valid. */
  function haversineKm(lat1, lon1, lat2, lon2) {
    const a = titik({ lat: lat1, lon: lon1 });
    const b = titik({ lat: lat2, lon: lon2 });
    if (!titikValid(a) || !titikValid(b)) return NaN;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R_BUMI_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  const jarak = (p, lat, lon) => haversineKm(p.lat, p.lon, lat, lon);
  const formatKm = (km) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(km)} km`;

  /** Muatan terbuka dalam radius dari lokasi sopir, diurutkan dari jarak asal terdekat. */
  function cariMuatanTerdekat(muatanList, lokasi, { radiusKm = 50 } = {}) {
    const p = titik(lokasi);
    if (!titikValid(p)) throw new Error('Lokasi sopir tidak valid.');
    return muatanList
      .filter((m) => m.status === 'terbuka')
      .map((m) => ({ ...m, jarakKm: jarak(p, m.asal_lat, m.asal_lon) }))
      .filter((m) => Number.isFinite(m.jarakKm) && m.jarakKm <= radiusKm)
      .sort((a, b) => a.jarakKm - b.jarakKm);
  }

  /* ---------- 2. Mode Muatan Balik ---------- */
  /** Muatan yang ASALNYA dekat lokasi sekarang dan TUJUANNYA dekat kota pulang.
      Urutan: total (jarak ke titik muat + jarak tujuan ke kota pulang) paling kecil lebih dulu,
      yaitu muatan yang paling sedikit membuat sopir menyimpang. */
  function cariMuatanBalik(muatanList, lokasiSekarang, kotaPulang, { radiusAsalKm = 50, radiusTujuanKm = 100 } = {}) {
    const dari = titik(lokasiSekarang);
    const pulang = titik(kotaPulang);
    if (!titikValid(dari)) throw new Error('Lokasi sekarang tidak valid.');
    if (!titikValid(pulang)) throw new Error('Kota pulang tidak valid.');
    return muatanList
      .filter((m) => m.status === 'terbuka')
      .map((m) => {
        const jarakAsalKm = jarak(dari, m.asal_lat, m.asal_lon);
        const jarakTujuanKm = jarak(pulang, m.tujuan_lat, m.tujuan_lon);
        return { ...m, jarakKm: jarakAsalKm, jarakAsalKm, jarakTujuanKm, skorKm: jarakAsalKm + jarakTujuanKm };
      })
      .filter((m) => Number.isFinite(m.skorKm) && m.jarakAsalKm <= radiusAsalKm && m.jarakTujuanKm <= radiusTujuanKm)
      .sort((a, b) => a.skorKm - b.skorKm);
  }

  /* ---------- 3. Validasi Kompatibilitas ---------- */
  /** Cocokkan satu muatan dengan satu armada: berat, dimensi, dan jenis unit.
      Dimensi: lantai muatan boleh diputar 90 derajat; tinggi tidak boleh melebihi tinggi bak. */
  function cekKompatibilitas(muatan, armada) {
    const [berat, mp, ml, mt] = [muatan.berat_ton, muatan.panjang_m, muatan.lebar_m, muatan.tinggi_m].map(angka);
    const [kap, bp, bl, bt] = [armada.kapasitas_ton, armada.panjang_m, armada.lebar_m, armada.tinggi_m].map(angka);
    if (![berat, mp, ml, mt, kap, bp, bl, bt].every(Number.isFinite)) {
      return { cocok: false, alasan: ['Data berat atau dimensi tidak lengkap.'], cek: { berat: false, dimensi: false, unit: false } };
    }
    const beratOk = berat <= kap + EPS;
    const unitOk = norm(muatan.jenis_unit) === norm(armada.jenis_unit);
    const lantaiOk = (mp <= bp + EPS && ml <= bl + EPS) || (ml <= bp + EPS && mp <= bl + EPS);
    const tinggiOk = mt <= bt + EPS;

    const alasan = [];
    if (!beratOk) alasan.push(`Berat muatan ${berat} ton melebihi kapasitas armada ${kap} ton.`);
    if (!unitOk) alasan.push(`Muatan butuh ${muatan.jenis_unit}, sedangkan armada Anda ${armada.jenis_unit}.`);
    if (!lantaiOk) alasan.push(`Ukuran lantai muatan ${mp} x ${ml} m tidak muat di bak ${bp} x ${bl} m.`);
    if (!tinggiOk) alasan.push(`Tinggi muatan ${mt} m melebihi tinggi bak ${bt} m.`);
    return { cocok: alasan.length === 0, alasan, cek: { berat: beratOk, dimensi: lantaiOk && tinggiOk, unit: unitOk } };
  }

  /** Cocokkan muatan dengan SEMUA armada sopir. Hanya armada terverifikasi yang dihitung.
      Cocok jika minimal satu armada cocok. Jika tidak ada, alasan diambil dari armada yang paling mendekati. */
  function cekKompatibilitasSopir(muatan, armadaList) {
    const terverifikasi = (armadaList || []).filter((a) => a.status_verifikasi === 'verified');
    if (!terverifikasi.length) {
      return { cocok: false, alasan: ['Belum ada armada terverifikasi. Tunggu verifikasi admin.'], armadaCocok: [], cek: { berat: false, dimensi: false, unit: false } };
    }
    const hasil = terverifikasi.map((a) => ({ armada: a, ...cekKompatibilitas(muatan, a) }));
    const cocok = hasil.filter((h) => h.cocok);
    if (cocok.length) return { cocok: true, alasan: [], armadaCocok: cocok.map((h) => h.armada), cek: cocok[0].cek };
    const terdekat = hasil.reduce((a, b) => (b.alasan.length < a.alasan.length ? b : a));
    return { cocok: false, alasan: terdekat.alasan, armadaCocok: [], cek: terdekat.cek };
  }

  /** Tambahkan hasil validasi ke tiap muatan. Muatan tidak cocok TETAP ditampilkan, tapi bisaTawar = false
      (UI: tombol Tawar dinonaktifkan dan alasan ditampilkan). Urutan hasil pencarian tidak berubah. */
  function tandaiKompatibilitas(daftarMuatan, armadaList) {
    return daftarMuatan.map((m) => {
      const k = cekKompatibilitasSopir(m, armadaList);
      return { ...m, kompatibilitas: k, bisaTawar: k.cocok };
    });
  }

  /* ---------- Pintu masuk tunggal: cari + tandai ---------- */
  /** mode 'sekitar' (default) atau 'balik'. opsi: { radiusKm, radiusAsalKm, radiusTujuanKm } */
  function cari({ mode = 'sekitar', muatanList, armadaList, lokasi, kotaPulang, opsi = {} }) {
    const hasil = mode === 'balik'
      ? cariMuatanBalik(muatanList, lokasi, kotaPulang, opsi)
      : cariMuatanTerdekat(muatanList, lokasi, opsi);
    return tandaiKompatibilitas(hasil, armadaList);
  }

  /* ---------- Pengambilan data (butuh supabaseClient) ---------- */
  /** Kotak lintang/bujur kasar di sekitar titik, agar database menyaring dulu sebelum Haversine. */
  function kotakBatas(lat, lon, radiusKm) {
    const dLat = radiusKm / 111.32;
    const dLon = radiusKm / (111.32 * Math.max(Math.cos(rad(lat)), 0.01));
    return { latMin: lat - dLat, latMax: lat + dLat, lonMin: lon - dLon, lonMax: lon + dLon };
  }

  /** Muatan terbuka. Jika pusat diberikan, hanya yang asalnya di dalam kotak radius (hemat data). */
  async function ambilMuatanTerbuka(pusat, radiusKm = 50) {
    let q = supabaseClient.from('muatan').select('*').eq('status', 'terbuka');
    const p = titik(pusat);
    if (titikValid(p)) {
      const k = kotakBatas(p.lat, p.lon, radiusKm);
      q = q.gte('asal_lat', k.latMin).lte('asal_lat', k.latMax).gte('asal_lon', k.lonMin).lte('asal_lon', k.lonMax);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async function ambilArmadaSaya() {
    const { data, error } = await supabaseClient.from('armada').select('*');
    if (error) throw error;
    return data;
  }

  /** Lokasi GPS perangkat -> { lat, lon }. */
  function ambilLokasiGPS() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Perangkat tidak mendukung GPS.')); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => reject(new Error('Lokasi tidak bisa diakses. Izinkan akses lokasi atau ketik manual.')),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
  }

  return {
    haversineKm, formatKm, kotakBatas,
    cariMuatanTerdekat, cariMuatanBalik,
    cekKompatibilitas, cekKompatibilitasSopir, tandaiKompatibilitas,
    cari, ambilMuatanTerbuka, ambilArmadaSaya, ambilLokasiGPS,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SearchEngine;
