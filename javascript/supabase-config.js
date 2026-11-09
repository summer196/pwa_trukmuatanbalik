/* supabase-config.js
   Inisialisasi klien Supabase. Muat SETELAH library supabase-js dan SEBELUM auth.js.
   Isi dua nilai di bawah dari: Supabase Dashboard > Project Settings > API.
   Pakai kunci "anon" / "publishable" saja. JANGAN PERNAH memakai kunci "service_role" di frontend.

   PENTING untuk Vercel: ini situs statis, jadi "Environment Variables" Vercel TIDAK ikut masuk ke file ini.
   Nilai harus ditulis langsung di sini (kunci anon memang aman dipublikasikan; keamanan ada di RLS). */

const SUPABASE_URL = 'https://elygwmsgfrvbikhhtxcx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2x1uPXK4hVaSxXScS0W0pA_zWblng8u';

const belumDiisi = /GANTI/.test(SUPABASE_URL + SUPABASE_ANON_KEY);
const libMuat = !!(window.supabase && window.supabase.createClient);

if (belumDiisi) console.error('[Muatanku] SUPABASE_URL / SUPABASE_ANON_KEY di javascript/supabase-config.js belum diisi.');
if (!libMuat) console.error('[Muatanku] Library supabase-js gagal dimuat dari CDN (cek koneksi atau pemblokir iklan).');

// null jika belum siap; auth.js menampilkan pesan yang jelas, bukan error samar
const supabaseClient = (!belumDiisi && libMuat)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,      // sesi tetap ada setelah tab ditutup
        autoRefreshToken: true,
        detectSessionInUrl: true,  // dibutuhkan untuk tautan konfirmasi email
      },
    })
  : null;
