/* admin-dashboard.js
   Controller utama dasbor admin. Mengatur navigasi antar modul:
   1. Verifikasi Sopir (admin-verifikasi.js)
   2. Pelacakan Paket (admin-pengiriman.js)
   3. Data Customer (admin-customer.js)
   4. Posting Muatan (admin-posting-muatan.js)
   5. Cari Muatan (admin-cari-muatan.js)
   Bergantung pada: supabase-config.js, auth.js, dashboard.js */

const MENU_ADMIN = {
  verifikasi: {
    label: 'Verifikasi Sopir',
    judul: 'Verifikasi Sopir & Armada',
    mount: (wadah, ctx) => mountAdminVerifikasi(wadah, ctx),
  },
  pelacakan: {
    label: 'Pelacakan Paket',
    judul: 'Pelacakan Paket & Pengiriman',
    mount: (wadah, ctx) => mountAdminPelacakan(wadah, ctx),
  },
  customer: {
    label: 'Data Customer',
    judul: 'Data Pengguna Customer',
    mount: (wadah, ctx) => mountAdminCustomer(wadah, ctx),
  },
  posting: {
    label: 'Posting Muatan',
    judul: 'Posting & Kelola Muatan (Akses Admin)',
    mount: (wadah, ctx) => mountAdminPostingMuatan(wadah, ctx),
  },
  cari: {
    label: 'Cari Muatan',
    judul: 'Pencarian Muatan Balik & Sekitar (Akses Admin)',
    mount: (wadah, ctx) => mountAdminCariMuatan(wadah, ctx),
  },
};

async function initAdmin() {
  const app = document.getElementById('app');
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', logoutUser);

  let profile = null;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    console.error(err);
    app.replaceChildren(el('p', { class: 'dash-msg', 'data-type': 'error' }, pesanDb(err)));
    document.getElementById('dash-title').textContent = 'Gagal memuat';
    return;
  }

  if (!profile) {
    window.location.replace(urlHalaman(ROUTES.home));
    return;
  }

  document.getElementById('user-name').textContent = profile.nama || 'Pengguna';
  document.getElementById('user-role').textContent = profile.role;

  if (profile.role !== 'admin') {
    document.getElementById('dash-title').textContent = 'Akses ditolak';
    app.replaceChildren(el('section', { class: 'dash-card' },
      el('p', {}, `Akun ini berperan "${profile.role}", bukan admin. Jalankan perintah promosi admin di api/schema.sql untuk email ini, lalu keluar dan masuk lagi.`),
      el('a', { href: 'dashboard.html', class: 'btn btn--primary' }, 'Ke dasbor saya')));
    return;
  }

  document.getElementById('user-role').textContent = 'Admin';
  mountAdminDashboard(app, profile);
}

function mountAdminDashboard(root, profile) {
  const queryTab = new URLSearchParams(window.location.search).get('menu') || (window.location.hash ? window.location.hash.slice(1) : null);
  let aktif = (queryTab && MENU_ADMIN[queryTab]) ? queryTab : 'verifikasi';

  const menuNav = el('div', { class: 'dash-tabs admin-main-nav', role: 'tablist' },
    Object.entries(MENU_ADMIN).map(([k, item]) => el('button', {
      type: 'button', role: 'tab', 'data-admin-menu': k,
      onclick: () => gantiMenu(k),
    }, item.label)));

  const kontenWadah = el('div', { class: 'admin-content-card' });

  root.replaceChildren(menuNav, kontenWadah);

  function gantiMenu(k) {
    if (!MENU_ADMIN[k]) return;
    aktif = k;
    menuNav.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.adminMenu === aktif));
    });
    const item = MENU_ADMIN[aktif];
    document.getElementById('dash-title').textContent = item.judul;
    kontenWadah.innerHTML = '';
    item.mount(kontenWadah, { profile });
  }

  gantiMenu(aktif);
}

if (document.body.dataset.halaman === 'admin') {
  document.addEventListener('DOMContentLoaded', initAdmin);
}
