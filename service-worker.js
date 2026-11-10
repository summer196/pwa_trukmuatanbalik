/* service-worker.js - caching untuk Muatanku (PWA).
   WAJIB di ROOT proyek, agar scope-nya mencakup seluruh situs (index.html dan html/*).
   Naikkan VERSI setiap kali file aplikasi diubah, supaya cache lama diganti.

   Strategi:
   - Cangkang aplikasi (HTML, CSS, JS, logo)  : disimpan saat install; halaman memakai "jaringan dulu, 4 detik, lalu cache".
   - Data muatan/armada/penawaran (REST Supabase): "jaringan dulu"; jika sinyal lemah/offline, tampilkan data TERAKHIR dari cache.
   - Skrip CDN (supabase-js, Leaflet)         : "stale-while-revalidate".
   - Tile peta OpenStreetMap                   : "cache dulu", dibatasi jumlahnya.
   - Auth, realtime, pencarian lokasi, dan semua request non-GET : tidak disentuh (langsung ke jaringan). */

const VERSI = 'v8';
const CACHE_SHELL = `muatanku-shell-${VERSI}`;
const CACHE_ASET = `muatanku-aset-${VERSI}`;
const CACHE_API = `muatanku-api-${VERSI}`;
const CACHE_PETA = `muatanku-peta-${VERSI}`;
const SEMUA_CACHE = [CACHE_SHELL, CACHE_ASET, CACHE_API, CACHE_PETA];

const BATAS_PETA = 150;           // jumlah tile maksimum yang disimpan
const BATAS_TUNGGU_MS = 4000;     // lewat ini dianggap sinyal lemah -> pakai cache

const SHELL = [
  './', 'index.html', 'html/offline.html', 'style.css', 'manifest.json',
  'css/auth.css', 'css/dashboard.css',
  'html/dashboard.html', 'html/admin.html',
  'javascript/supabase-config.js', 'javascript/auth.js', 'javascript/pwa.js',
  'javascript/landing.js',
  'javascript/dashboard.js', 'javascript/driver-dashboard.js', 'javascript/customer-dashboard.js',
  'javascript/admin-dashboard.js', 'javascript/admin-verifikasi.js', 'javascript/admin-pengiriman.js', 'javascript/admin-customer.js',
  'javascript/admin-posting-muatan.js', 'javascript/admin-cari-muatan.js',
  'javascript/search-engine.js', 'javascript/transaction.js', 'javascript/map.js',
  'img/logo.svg', 'img/logo-icon.svg', 'img/logo-horizontal.svg', 'img/logo-horizontal-white.svg',
  'img/icons/icon-192.png', 'img/icons/icon-512.png',
];
const CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
];

/* ---------- Install: simpan cangkang. Satu file gagal tidak boleh menggagalkan seluruh install. ---------- */
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const shell = await caches.open(CACHE_SHELL);
    const aset = await caches.open(CACHE_ASET);
    const simpan = (cache, url) => cache.add(url).catch((err) => console.warn('[SW] gagal menyimpan', url, err));
    await Promise.all([...SHELL.map((u) => simpan(shell, u)), ...CDN.map((u) => simpan(aset, u))]);
    await self.skipWaiting();
  })());
});

/* ---------- Activate: hapus cache versi lama ---------- */
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const nama = await caches.keys();
    await Promise.all(nama.filter((n) => n.startsWith('muatanku-') && !SEMUA_CACHE.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* ---------- Pesan dari halaman ---------- */
self.addEventListener('message', (e) => {
  const tipe = e.data && e.data.type;
  if (tipe === 'SKIP_WAITING') self.skipWaiting();
  if (tipe === 'BERSIHKAN_CACHE_API') e.waitUntil(caches.delete(CACHE_API));   // dipanggil saat logout (data pengguna tidak boleh tersisa)
});

/* ---------- Fetch ---------- */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname.endsWith('.supabase.co')) {
    if (url.pathname.startsWith('/rest/v1/')) e.respondWith(jaringanDulu(req, CACHE_API));
    return;                                             // /auth/v1, /realtime: langsung ke jaringan
  }
  if (url.hostname === 'nominatim.openstreetmap.org') return;
  if (url.hostname === 'tile.openstreetmap.org') { e.respondWith(cacheDulu(req, CACHE_PETA, BATAS_PETA)); return; }
  if (req.mode === 'navigate') { e.respondWith(navigasi(req)); return; }
  if (url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net') e.respondWith(staleWhileRevalidate(e, CACHE_ASET, req));
});

/* ---------- Strategi ---------- */
const ok = (res) => res && res.ok;

/** Data API: jaringan dulu; kalau lambat (>4 dtk), gagal, atau 5xx, pakai cadangan terakhir. */
async function jaringanDulu(req, namaCache) {
  const cache = await caches.open(namaCache);
  const cadangan = await cache.match(req);
  const jaringan = fetch(req).then((res) => {
    if (ok(res)) cache.put(req, res.clone());
    return res.status >= 500 && cadangan ? cadangan : res;       // 401/403 tetap diteruskan agar aplikasi bisa minta login ulang
  });
  if (!cadangan) return jaringan;                                  // belum pernah ada data: tunggu jaringan
  const habisWaktu = new Promise((r) => setTimeout(() => r(cadangan), BATAS_TUNGGU_MS));
  return Promise.race([jaringan.catch(() => cadangan), habisWaktu]);
}

/** Halaman: jaringan dulu; sinyal lemah/offline -> halaman tersimpan -> html/offline.html. */
async function navigasi(req) {
  const cache = await caches.open(CACHE_SHELL);
  const cadangan = await cache.match(req, { ignoreSearch: true });
  const jaringan = fetch(req).then((res) => { if (ok(res)) cache.put(req, res.clone()); return res; });
  if (!cadangan) return jaringan.catch(async () => (await cache.match('html/offline.html')) || Response.error());
  const habisWaktu = new Promise((r) => setTimeout(() => r(cadangan), BATAS_TUNGGU_MS));
  return Promise.race([jaringan.catch(() => cadangan), habisWaktu]);
}

/** File statis/CDN: tampilkan cache segera, perbarui di belakang layar. */
async function staleWhileRevalidate(e, namaCache, req) {
  const cache = await caches.open(namaCache);
  const lama = (await cache.match(req)) || (await (await caches.open(CACHE_SHELL)).match(req));
  const baru = fetch(req).then((res) => { if (ok(res)) cache.put(req, res.clone()); return res; });
  if (lama) { e.waitUntil(baru.catch(() => {})); return lama; }
  return baru;
}

/** Tile peta: cache dulu; yang baru disimpan dan jumlahnya dipangkas. */
async function cacheDulu(req, namaCache, batas) {
  const cache = await caches.open(namaCache);
  const ada = await cache.match(req);
  if (ada) return ada;
  const res = await fetch(req);
  if (ok(res)) {                                                   // hanya respons CORS (Leaflet crossOrigin: true), bukan opaque
    await cache.put(req, res.clone());
    const kunci = await cache.keys();
    if (kunci.length > batas) await Promise.all(kunci.slice(0, kunci.length - batas).map((k) => cache.delete(k)));
  }
  return res;
}
