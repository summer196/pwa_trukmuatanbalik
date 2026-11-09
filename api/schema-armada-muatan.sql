-- schema-armada-muatan.sql : jalankan di Supabase SQL Editor SETELAH schema.sql
-- Tabel armada (milik sopir) dan muatan (milik customer), lengkap dengan RLS.

create table public.armada (
  id                uuid primary key default gen_random_uuid(),
  pengguna_id       uuid not null references public.profiles(id) on delete cascade,
  jenis_unit        text not null,
  plat_nomor        text not null unique,
  kapasitas_ton     numeric(5,1) not null check (kapasitas_ton > 0 and kapasitas_ton <= 100),
  panjang_m         numeric(4,1) not null check (panjang_m > 0),
  lebar_m           numeric(4,1) not null check (lebar_m  > 0),
  tinggi_m          numeric(4,1) not null check (tinggi_m > 0),
  status_verifikasi verify_status not null default 'pending',
  created_at        timestamptz not null default now()
);

create table public.muatan (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.profiles(id) on delete cascade,
  jenis        text not null,
  berat_ton    numeric(6,1) not null check (berat_ton > 0),
  panjang_m    numeric(5,1) not null check (panjang_m > 0),
  lebar_m      numeric(5,1) not null check (lebar_m  > 0),
  tinggi_m     numeric(5,1) not null check (tinggi_m > 0),
  asal_nama    text not null,
  asal_lat     double precision not null check (asal_lat  between -90  and 90),
  asal_lon     double precision not null check (asal_lon  between -180 and 180),
  tujuan_nama  text not null,
  tujuan_lat   double precision not null check (tujuan_lat between -90  and 90),
  tujuan_lon   double precision not null check (tujuan_lon between -180 and 180),
  jadwal_muat  date not null,
  jenis_unit   text not null,
  harga        numeric(14,0) not null check (harga >= 0),
  status       text not null default 'terbuka' check (status in ('terbuka','terkunci','selesai','dibatalkan')),
  created_at   timestamptz not null default now()
);

alter table public.armada enable row level security;
alter table public.muatan enable row level security;

-- ARMADA: sopir hanya mengelola miliknya; unit baru/yang diubah selalu 'pending' (admin yang memverifikasi)
create policy "sopir baca armada sendiri" on public.armada
  for select using (pengguna_id = auth.uid());
create policy "sopir tambah armada" on public.armada
  for insert with check (
    pengguna_id = auth.uid() and status_verifikasi = 'pending'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'sopir'));
create policy "sopir ubah armada (kembali pending)" on public.armada
  for update using (pengguna_id = auth.uid())
  with check (pengguna_id = auth.uid() and status_verifikasi = 'pending');
create policy "sopir hapus armada sendiri" on public.armada
  for delete using (pengguna_id = auth.uid());
create policy "admin baca semua armada" on public.armada
  for select using (public.is_admin());
create policy "admin verifikasi armada" on public.armada
  for update using (public.is_admin()) with check (public.is_admin());

-- MUATAN: customer hanya mengelola miliknya; muatan baru selalu 'terbuka'
create policy "customer baca muatan sendiri" on public.muatan
  for select using (customer_id = auth.uid());
create policy "customer posting muatan" on public.muatan
  for insert with check (
    customer_id = auth.uid() and status = 'terbuka'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer'));
create policy "customer hapus muatan terbuka" on public.muatan
  for delete using (customer_id = auth.uid() and status = 'terbuka');
create policy "admin baca semua muatan" on public.muatan
  for select using (public.is_admin());
create policy "admin posting muatan" on public.muatan
  for insert with check (
    customer_id = auth.uid() and public.is_admin());
create policy "admin ubah muatan" on public.muatan
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin hapus muatan" on public.muatan
  for delete using (public.is_admin());
-- Akses sopir untuk MENCARI muatan terbuka ditambahkan di langkah pencarian.
