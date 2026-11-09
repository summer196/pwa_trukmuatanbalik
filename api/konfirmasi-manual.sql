-- konfirmasi-manual.sql : untuk akun yang tertahan karena tautan email mengarah ke localhost.
-- Ganti email di bawah, lalu jalankan di Supabase SQL Editor. Setelah itu akun bisa langsung login.
update auth.users
set email_confirmed_at = now()
where email = 'EMAIL-PENGGUNA@contoh.com' and email_confirmed_at is null;
