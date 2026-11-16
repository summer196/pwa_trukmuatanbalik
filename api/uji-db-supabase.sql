-- uji-db-supabase.sql : menguji TC-19 (RLS), TC-20 (pemilihan penawaran), TC-24 (trigger validasi) dan alur status
-- langsung pada basis data, memakai data dari seed-dummy.sql.
--
-- CARA PAKAI (proyek uji Supabase):
--   1. Jalankan semua skema (schema*.sql) lalu seed-dummy.sql.
--   2. Tempel dan jalankan seluruh isi berkas ini di SQL Editor.
--   3. Hasilnya muncul sebagai PESAN GALAT berjudul "HASIL UJI DB". Itu disengaja: galat di akhir membatalkan
--      (rollback) semua perubahan yang dibuat selama uji, sehingga data seed tetap utuh.
--
-- Cara kerja: tiap uji meniru login sebuah peran (SET LOCAL ROLE authenticated + request.jwt.claim.sub = id pengguna)
-- lalu menjalankan kueri/penawaran/fungsi yang sama dengan yang dikirim aplikasi lewat API.
-- Telah dijalankan pada PostgreSQL 16 dengan tiruan lingkungan Supabase: 40 dari 40 lulus.
-- Belum pernah dijalankan pada proyek Supabase sungguhan; bila ada yang GAGAL di sana, periksa dulu apakah seed sudah dijalankan.

create temp table hasil (no serial, kelompok text, uji text, pola text, aktual text, lulus boolean);

create function pg_temp.sbg(p_user uuid, p_role text, p_sql text) returns text language plpgsql as $f$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  execute format('set local role %I', p_role);
  begin execute p_sql into r;
  exception when others then r := 'GALAT: ' || sqlerrm; end;
  reset role;
  return r;
end $f$;

create function pg_temp.cek(p_kel text, p_uji text, p_pola text, p_aktual text) returns void language sql as $f$
  insert into hasil (kelompok, uji, pola, aktual, lulus) values (p_kel, p_uji, p_pola, p_aktual, p_aktual like p_pola); $f$;

do $uji$
declare ringkas text; n_lulus int; n_total int;
begin
  perform pg_temp.cek('TC-19 RLS', 'customer.sinar hanya melihat muatan miliknya (5)', '5', pg_temp.sbg('a0000000-0000-0000-0000-000000000022'::uuid, 'authenticated', 'select count(*)::text from public.muatan'));
  perform pg_temp.cek('TC-19 RLS', 'sopir.budi melihat 10 muatan terbuka + 1 yang ditawarnya', '11', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', 'select count(*)::text from public.muatan'));
  perform pg_temp.cek('TC-19 RLS', 'sopir.joko (pending) tidak melihat muatan sama sekali', '0', pg_temp.sbg('a0000000-0000-0000-0000-000000000015'::uuid, 'authenticated', 'select count(*)::text from public.muatan'));
  perform pg_temp.cek('TC-19 RLS', 'anon tidak melihat muatan', '0', pg_temp.sbg(null::uuid, 'anon', 'select count(*)::text from public.muatan'));
  perform pg_temp.cek('TC-19 RLS', 'sopir tidak bisa menaikkan perannya sendiri (0 baris berubah)', '0', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', $q$with u as (update public.profiles set role='admin' where id='a0000000-0000-0000-0000-000000000011' returning 1) select count(*)::text from u$q$));
  perform pg_temp.cek('TC-19 RLS', 'sopir tidak bisa memverifikasi dirinya sendiri', '0', pg_temp.sbg('a0000000-0000-0000-0000-000000000015'::uuid, 'authenticated', $q$with u as (update public.profiles set status_verifikasi='verified' where id='a0000000-0000-0000-0000-000000000015' returning 1) select count(*)::text from u$q$));
  perform pg_temp.cek('TC-19 RLS', 'sopir tidak bisa menambah armada langsung berstatus verified', 'GALAT:%row-level security%', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', $q$with i as (insert into public.armada (pengguna_id, jenis_unit, plat_nomor, kapasitas_ton, panjang_m, lebar_m, tinggi_m, status_verifikasi) values ('a0000000-0000-0000-0000-000000000011','Lowbed','Z 1 ZZ',10,5,2,2,'verified') returning 1) select count(*)::text from i$q$));
  perform pg_temp.cek('TC-19 RLS', 'sopir hanya melihat armadanya sendiri (1)', '1', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', 'select count(*)::text from public.armada'));
  perform pg_temp.cek('TC-19 RLS', 'customer.maju melihat dirinya + 3 sopir yang menawar (4 profil)', '4', pg_temp.sbg('a0000000-0000-0000-0000-000000000021'::uuid, 'authenticated', 'select count(*)::text from public.profiles'));
  perform pg_temp.cek('TC-19 RLS', 'customer tidak bisa memposting muatan atas nama customer lain', 'GALAT:%row-level security%', pg_temp.sbg('a0000000-0000-0000-0000-000000000022'::uuid, 'authenticated', $q$with i as (insert into public.muatan (customer_id, jenis, berat_ton, panjang_m, lebar_m, tinggi_m, asal_nama, asal_lat, asal_lon, tujuan_nama, tujuan_lat, tujuan_lon, jadwal_muat, jenis_unit, harga) values ('a0000000-0000-0000-0000-000000000021','X',1,1,1,1,'a',0,0,'b',0,0,current_date,'Lowbed',1) returning 1) select count(*)::text from i$q$));
  perform pg_temp.cek('TC-19 RLS', 'admin melihat semua profil (9)', '9', pg_temp.sbg('a0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'select count(*)::text from public.profiles'));
  perform pg_temp.cek('TC-24 trigger', 'kelebihan berat (30 t > 25 t) ditolak', 'GALAT: Berat muatan%melebihi kapasitas%', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('with i as (insert into public.penawaran (muatan_id, armada_id, harga) values (%L, %L, 1000000) returning 1) select count(*)::text from i', 'c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001')));
  perform pg_temp.cek('TC-24 trigger', 'dimensi terlalu lebar ditolak', 'GALAT: Dimensi muatan melebihi%', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('with i as (insert into public.penawaran (muatan_id, armada_id, harga) values (%L, %L, 1000000) returning 1) select count(*)::text from i', 'c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001')));
  perform pg_temp.cek('TC-24 trigger', 'jenis unit berbeda ditolak', 'GALAT: Jenis unit tidak sesuai%', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('with i as (insert into public.penawaran (muatan_id, armada_id, harga) values (%L, %L, 1000000) returning 1) select count(*)::text from i', 'c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001')));
  perform pg_temp.cek('TC-24 trigger', 'sopir pending tidak boleh menawar', 'GALAT: Akun sopir belum diverifikasi admin.', pg_temp.sbg('a0000000-0000-0000-0000-000000000015'::uuid, 'authenticated', format('with i as (insert into public.penawaran (muatan_id, armada_id, harga) values (%L, %L, 1000000) returning 1) select count(*)::text from i', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006')));
  perform pg_temp.cek('TC-24 trigger', 'sopir berstatus rejected tidak boleh menawar', 'GALAT: Akun sopir belum diverifikasi admin.', pg_temp.sbg('a0000000-0000-0000-0000-000000000016'::uuid, 'authenticated', format('with i as (insert into public.penawaran (muatan_id, armada_id, harga) values (%L, %L, 1000000) returning 1) select count(*)::text from i', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000007')));
  perform pg_temp.cek('TC-24 trigger', 'tidak boleh memakai armada milik sopir lain', 'GALAT: Armada tidak ditemukan atau bukan milik Anda.', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('with i as (insert into public.penawaran (muatan_id, armada_id, harga) values (%L, %L, 1000000) returning 1) select count(*)::text from i', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002')));
  perform pg_temp.cek('TC-24 trigger', 'muatan terkunci tidak bisa ditawar lagi', 'GALAT: Muatan sudah tidak tersedia.', pg_temp.sbg('a0000000-0000-0000-0000-000000000014'::uuid, 'authenticated', format('with i as (insert into public.penawaran (muatan_id, armada_id, harga) values (%L, %L, 1000000) returning 1) select count(*)::text from i', 'c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000005')));
  perform pg_temp.cek('TC-24 trigger', 'penawaran sah (Budi pada m08) diterima', '1', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('with i as (insert into public.penawaran (muatan_id, armada_id, harga) values (%L, %L, 1000000) returning 1) select count(*)::text from i', 'c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001')));
  perform pg_temp.cek('TC-24 trigger', 'penawaran ganda armada yang sama ditolak', 'GALAT:%duplicate key%', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('with i as (insert into public.penawaran (muatan_id, armada_id, harga) values (%L, %L, 1000000) returning 1) select count(*)::text from i', 'c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001')));
  perform pg_temp.cek('TC-24 trigger', 'sopir_id dipaksa dari sesi, bukan dari kiriman klien', 'a0000000-0000-0000-0000-000000000012', pg_temp.sbg('a0000000-0000-0000-0000-000000000012'::uuid, 'authenticated', $q$with i as (insert into public.penawaran (muatan_id, armada_id, sopir_id, harga) values ('c0000000-0000-0000-0000-000000000009','b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000014',1) returning sopir_id) select sopir_id::text from i$q$));
  perform pg_temp.cek('TC-20 pilih', 'bukan pemilik muatan tidak boleh memilih', 'GALAT: Hanya pemilik muatan%', pg_temp.sbg('a0000000-0000-0000-0000-000000000022'::uuid, 'authenticated', $q$select public.pilih_penawaran('d0000000-0000-0000-0000-000000000001')::text$q$));
  perform pg_temp.cek('TC-20 pilih', 'anon tidak boleh memanggil fungsi', 'GALAT:%permission denied%', pg_temp.sbg(null::uuid, 'anon', $q$select public.pilih_penawaran('d0000000-0000-0000-0000-000000000001')::text$q$));
  perform pg_temp.cek('TC-20 pilih', 'pemilik memilih sopir: pengiriman dibuat', 'e%', 'e' || pg_temp.sbg('a0000000-0000-0000-0000-000000000021'::uuid, 'authenticated', $q$select public.pilih_penawaran('d0000000-0000-0000-0000-000000000001')::text$q$) || '');
  perform pg_temp.cek('TC-20 pilih', 'penawaran terpilih=dipilih, lainnya=ditolak', 'dipilih,ditolak', (select string_agg(status, ',' order by status) from (select status from public.penawaran where muatan_id = 'c0000000-0000-0000-0000-000000000001' order by status) s));
  perform pg_temp.cek('TC-20 pilih', 'muatan menjadi terkunci', 'terkunci', (select status from public.muatan where id = 'c0000000-0000-0000-0000-000000000001'));
  perform pg_temp.cek('TC-20 pilih', 'pilih kedua pada muatan yang sama ditolak', 'GALAT: Muatan ini sudah dikunci%', pg_temp.sbg('a0000000-0000-0000-0000-000000000021'::uuid, 'authenticated', $q$select public.pilih_penawaran('d0000000-0000-0000-0000-000000000002')::text$q$));
  perform pg_temp.cek('Status', 'sopir lain tidak bisa mengubah pengiriman', 'GALAT: Pengiriman tidak ditemukan.', pg_temp.sbg('a0000000-0000-0000-0000-000000000014'::uuid, 'authenticated', format('select public.ubah_status_pengiriman(''e0000000-0000-0000-0000-000000000001'', %L, null)::text', 'dalam_perjalanan')));
  perform pg_temp.cek('Status', 'customer tidak bisa mengubah status', 'GALAT: Pengiriman tidak ditemukan.', pg_temp.sbg('a0000000-0000-0000-0000-000000000021'::uuid, 'authenticated', format('select public.ubah_status_pengiriman(''e0000000-0000-0000-0000-000000000001'', %L, null)::text', 'dalam_perjalanan')));
  perform pg_temp.cek('Status', 'melompat status ditolak', 'GALAT: Status harus berurutan. Langkah berikutnya: dalam_perjalanan.', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('select public.ubah_status_pengiriman(''e0000000-0000-0000-0000-000000000001'', %L, null)::text', 'tiba')));
  perform pg_temp.cek('Status', 'memuat -> dalam_perjalanan', '', coalesce(pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('select public.ubah_status_pengiriman(''e0000000-0000-0000-0000-000000000001'', %L, null)::text', 'dalam_perjalanan')), ''));
  perform pg_temp.cek('Status', 'waktu_muat terisi saat berangkat', 'true', (select (waktu_muat is not null)::text from public.pengiriman where id = 'e0000000-0000-0000-0000-000000000001'));
  perform pg_temp.cek('Status', 'dalam_perjalanan -> tiba', '', coalesce(pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('select public.ubah_status_pengiriman(''e0000000-0000-0000-0000-000000000001'', %L, null)::text', 'tiba')), ''));
  perform pg_temp.cek('Status', 'tiba -> selesai', '', coalesce(pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('select public.ubah_status_pengiriman(''e0000000-0000-0000-0000-000000000001'', %L, null)::text', 'selesai')), ''));
  perform pg_temp.cek('Status', 'muatan ikut menjadi selesai', 'selesai', (select status from public.muatan where id = 'c0000000-0000-0000-0000-000000000011'));
  perform pg_temp.cek('Status', 'setelah selesai tidak bisa diubah lagi', 'GALAT: Pengiriman sudah selesai.', pg_temp.sbg('a0000000-0000-0000-0000-000000000011'::uuid, 'authenticated', format('select public.ubah_status_pengiriman(''e0000000-0000-0000-0000-000000000001'', %L, null)::text', 'selesai')));
  perform pg_temp.cek('Status', 'riwayat status lengkap (5 baris)', '5', (select count(*)::text from public.log_status where pengiriman_id = 'e0000000-0000-0000-0000-000000000001'));
  perform pg_temp.cek('TC-19 RLS', 'admin dapat memverifikasi sopir.joko', '1', pg_temp.sbg('a0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', $q$with u as (update public.profiles set status_verifikasi='verified' where id='a0000000-0000-0000-0000-000000000015' returning 1) select count(*)::text from u$q$));
  perform pg_temp.cek('TC-19 RLS', 'admin dapat memverifikasi unit milik joko', '1', pg_temp.sbg('a0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', $q$with u as (update public.armada set status_verifikasi='verified' where id='b0000000-0000-0000-0000-000000000006' returning 1) select count(*)::text from u$q$));
  perform pg_temp.cek('TC-19 RLS', 'admin dapat memposting muatan sendiri (kebijakan admin-full-akses)', '1', pg_temp.sbg('a0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', $q$with i as (insert into public.muatan (customer_id, jenis, berat_ton, panjang_m, lebar_m, tinggi_m, asal_nama, asal_lat, asal_lon, tujuan_nama, tujuan_lat, tujuan_lon, jadwal_muat, jenis_unit, harga) values ('a0000000-0000-0000-0000-000000000001','X',1,1,1,1,'a',0,0,'b',0,0,current_date,'Lowbed',1) returning 1) select count(*)::text from i$q$));

  select count(*) filter (where lulus), count(*) into n_lulus, n_total from hasil;
  select string_agg(case when lulus then 'LULUS  ' else 'GAGAL  ' end || rpad(kelompok, 14) || uji || case when lulus then '' else '   [diharapkan: ' || pola || ' | didapat: ' || coalesce(aktual, 'NULL') || ']' end, E'\n' order by no)
    into ringkas from hasil;
  raise exception E'HASIL UJI DB (semua perubahan sudah di-rollback)\n% dari % uji lulus\n\n%', n_lulus, n_total, ringkas;
end $uji$;
