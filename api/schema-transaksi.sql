-- schema-transaksi.sql : jalankan di Supabase SQL Editor SETELAH
-- schema.sql, schema-armada-muatan.sql, dan schema-pencarian.sql.
-- Alur: sopir menawar -> customer memilih satu penawaran (muatan terkunci) -> sopir memperbarui status sampai selesai.

/* ---------- Tabel ---------- */
create table public.penawaran (
  id         uuid primary key default gen_random_uuid(),
  muatan_id  uuid not null references public.muatan(id)    on delete cascade,
  armada_id  uuid not null references public.armada(id)    on delete cascade,
  sopir_id   uuid not null references public.profiles(id)  on delete cascade default auth.uid(),
  harga      numeric(14,0) not null check (harga >= 0),
  status     text not null default 'menunggu' check (status in ('menunggu','dipilih','ditolak')),
  created_at timestamptz not null default now(),
  unique (muatan_id, armada_id)
);

create table public.pengiriman (
  id           uuid primary key default gen_random_uuid(),
  penawaran_id uuid not null unique references public.penawaran(id) on delete cascade,
  muatan_id    uuid not null references public.muatan(id)   on delete cascade,
  customer_id  uuid not null references public.profiles(id) on delete cascade,
  sopir_id     uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'menuju_muat'
               check (status in ('menuju_muat','memuat','dalam_perjalanan','tiba','selesai')),
  waktu_muat   timestamptz,
  waktu_tiba   timestamptz,
  created_at   timestamptz not null default now()
);

create table public.log_status (
  id            uuid primary key default gen_random_uuid(),
  pengiriman_id uuid not null references public.pengiriman(id) on delete cascade,
  status        text not null,
  waktu         timestamptz not null default now(),
  catatan       text
);

create index penawaran_muatan_idx   on public.penawaran (muatan_id);
create index penawaran_sopir_idx    on public.penawaran (sopir_id);
create index pengiriman_sopir_idx   on public.pengiriman (sopir_id);
create index pengiriman_customer_idx on public.pengiriman (customer_id);
create index log_status_kirim_idx   on public.log_status (pengiriman_id, waktu);

/* ---------- Fungsi bantu untuk RLS (security definer agar tidak terjadi rekursi antar-policy) ---------- */
create function public.pemilik_muatan(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.muatan where id = p and customer_id = auth.uid()); $$;

create function public.sopir_penawar_muatan(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.penawaran where muatan_id = p and sopir_id = auth.uid()); $$;

create function public.customer_dari_armada(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.penawaran w join public.muatan m on m.id = w.muatan_id
                 where w.armada_id = p and m.customer_id = auth.uid()); $$;

create function public.customer_dari_sopir(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.penawaran w join public.muatan m on m.id = w.muatan_id
                 where w.sopir_id = p and m.customer_id = auth.uid()); $$;

create function public.sopir_dari_customer(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pengiriman where customer_id = p and sopir_id = auth.uid()); $$;

/* ---------- Validasi penawaran di server (cermin dari SearchEngine.cekKompatibilitas) ---------- */
create function public.validasi_penawaran() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.muatan; a public.armada; lantai_ok boolean;
begin
  new.sopir_id := auth.uid();                      -- tidak bisa menawar atas nama orang lain

  if not exists (select 1 from public.profiles
                 where id = new.sopir_id and role = 'sopir' and status_verifikasi = 'verified') then
    raise exception 'Akun sopir belum diverifikasi admin.';
  end if;

  select * into a from public.armada where id = new.armada_id and pengguna_id = new.sopir_id;
  if not found then raise exception 'Armada tidak ditemukan atau bukan milik Anda.'; end if;
  if a.status_verifikasi <> 'verified' then raise exception 'Armada belum diverifikasi admin.'; end if;

  select * into m from public.muatan where id = new.muatan_id;
  if not found or m.status <> 'terbuka' then raise exception 'Muatan sudah tidak tersedia.'; end if;

  if m.berat_ton > a.kapasitas_ton then
    raise exception 'Berat muatan (% ton) melebihi kapasitas armada (% ton).', m.berat_ton, a.kapasitas_ton;
  end if;
  if lower(trim(m.jenis_unit)) <> lower(trim(a.jenis_unit)) then
    raise exception 'Jenis unit tidak sesuai: muatan butuh %, armada Anda %.', m.jenis_unit, a.jenis_unit;
  end if;
  lantai_ok := (m.panjang_m <= a.panjang_m and m.lebar_m <= a.lebar_m)
            or (m.lebar_m  <= a.panjang_m and m.panjang_m <= a.lebar_m);
  if not lantai_ok or m.tinggi_m > a.tinggi_m then
    raise exception 'Dimensi muatan melebihi dimensi bak armada.';
  end if;
  return new;
end $$;

create trigger penawaran_validasi before insert on public.penawaran
  for each row execute function public.validasi_penawaran();

/* ---------- RPC: customer memilih satu penawaran (atomik) ---------- */
create function public.pilih_penawaran(p_penawaran uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare w public.penawaran; m public.muatan; id_kirim uuid;
begin
  select * into w from public.penawaran where id = p_penawaran for update;
  if not found then raise exception 'Penawaran tidak ditemukan.'; end if;
  select * into m from public.muatan where id = w.muatan_id for update;
  if m.customer_id is distinct from auth.uid() then
    raise exception 'Hanya pemilik muatan yang boleh memilih penawaran.';
  end if;
  if m.status <> 'terbuka' or w.status <> 'menunggu' then
    raise exception 'Muatan ini sudah dikunci atau penawaran tidak lagi berlaku.';
  end if;

  update public.penawaran set status = case when id = p_penawaran then 'dipilih' else 'ditolak' end
   where muatan_id = m.id;
  update public.muatan set status = 'terkunci' where id = m.id;
  insert into public.pengiriman (penawaran_id, muatan_id, customer_id, sopir_id)
    values (w.id, m.id, m.customer_id, w.sopir_id) returning id into id_kirim;
  insert into public.log_status (pengiriman_id, status, catatan)
    values (id_kirim, 'menuju_muat', 'Penawaran dipilih customer');
  return id_kirim;
end $$;

/* ---------- RPC: sopir memperbarui status (harus berurutan) ---------- */
create function public.ubah_status_pengiriman(p_pengiriman uuid, p_status text, p_catatan text default null)
returns void language plpgsql security definer set search_path = public as $$
declare g public.pengiriman; i_lama int; i_baru int;
        urutan text[] := array['menuju_muat','memuat','dalam_perjalanan','tiba','selesai'];
begin
  select * into g from public.pengiriman where id = p_pengiriman for update;
  if not found or g.sopir_id is distinct from auth.uid() then raise exception 'Pengiriman tidak ditemukan.'; end if;

  i_lama := array_position(urutan, g.status);
  i_baru := array_position(urutan, p_status);
  if i_baru is null then raise exception 'Status tidak dikenal.'; end if;
  if i_lama = 5 then raise exception 'Pengiriman sudah selesai.'; end if;
  if i_baru <> i_lama + 1 then
    raise exception 'Status harus berurutan. Langkah berikutnya: %.', urutan[i_lama + 1];
  end if;

  update public.pengiriman set status = p_status,
         waktu_muat = case when p_status = 'dalam_perjalanan' then now() else waktu_muat end,
         waktu_tiba = case when p_status = 'tiba'             then now() else waktu_tiba end
   where id = g.id;
  if p_status = 'selesai' then update public.muatan set status = 'selesai' where id = g.muatan_id; end if;
  insert into public.log_status (pengiriman_id, status, catatan) values (g.id, p_status, nullif(trim(p_catatan), ''));
end $$;

revoke all on function public.pilih_penawaran(uuid) from public, anon;
revoke all on function public.ubah_status_pengiriman(uuid, text, text) from public, anon;
grant execute on function public.pilih_penawaran(uuid) to authenticated;
grant execute on function public.ubah_status_pengiriman(uuid, text, text) to authenticated;

/* ---------- RLS ---------- */
alter table public.penawaran  enable row level security;
alter table public.pengiriman enable row level security;
alter table public.log_status enable row level security;

create policy "sopir baca penawaran sendiri"   on public.penawaran for select using (sopir_id = auth.uid());
create policy "customer baca penawaran muatannya" on public.penawaran for select using (public.pemilik_muatan(muatan_id));
create policy "admin baca semua penawaran"     on public.penawaran for select using (public.is_admin());
create policy "sopir buat penawaran"           on public.penawaran for insert with check (sopir_id = auth.uid());
create policy "sopir tarik penawaran"          on public.penawaran for delete using (sopir_id = auth.uid() and status = 'menunggu');
-- Tidak ada policy update/insert langsung untuk pengiriman dan log_status: hanya lewat dua fungsi RPC di atas.

create policy "pihak terkait baca pengiriman"  on public.pengiriman for select
  using (customer_id = auth.uid() or sopir_id = auth.uid() or public.is_admin());
create policy "pihak terkait baca log status"  on public.log_status for select
  using (exists (select 1 from public.pengiriman g where g.id = pengiriman_id));

-- Akses tambahan pada tabel yang sudah ada (data yang memang perlu dilihat pihak terkait)
create policy "sopir baca muatan yang ditawarnya"    on public.muatan   for select using (public.sopir_penawar_muatan(id));
create policy "customer baca armada penawar"         on public.armada   for select using (public.customer_dari_armada(id));
create policy "customer baca profil sopir penawar"   on public.profiles for select using (public.customer_dari_sopir(id));
create policy "sopir baca profil customer pengiriman" on public.profiles for select using (public.sopir_dari_customer(id));

/* ---------- Realtime (muatan baru, penawaran baru, perubahan status) ---------- */
alter publication supabase_realtime add table public.muatan, public.penawaran, public.pengiriman;
