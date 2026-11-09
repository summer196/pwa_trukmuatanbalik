/* pwa.js - mendaftarkan service worker, tombol "Pasang aplikasi", dan penanda offline.
   Dimuat di semua halaman (pakai atribut defer). */
(() => {
  // Root proyek dihitung dari lokasi file ini (…/javascript/pwa.js -> …/), jadi benar dari halaman mana pun
  const ROOT = new URL('../', (document.currentScript && document.currentScript.src) || window.location.href).href;

  /* Service worker (hanya jalan di HTTPS atau localhost) */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(ROOT + 'service-worker.js', { scope: ROOT })
        .then((reg) => reg.addEventListener('updatefound', () => {
          const baru = reg.installing;
          if (baru) baru.addEventListener('statechange', () => {
            if (baru.state === 'installed' && navigator.serviceWorker.controller) baru.postMessage({ type: 'SKIP_WAITING' });
          });
        }))
        .catch((err) => console.error('[PWA] service worker gagal didaftarkan:', err));
    });
  }

  /* Tombol pasang: tandai elemen dengan data-pwa-install (awalnya hidden) */
  let tertunda = null;
  const tombol = () => document.querySelectorAll('[data-pwa-install]');
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); tertunda = e; tombol().forEach((b) => { b.hidden = false; }); });
  window.addEventListener('appinstalled', () => { tertunda = null; tombol().forEach((b) => { b.hidden = true; }); });
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-pwa-install]') || !tertunda) return;
    e.preventDefault();
    tertunda.prompt();
    await tertunda.userChoice;
    tertunda = null;
    tombol().forEach((b) => { b.hidden = true; });
  });

  /* Penanda offline / sinyal hilang */
  const bar = document.createElement('div');
  bar.className = 'offline-bar'; bar.setAttribute('role', 'status');
  bar.textContent = 'Anda sedang offline. Menampilkan data terakhir yang tersimpan.';
  bar.hidden = navigator.onLine;
  document.body.prepend(bar);
  window.addEventListener('offline', () => { bar.hidden = false; });
  window.addEventListener('online', () => { bar.hidden = true; });
})();
