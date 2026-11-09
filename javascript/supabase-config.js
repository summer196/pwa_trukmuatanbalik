/* supabase-config.js
   Inisialisasi klien Supabase. Muat SETELAH library supabase-js dan SEBELUM auth.js.
   Isi dua nilai di bawah dari: Supabase Dashboard > Project Settings > API.
   Pakai kunci "anon" / "publishable" saja. JANGAN PERNAH memakai kunci "service_role" di frontend. */

const SUPABASE_URL = 'https://GANTI-DENGAN-ID-PROYEK.supabase.co';
const SUPABASE_ANON_KEY = 'GANTI-DENGAN-ANON-ATAU-PUBLISHABLE-KEY';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,      // sesi tetap ada setelah tab ditutup
    autoRefreshToken: true,
    detectSessionInUrl: true,  // dibutuhkan untuk tautan konfirmasi email
  },
});
