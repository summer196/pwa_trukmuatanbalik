/* javascript/tests/core.test.js
   Uji unit kasus TC-01 sampai TC-16 (Bab V, Tabel 5.1) terhadap kode inti di javascript/core,
   ditambah pemeriksaan prinsip desain Bab IV (LSP pada Repository, Observer FR-15, pewarisan domain).
   Jalankan dari akar proyek:  node --test javascript/tests/        (Node.js 20 ke atas) */

const test = require('node:test');
const assert = require('node:assert/strict');

const { HaversineCalculator: H } = require('../core/haversine.js');
const { KompatibilitasValidator } = require('../core/validator/validator.js');
const { PencarianMuatanService } = require('../core/pencarian-service.js');
const { InMemoryMuatanRepository } = require('../core/repository/in-memory-muatan-repo.js');
const { CacheMuatanRepository } = require('../core/repository/cache-muatan-repo.js');
const { SupabaseMuatanRepository } = require('../core/repository/supabase-muatan-repo.js');
const { RealtimeObserver } = require('../core/realtime-observer.js');
const { Pengguna } = require('../domain/Pengguna.js');
const { Sopir } = require('../domain/Sopir.js');
const { Customer } = require('../domain/Customer.js');
const { Admin } = require('../domain/Admin.js');

/* ---------- Data bersama ---------- */
const JKT = [-6.2088, 106.8456], BDG = [-6.9175, 107.6191], SBY = [-7.2575, 112.7521];
const armada = { jenisUnit: 'flatbed', kapasitasTon: 25, panjangBakM: 12, lebarBakM: 2.5, tinggiBakM: 2.7 };
const muatan = (o = {}) => ({ beratTon: 22, panjangM: 9.2, lebarM: 2.4, tinggiM: 2.6, jenisUnitDibutuhkan: ['flatbed', 'lowbed'], ...o });
const v = new KompatibilitasValidator();

/* ===================== FR-05 Haversine (TC-01 s.d. TC-05) ===================== */
test('TC-01 Jakarta ke Bandung = 116,24 km', () => {
  assert.ok(Math.abs(H.jarakKm(...JKT, ...BDG) - 116.24) <= 0.01, `hasil ${H.jarakKm(...JKT, ...BDG)}`);
});
test('TC-02 Jakarta ke Surabaya = 662,57 km dan simetris', () => {
  const a = H.jarakKm(...JKT, ...SBY), b = H.jarakKm(...SBY, ...JKT);
  assert.ok(Math.abs(a - 662.57) <= 0.01, `hasil ${a}`);
  assert.equal(a, b);
});
test('TC-03 titik sama = 0', () => assert.equal(H.jarakKm(-6.2, 106.8, -6.2, 106.8), 0));
test('TC-04 melintasi bujur 180 = 111,19 km (bukan ~20.000)', () => {
  const d = H.jarakKm(0, 179.5, 0, -179.5);
  assert.ok(Math.abs(d - 111.19) <= 0.01, `hasil ${d}`);
});
test('TC-05 masukan tidak valid melempar RangeError', () => {
  for (const [la, lo] of [[91, 0], [0, 181], [NaN, 0], [0, NaN], [null, 0], [0, null]]) {
    assert.throws(() => H.jarakKm(la, lo, 0, 0), RangeError, `lat=${la} lon=${lo}`);
  }
});

/* ===================== FR-07 Validator (TC-06 s.d. TC-12) ===================== */
test('TC-06 muatan sesuai: kompatibel, tombol tawar aktif, tanpa alasan', () => {
  const h = v.validasi(muatan(), armada);
  assert.equal(h.kompatibel, true); assert.equal(h.bolehTawar(), true); assert.deepEqual(h.alasan, []);
});
test('TC-07 berat tepat sama lolos; lebih 0,01 t gagal', () => {
  assert.equal(v.validasi(muatan({ beratTon: 25 }), armada).kompatibel, true);
  const h = v.validasi(muatan({ beratTon: 25.01 }), armada);
  assert.equal(h.kompatibel, false); assert.match(h.alasan[0], /Kelebihan berat/);
});
test('TC-08 dimensi: tiap pelanggaran gagal, dimensi tepat sama lolos', () => {
  assert.equal(v.validasi(muatan({ panjangM: 12.1 }), armada).kompatibel, false, 'panjang 12,1');
  assert.equal(v.validasi(muatan({ lebarM: 2.6 }), armada).kompatibel, false, 'lebar 2,6');
  assert.equal(v.validasi(muatan({ tinggiM: 2.8 }), armada).kompatibel, false, 'tinggi 2,8');
  assert.equal(v.validasi(muatan({ panjangM: 12, lebarM: 2.5, tinggiM: 2.7 }), armada).kompatibel, true, 'tepat sama');
});
test('TC-09 hanya lowbed, armada flatbed: gagal dengan alasan jenis unit', () => {
  const h = v.validasi(muatan({ jenisUnitDibutuhkan: ['lowbed'] }), armada);
  assert.equal(h.kompatibel, false); assert.match(h.alasan.join(' '), /[Jj]enis unit tidak sesuai/);
});
test('TC-10 daftar jenis unit kosong/tidak ada: gagal (bukan cocok semua)', () => {
  assert.equal(v.validasi(muatan({ jenisUnitDibutuhkan: [] }), armada).kompatibel, false);
  const tanpa = muatan(); delete tanpa.jenisUnitDibutuhkan;
  assert.equal(v.validasi(tanpa, armada).kompatibel, false);
});
test('TC-11 tiga pelanggaran sekaligus: tiga alasan, tawar nonaktif', () => {
  const h = v.validasi(muatan({ beratTon: 38, lebarM: 3.2, jenisUnitDibutuhkan: ['lowbed'] }), armada);
  assert.equal(h.alasan.length, 3); assert.equal(h.bolehTawar(), false);
});
test('TC-12 aturan baru ditambah tanpa mengubah validator (Open/Closed)', () => {
  const v2 = new KompatibilitasValidator([...v.aturan, () => 'Melebihi batas sumbu']);
  assert.ok(v2.validasi(muatan(), armada).alasan.includes('Melebihi batas sumbu'));
});

/* ===================== FR-05/FR-06 Layanan pencarian (TC-13 s.d. TC-16) ===================== */
const aktif = (id, [lat, lon], tujuan = JKT, extra = {}) => ({ id, status: 'tersedia', asal_lat: lat, asal_lon: lon, tujuan_lat: tujuan[0], tujuan_lon: tujuan[1], ...extra });
const GRESIK = [-7.1554, 112.6556], SIDOARJO = [-7.4478, 112.7183], MALANG = [-7.9666, 112.6326];

test('TC-13 radius 50 km dari Surabaya: hanya muatan aktif, terurut dari terdekat', async () => {
  const repo = new InMemoryMuatanRepository([
    aktif('sidoarjo', SIDOARJO), aktif('gresik', GRESIK), aktif('malang', MALANG),
    aktif('terkunci', SBY, JKT, { status: 'terkunci' }),
  ]);
  const hasil = await new PencarianMuatanService(repo).cariTerdekat({ lat: SBY[0], lon: SBY[1] }, 50);
  assert.deepEqual(hasil.map((m) => m.id), ['gresik', 'sidoarjo']);
});
test('TC-14 radius 0: hanya jarak tepat 0', async () => {
  const repo = new InMemoryMuatanRepository([aktif('tepat', SBY), aktif('dekat', GRESIK)]);
  const hasil = await new PencarianMuatanService(repo).cariTerdekat({ lat: SBY[0], lon: SBY[1] }, 0);
  assert.deepEqual(hasil.map((m) => m.id), ['tepat']);
});
test('TC-15 muatan balik Surabaya ke Jakarta (r1=r2=50): tujuan Bandung dan terkunci tersingkir', async () => {
  const repo = new InMemoryMuatanRepository([
    aktif('ke-jakarta', SBY, JKT), aktif('ke-bandung', SBY, BDG), aktif('terkunci', SBY, JKT, { status: 'terkunci' }),
  ]);
  const hasil = await new PencarianMuatanService(repo).cariMuatanBalik({ lat: SBY[0], lon: SBY[1] }, { lat: JKT[0], lon: JKT[1] }, 50, 50);
  assert.deepEqual(hasil.map((m) => m.id), ['ke-jakarta']);
});
test('TC-16 repository kosong: daftar kosong, bukan galat', async () => {
  const s = new PencarianMuatanService(new InMemoryMuatanRepository([]));
  assert.deepEqual(await s.cariTerdekat({ lat: SBY[0], lon: SBY[1] }), []);
  assert.deepEqual(await s.cariMuatanBalik({ lat: SBY[0], lon: SBY[1] }, { lat: JKT[0], lon: JKT[1] }), []);
});

/* ===================== Prinsip desain Bab IV ===================== */
test('LSP: tiga implementasi MuatanRepository saling menggantikan dengan hasil sama', async () => {
  const data = [aktif('sidoarjo', SIDOARJO, JKT, { status: 'terbuka' }), aktif('gresik', GRESIK, JKT, { status: 'terbuka' }), aktif('malang', MALANG, JKT, { status: 'terbuka' })];
  const memori = new InMemoryMuatanRepository(data);
  global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, x) { this._d[k] = x; } };
  const cache = new CacheMuatanRepository(); for (const m of data) await cache.simpan(m);
  const supabase = new SupabaseMuatanRepository({ from: () => ({ select: () => ({ or: () => Promise.resolve({ data, error: null }) }) }) });
  const hasil = [];
  for (const repo of [memori, cache, supabase]) hasil.push((await new PencarianMuatanService(repo).cariTerdekat({ lat: SBY[0], lon: SBY[1] }, 50)).map((m) => m.id));
  assert.deepEqual(hasil[0], ['gresik', 'sidoarjo']); assert.deepEqual(hasil[1], hasil[0]); assert.deepEqual(hasil[2], hasil[0]);
});
test('DIP: layanan menolak dibuat tanpa repository', () => assert.throws(() => new PencarianMuatanService(null)));
test('Validasi terintegrasi pada pencarian: muatan tidak cocok ditandai dan tidak boleh ditawar', async () => {
  const repo = new InMemoryMuatanRepository([
    { ...aktif('ok', GRESIK), beratTon: 20, panjangM: 6, lebarM: 2, tinggiM: 2, jenisUnitDibutuhkan: ['flatbed'] },
    { ...aktif('berat', SIDOARJO), beratTon: 40, panjangM: 6, lebarM: 2, tinggiM: 2, jenisUnitDibutuhkan: ['flatbed'] },
  ]);
  const hasil = await new PencarianMuatanService(repo).cariTerdekat({ lat: SBY[0], lon: SBY[1] }, 50, [{ ...armada, statusVerifikasi: 'verified' }]);
  assert.deepEqual(hasil.map((m) => [m.id, m.bisaTawar]), [['ok', true], ['berat', false]]);
});
test('Observer (FR-15): muatan baru dalam radius diteruskan beserta validasi; di luar radius diabaikan; berhenti melepas saluran', () => {
  let handler = null, dilepas = false;
  const klien = { channel: () => ({ on: (_e, _f, cb) => { handler = cb; return { subscribe() {} }; }, subscribe() {} }), removeChannel: () => { dilepas = true; } };
  const diterima = [];
  const obs = new RealtimeObserver(klien);
  const berhenti = obs.amatiMuatanBaru({ lokasiSopir: { lat: SBY[0], lon: SBY[1] }, radiusKm: 50, armada: [{ ...armada, statusVerifikasi: 'verified' }], validator: v, onMuatanBaru: (m) => diterima.push(m.id) });
  handler({ new: { id: 'dekat', asal_lat: GRESIK[0], asal_lon: GRESIK[1], beratTon: 10, panjangM: 5, lebarM: 2, tinggiM: 2, jenisUnitDibutuhkan: ['flatbed'] } });
  handler({ new: { id: 'jauh', asal_lat: JKT[0], asal_lon: JKT[1] } });
  assert.deepEqual(diterima, ['dekat']);
  berhenti(); assert.equal(dilepas, true);
});
test('Pewarisan domain: Sopir, Customer, Admin adalah Pengguna', () => {
  for (const K of [Sopir, Customer, Admin]) assert.ok(new K({ id: 'x', nama: 'n' }) instanceof Pengguna, K.name);
});
