/* search-engine.test.js - uji logika SearchEngine. Jalankan: node javascript/search-engine.test.js
   Tabel kasus uji (cocok dan tidak cocok) bisa langsung dipakai sebagai bahan laporan pengujian. */
const assert = require('assert');
const SE = require('./search-engine.js');

/* ----- 1. Akurasi Haversine (bandingkan kolom "garis lurus" dengan jarak garis lurus di Google Maps/OSM) ----- */
const kota = {
  'Jakarta - Bandung':   [-6.2088, 106.8456, -6.9175, 107.6191],
  'Jakarta - Semarang':  [-6.2088, 106.8456, -6.9667, 110.4167],
  'Jakarta - Surabaya':  [-6.2088, 106.8456, -7.2575, 112.7521],
  'Bogor - Depok':       [-6.5950, 106.8166, -6.4025, 106.7942],
};
console.log('\nHaversine');
console.table(Object.entries(kota).map(([n, c]) => ({ rute: n, 'garis lurus (km)': +SE.haversineKm(...c).toFixed(1) })));
assert.strictEqual(SE.haversineKm(-6.2, 106.8, -6.2, 106.8), 0);
assert.ok(Math.abs(SE.haversineKm(...kota['Jakarta - Surabaya']) - 662) < 5);
assert.ok(Number.isNaN(SE.haversineKm(100, 0, 0, 0)));                    // lintang tidak valid
assert.strictEqual(SE.haversineKm(...kota['Jakarta - Bandung']), SE.haversineKm(kota['Jakarta - Bandung'][2], kota['Jakarta - Bandung'][3], kota['Jakarta - Bandung'][0], kota['Jakarta - Bandung'][1]));

/* ----- 2. Kompatibilitas: tabel kasus uji ----- */
const armada = { jenis_unit: 'Tronton Bak', kapasitas_ton: 25, panjang_m: 9, lebar_m: 2.4, tinggi_m: 2.5, status_verifikasi: 'verified' };
const muatan = { jenis_unit: 'Tronton Bak', berat_ton: 20, panjang_m: 6, lebar_m: 2, tinggi_m: 2 };
const kasus = [
  ['K1 semua sesuai',                    {},                                    armada, true],
  ['K2 berat tepat = kapasitas (batas)', { berat_ton: 25 },                     armada, true],
  ['K3 berat melebihi kapasitas',        { berat_ton: 25.1 },                   armada, false],
  ['K4 jenis unit berbeda',              { jenis_unit: 'Lowbed' },              armada, false],
  ['K5 panjang melebihi bak',            { panjang_m: 9.5 },                    armada, false],
  ['K6 lebar melebihi (2 sisi)',      { panjang_m: 2.6, lebar_m: 2.6 },      armada, false],
  ['K7 tinggi melebihi bak',             { tinggi_m: 2.6 },                     armada, false],
  ['K8 lantai muat jika diputar 90 drj', { panjang_m: 2.3, lebar_m: 8 },        armada, true],
  ['K9 tiga pelanggaran sekaligus',      { berat_ton: 30, jenis_unit: 'Lowbed', tinggi_m: 3 }, armada, false],
  ['K10 data dimensi kosong',            { tinggi_m: null },                    armada, false],
];
const baris = kasus.map(([nama, ubah, a, harap]) => {
  const r = SE.cekKompatibilitas({ ...muatan, ...ubah }, a);
  assert.strictEqual(r.cocok, harap, nama);
  return { kasus: nama, harapan: harap ? 'cocok' : 'tidak cocok', hasil: r.cocok ? 'cocok' : 'tidak cocok', alasan: r.alasan.length };
});
console.log('\nKompatibilitas'); console.table(baris);
assert.strictEqual(SE.cekKompatibilitas({ ...muatan, berat_ton: 30, jenis_unit: 'Lowbed', tinggi_m: 3 }, armada).alasan.length, 3);

/* armada belum terverifikasi tidak boleh dipakai menawar */
const belum = SE.cekKompatibilitasSopir(muatan, [{ ...armada, status_verifikasi: 'pending' }]);
assert.strictEqual(belum.cocok, false);
/* banyak armada: cocok jika salah satu cocok */
const kecil = { ...armada, kapasitas_ton: 10, status_verifikasi: 'verified' };
assert.strictEqual(SE.cekKompatibilitasSopir(muatan, [kecil, armada]).cocok, true);
assert.strictEqual(SE.cekKompatibilitasSopir(muatan, [kecil]).cocok, false);

/* ----- 3. Pencarian sekitar dan muatan balik ----- */
const m = (id, asal, tujuan, extra = {}) => ({ id, status: 'terbuka', ...muatan, asal_lat: asal[0], asal_lon: asal[1], tujuan_lat: tujuan[0], tujuan_lon: tujuan[1], ...extra });
const BOGOR = [-6.5950, 106.8166], DEPOK = [-6.4025, 106.7942], JKT = [-6.2088, 106.8456], BDG = [-6.9175, 107.6191], SBY = [-7.2575, 112.7521], SMG = [-6.9667, 110.4167];
const daftar = [
  m('dari-jakarta-ke-semarang', JKT, SMG),
  m('dari-depok-ke-bandung', DEPOK, BDG),
  m('dari-bogor-ke-bandung', BOGOR, BDG),
  m('dari-bogor-ke-surabaya', BOGOR, SBY),
  m('sudah-terkunci', BOGOR, BDG, { status: 'terkunci' }),
  m('terlalu-berat', DEPOK, BDG, { berat_ton: 40 }),
];
const sopir = { lat: BOGOR[0], lon: BOGOR[1] };

const sekitar = SE.cari({ mode: 'sekitar', muatanList: daftar, armadaList: [armada], lokasi: sopir, opsi: { radiusKm: 60 } });
console.log('\nMuatan sekitar (sopir di Bogor, radius 60 km)');
console.table(sekitar.map((x) => ({ id: x.id, 'jarak (km)': +x.jarakKm.toFixed(1), bisaTawar: x.bisaTawar })));
assert.strictEqual(sekitar.length, 5, 'semua muatan terbuka di radius 60 km (Jakarta ~43 km)');
assert.ok(sekitar.every((x, i) => i === 0 || sekitar[i - 1].jarakKm <= x.jarakKm), 'harus urut jarak terdekat');
assert.ok(!sekitar.some((x) => x.id === 'sudah-terkunci'), 'muatan terkunci tidak boleh muncul');
assert.strictEqual(sekitar.find((x) => x.id === 'terlalu-berat').bisaTawar, false);

const balik = SE.cari({ mode: 'balik', muatanList: daftar, armadaList: [armada], lokasi: sopir, kotaPulang: { lat: BDG[0], lon: BDG[1] }, opsi: { radiusAsalKm: 60, radiusTujuanKm: 50 } });
console.log('\nMuatan balik (sopir di Bogor, pulang ke Bandung)');
console.table(balik.map((x) => ({ id: x.id, 'asal (km)': +x.jarakAsalKm.toFixed(1), 'tujuan (km)': +x.jarakTujuanKm.toFixed(1), skor: +x.skorKm.toFixed(1), bisaTawar: x.bisaTawar })));
assert.ok(balik.every((x) => x.tujuan_lat === BDG[0]), 'tujuan harus dekat Bandung');
assert.ok(!balik.some((x) => ['dari-bogor-ke-surabaya', 'dari-jakarta-ke-semarang'].includes(x.id)), 'tujuan jauh dari kota pulang harus tersaring');
assert.strictEqual(balik[0].id, 'dari-bogor-ke-bandung');
assert.throws(() => SE.cari({ mode: 'balik', muatanList: daftar, armadaList: [armada], lokasi: sopir }), /Kota pulang/);

console.log('\nSemua pengujian lulus.');
