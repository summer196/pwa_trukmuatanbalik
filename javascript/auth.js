/* auth.js
   Registrasi, login, logout, dan pengalihan halaman berdasarkan peran.
   Bergantung pada: supabase-config.js (variabel global `supabaseClient`). */

/* ---------- Konfigurasi ---------- */
/* Semua rute ditulis relatif ke ROOT proyek (folder tempat index.html berada),
   lalu diubah jadi alamat penuh. Jadi pengalihan benar dari halaman di root maupun di html/. */
const APP_ROOT = new URL('../', (document.currentScript && document.currentScript.src) || window.location.href).href;
const ROUTES = {
  home: 'index.html',
  customer: 'html/dashboard.html',
  sopir: 'html/dashboard.html',   // sopir yang belum diverifikasi juga ke sini (untuk melengkapi profil armada)
  admin: 'html/admin.html',
};
const urlHalaman = (route) => new URL(route, APP_ROOT).href;
const ROLE_PENDAFTARAN = ['customer', 'sopir']; // admin TIDAK bisa daftar sendiri

/* ---------- Pesan error (bahasa Indonesia) ---------- */
function pesanError(error) {
  const msg = (error && error.message) || '';
  if (/invalid login credentials/i.test(msg)) return 'Email atau kata sandi salah.';
  if (/email not confirmed/i.test(msg)) return 'Email belum dikonfirmasi. Cek kotak masuk Anda.';
  if (/already registered|already been registered/i.test(msg)) return 'Email sudah terdaftar.';
  if (/password should be at least/i.test(msg)) return 'Kata sandi minimal 8 karakter.';
  if (/rate limit|too many/i.test(msg)) return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.';
  if (/failed to fetch|network/i.test(msg)) return 'Tidak ada koneksi internet. Periksa sinyal Anda.';
  return 'Terjadi kesalahan. Coba lagi.';
}

/* ---------- Profil & peran ---------- */
async function getProfile(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, nama, no_hp, role, status_verifikasi')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function getCurrentProfile() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session ? getProfile(session.user.id) : null;
}

/* Tentukan halaman tujuan berdasarkan peran */
function routeFor(profile) {
  return ROUTES[profile.role] || ROUTES.home;
}

function redirectByRole(profile) {
  window.location.href = urlHalaman(routeFor(profile));
}

/* ---------- Registrasi, login, logout ---------- */
async function registerUser({ nama, noHp, email, password, role }) {
  if (!ROLE_PENDAFTARAN.includes(role)) return { ok: false, message: 'Peran tidak valid.' };

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { nama, no_hp: noHp, role } }, // dibaca trigger di database
  });
  if (error) return { ok: false, message: pesanError(error) };

  // Supabase tidak melempar error untuk email yang sudah ada; ditandai identities kosong
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { ok: false, message: 'Email sudah terdaftar.' };
  }
  // Jika konfirmasi email aktif, belum ada sesi
  if (!data.session) {
    return { ok: true, needsConfirm: true, message: 'Pendaftaran berhasil. Cek email Anda untuk konfirmasi, lalu masuk.' };
  }
  return { ok: true, profile: await getProfile(data.user.id) };
}

async function loginUser(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: pesanError(error) };
  return { ok: true, profile: await getProfile(data.user.id) };
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  window.location.href = urlHalaman(ROUTES.home);
}

/* ---------- Penjaga halaman ----------
   Panggil di awal halaman dashboard, contoh:
     const profile = await requireRole(['customer', 'sopir']);
     if (!profile) return;
   Ini hanya pengaman tampilan. Keamanan data sebenarnya ada di RLS database.
   Fitur yang butuh sopir terverifikasi (misalnya cari muatan) memeriksa status_verifikasi sendiri. */
async function requireRole(allowedRoles) {
  let profile = null;
  try { profile = await getCurrentProfile(); } catch (e) { console.error(e); }

  if (!profile) { window.location.replace(urlHalaman(ROUTES.home)); return null; }
  if (!allowedRoles.includes(profile.role)) { window.location.replace(urlHalaman(routeFor(profile))); return null; }
  return profile;
}

/* ---------- UI modal masuk/daftar (halaman pendaratan) ---------- */
function initAuthUI() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  const tabs = modal.querySelectorAll('[data-auth-tab]');
  const forms = {
    login: document.getElementById('form-login'),
    register: document.getElementById('form-register'),
  };

  function setMsg(form, text, type = 'error') {
    const el = form.querySelector('.auth__msg');
    el.textContent = text;
    el.dataset.type = type;
  }

  function showTab(name) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.authTab === name)));
    Object.entries(forms).forEach(([key, form]) => { form.hidden = key !== name; setMsg(form, ''); });
  }

  async function handleSubmit(form, action) {
    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Memproses...'; setMsg(form, '');
    try {
      const res = await action(Object.fromEntries(new FormData(form)));
      if (!res.ok) setMsg(form, res.message);
      else if (res.needsConfirm) { setMsg(form, res.message, 'ok'); form.reset(); }
      else { setMsg(form, 'Berhasil. Mengalihkan...', 'ok'); redirectByRole(res.profile); }
    } catch (err) {
      console.error(err);
      setMsg(form, pesanError(err));
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  document.querySelectorAll('[data-auth-open]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showTab(el.dataset.authOpen);
      if (!modal.open) modal.showModal();
    }));
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.authTab)));
  modal.querySelector('[data-auth-close]').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); }); // klik area gelap

  forms.login.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit(forms.login, (d) => loginUser(d.email.trim(), d.password));
  });
  forms.register.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit(forms.register, (d) => registerUser({
      nama: d.nama.trim(), noHp: d.no_hp.trim(), email: d.email.trim(), password: d.password, role: d.role,
    }));
  });

  showTab('login');
}

document.addEventListener('DOMContentLoaded', initAuthUI);
