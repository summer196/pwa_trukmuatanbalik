-- jadikan-admin.sql : promosikan satu akun menjadi admin.
-- 1) Akun itu harus sudah terdaftar dan emailnya terkonfirmasi.
-- 2) Ganti EMAIL-ADMIN-ANDA, lalu jalankan di Supabase SQL Editor.
update public.profiles
set role = 'admin', status_verifikasi = 'verified'
where id = (select id from auth.users where email = 'EMAIL-ADMIN-ANDA');

-- Cek hasilnya (harus muncul 1 baris dengan role = admin):
select p.nama, u.email, p.role, p.status_verifikasi
from public.profiles p join auth.users u on u.id = p.id
where p.role = 'admin';
