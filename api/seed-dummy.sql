-- seed-dummy.sql : DATA UJI (dummy) untuk mencoba seluruh alur Muatanku tanpa proses verifikasi manual.
-- Jalankan di Supabase Dashboard > SQL Editor, SETELAH semua skema (schema.sql, schema-armada-muatan.sql,
-- schema-pencarian.sql, schema-transaksi.sql). Aman dijalankan berulang: data dummy lama dihapus dulu.
-- Untuk menghapus seluruh data dummy: jalankan api/seed-hapus-dummy.sql.
--
-- HANYA UNTUK PROYEK UJI. Jangan dijalankan di proyek produksi (kata sandi dummy sama untuk semua akun).
--
-- Semua akun memakai kata sandi:  Dummy12345   dan email berakhiran @muatanku.test (sudah terkonfirmasi).
--
--   Peran      Email                          Status
--   admin      admin@muatanku.test            verified
--   sopir      sopir.budi@muatanku.test       verified   Tronton Bak B 9876 XYZ (25 t)
--   sopir      sopir.agus@muatanku.test       verified   Trailer Flatbed L 4455 AB dan L 5566 AC (30 t)
--   sopir      sopir.dedi@muatanku.test       verified   Lowbed D 1122 CD (45 t) dan Tronton Wingbox D 3344 CE (28 t)
--   sopir      sopir.eko@muatanku.test        verified   Tronton Bak AB 3344 GH (24 t)
--   sopir      sopir.joko@muatanku.test       pending    unit pending  -> untuk mencoba verifikasi oleh admin
--   sopir      sopir.maman@muatanku.test      rejected   unit ditolak
--   customer   customer.maju@muatanku.test    verified   PT Maju Jaya
--   customer   customer.sinar@muatanku.test   verified   CV Sinar Baja
--
-- Skenario yang tersedia:
--   * Cari muatan sekitar Bogor/Depok (m01, m06, m07): ada yang cocok, kelebihan berat, dan terlalu lebar.
--   * Muatan balik Surabaya -> Jakarta (m08, m09, m10): sopir Agus/Budi/Eko; m10 (Malang) jauh dari Surabaya.
--   * m01 punya dua penawaran (Budi dan Eko): masuk sebagai customer.maju lalu "Pilih sopir".
--   * Tab Pengiriman: m11 (status memuat, sopir Budi) dan m12 (selesai, sopir Eko) lengkap dengan riwayat status.
--   * Admin: sopir.joko menunggu verifikasi (akun dan unit).

begin;

-- 0. Hapus data dummy lama (turunannya ikut terhapus lewat ON DELETE CASCADE)
delete from auth.users where email like '%@muatanku.test';

-- Trigger validasi penawaran memakai auth.uid() (NULL saat dijalankan dari SQL Editor), jadi dimatikan
-- sementara selama seed. Dinyalakan lagi di akhir (dalam transaksi yang sama).
alter table public.penawaran disable trigger penawaran_validasi;

-- 1. Akun: auth.users + auth.identities. Trigger on_auth_user_created otomatis membuat baris profiles.
create function pg_temp.buat_user(p_id uuid, p_email text, p_nama text, p_hp text, p_role text) returns void
language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
          extensions.crypt('Dummy12345', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('nama', p_nama, 'no_hp', p_hp, 'role', p_role, 'email_verified', true),
          now(), now(), '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id::text, p_id,
          jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());
end $$;

select pg_temp.buat_user('a0000000-0000-0000-0000-000000000001', 'admin@muatanku.test',          'Admin Dummy',     '081100000001', 'customer');
select pg_temp.buat_user('a0000000-0000-0000-0000-000000000011', 'sopir.budi@muatanku.test',     'Budi Santoso',    '081200000001', 'sopir');
select pg_temp.buat_user('a0000000-0000-0000-0000-000000000012', 'sopir.agus@muatanku.test',     'Agus Wijaya',     '081200000002', 'sopir');
select pg_temp.buat_user('a0000000-0000-0000-0000-000000000013', 'sopir.dedi@muatanku.test',     'Dedi Kurniawan',  '081200000003', 'sopir');
select pg_temp.buat_user('a0000000-0000-0000-0000-000000000014', 'sopir.eko@muatanku.test',      'Eko Prasetyo',    '081200000004', 'sopir');
select pg_temp.buat_user('a0000000-0000-0000-0000-000000000015', 'sopir.joko@muatanku.test',     'Joko Baru',       '081200000005', 'sopir');
select pg_temp.buat_user('a0000000-0000-0000-0000-000000000016', 'sopir.maman@muatanku.test',    'Maman Ditolak',   '081200000006', 'sopir');
select pg_temp.buat_user('a0000000-0000-0000-0000-000000000021', 'customer.maju@muatanku.test',  'PT Maju Jaya',    '081300000001', 'customer');
select pg_temp.buat_user('a0000000-0000-0000-0000-000000000022', 'customer.sinar@muatanku.test', 'CV Sinar Baja',   '081300000002', 'customer');

-- 2. Peran dan status verifikasi (sopir baru otomatis 'pending', customer otomatis 'verified')
update public.profiles set role = 'admin', status_verifikasi = 'verified' where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set status_verifikasi = 'verified'
 where id in ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000012',
              'a0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000014');
update public.profiles set status_verifikasi = 'rejected' where id = 'a0000000-0000-0000-0000-000000000016';

-- 3. Armada
insert into public.armada (id, pengguna_id, jenis_unit, plat_nomor, kapasitas_ton, panjang_m, lebar_m, tinggi_m, status_verifikasi) values
 ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000011', 'Tronton Bak',      'B 9876 XYZ', 25.0,  9.0, 2.4, 2.5, 'verified'),
 ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000012', 'Trailer Flatbed',  'L 4455 AB',  30.0, 12.0, 2.5, 2.7, 'verified'),
 ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000012', 'Trailer Flatbed',  'L 5566 AC',  30.0, 12.0, 2.5, 2.7, 'verified'),
 ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000013', 'Lowbed',           'D 1122 CD',  45.0, 12.0, 3.0, 3.5, 'verified'),
 ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000013', 'Tronton Wingbox',  'D 3344 CE',  28.0,  9.6, 2.4, 2.6, 'verified'),
 ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000014', 'Tronton Bak',      'AB 3344 GH', 24.0,  8.5, 2.4, 2.4, 'verified'),
 ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000015', 'Tronton Bak',      'F 7788 EF',  22.0,  8.0, 2.4, 2.4, 'pending'),
 ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000016', 'Dump Truck',       'T 1010 XX',  20.0,  6.0, 2.3, 1.8, 'rejected');

-- 4. Muatan (jadwal muat dihitung dari hari ini, jadi selalu di masa depan)
insert into public.muatan (id, customer_id, jenis, berat_ton, panjang_m, lebar_m, tinggi_m,
                           asal_nama, asal_lat, asal_lon, tujuan_nama, tujuan_lat, tujuan_lon,
                           jadwal_muat, jenis_unit, harga, status) values
 ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000021', 'Trafo',                20.0,  6.0, 2.0, 2.0, 'Cibinong, Bogor',   -6.4817, 106.8540, 'Bandung',            -6.9175, 107.6191, current_date + 3, 'Tronton Bak',     15000000, 'terbuka'),
 ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000021', 'Baja struktural',      24.0,  8.0, 2.3, 2.0, 'Cikarang, Bekasi',  -6.3070, 107.1720, 'Surabaya',           -7.2575, 112.7521, current_date + 4, 'Trailer Flatbed', 28000000, 'terbuka'),
 ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000021', 'Semen',                18.0,  6.0, 2.2, 2.2, 'Cilegon',           -6.0024, 106.0110, 'Bandung',            -6.9175, 107.6191, current_date + 5, 'Tronton Wingbox', 12500000, 'terbuka'),
 ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000021', 'Alat berat (ekskavator)', 38.0, 11.0, 2.9, 3.4, 'Bekasi',          -6.2383, 106.9756, 'Semarang',           -6.9667, 110.4167, current_date + 2, 'Lowbed',          35000000, 'terbuka'),
 ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000021', 'Pipa baja',            21.0, 12.0, 2.5, 2.5, 'Jakarta',           -6.2088, 106.8456, 'Surabaya',           -7.2575, 112.7521, current_date + 6, 'Trailer Flatbed', 30000000, 'terbuka'),
 ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000022', 'Beton pracetak',       30.0,  8.0, 2.4, 2.4, 'Depok',             -6.4025, 106.7942, 'Bandung',            -6.9175, 107.6191, current_date + 3, 'Tronton Bak',     20000000, 'terbuka'),
 ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000022', 'Trafo besar',          15.0,  7.0, 3.0, 3.0, 'Jakarta',           -6.2088, 106.8456, 'Cirebon',            -6.7320, 108.5523, current_date + 7, 'Tronton Bak',     13000000, 'terbuka'),
 ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000022', 'Besi hollow',          20.0,  6.0, 2.2, 2.0, 'Sidoarjo',          -7.4478, 112.7183, 'Jakarta',            -6.2088, 106.8456, current_date + 2, 'Tronton Bak',     22000000, 'terbuka'),
 ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000021', 'Kertas gulung',        22.0,  8.0, 2.4, 2.3, 'Gresik',            -7.1554, 112.6556, 'Bekasi',             -6.2383, 106.9756, current_date + 3, 'Trailer Flatbed', 24000000, 'terbuka'),
 ('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000022', 'Plat baja',            26.0,  9.0, 2.5, 1.5, 'Malang',            -7.9666, 112.6326, 'Bandung',            -6.9175, 107.6191, current_date + 5, 'Trailer Flatbed', 27000000, 'terbuka'),
 ('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000021', 'Baja WF',              22.0,  9.0, 2.4, 2.2, 'Cikarang, Bekasi',  -6.3070, 107.1720, 'Cilegon',            -6.0024, 106.0110, current_date + 1, 'Tronton Bak',     14000000, 'terkunci'),
 ('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000022', 'Semen',                20.0,  6.0, 2.2, 2.2, 'Tangerang',         -6.1783, 106.6319, 'Serang',             -6.1201, 106.1503, current_date - 6, 'Tronton Bak',      6500000, 'selesai');

-- 5. Penawaran (sopir_id wajib diisi eksplisit karena trigger dimatikan)
insert into public.penawaran (id, muatan_id, armada_id, sopir_id, harga, status) values
 ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000011', 14000000, 'menunggu'),
 ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000014', 13500000, 'menunggu'),
 ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000012', 27000000, 'menunggu'),
 ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000012', 27500000, 'menunggu'),
 ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000011', 14000000, 'dipilih'),
 ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000014', 14500000, 'ditolak'),
 ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000014',  6500000, 'dipilih');

-- 6. Pengiriman dan riwayat status
insert into public.pengiriman (id, penawaran_id, muatan_id, customer_id, sopir_id, status, waktu_muat, waktu_tiba) values
 ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000011', 'memuat',  null, null),
 ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000014', 'selesai',
    now() - interval '5 days 20 hours', now() - interval '5 days 14 hours');

insert into public.log_status (pengiriman_id, status, waktu, catatan) values
 ('e0000000-0000-0000-0000-000000000001', 'menuju_muat',      now() - interval '2 hours',    'Penawaran dipilih customer'),
 ('e0000000-0000-0000-0000-000000000001', 'memuat',           now() - interval '30 minutes', 'Tiba di lokasi pemuatan'),
 ('e0000000-0000-0000-0000-000000000002', 'menuju_muat',      now() - interval '6 days',                   'Penawaran dipilih customer'),
 ('e0000000-0000-0000-0000-000000000002', 'memuat',           now() - interval '5 days 22 hours',          null),
 ('e0000000-0000-0000-0000-000000000002', 'dalam_perjalanan', now() - interval '5 days 20 hours',          'Berangkat dari gudang'),
 ('e0000000-0000-0000-0000-000000000002', 'tiba',             now() - interval '5 days 14 hours',          'Tiba di Serang'),
 ('e0000000-0000-0000-0000-000000000002', 'selesai',          now() - interval '5 days 13 hours',          'Bongkar selesai');

alter table public.penawaran enable trigger penawaran_validasi;

commit;

-- Ringkasan akun dummy (kata sandi semuanya: Dummy12345)
select u.email, p.role, p.status_verifikasi, p.nama
  from auth.users u join public.profiles p on p.id = u.id
 where u.email like '%@muatanku.test'
 order by case p.role when 'admin' then 0 when 'sopir' then 1 else 2 end, u.email;
