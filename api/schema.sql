-- schema.sql : jalankan di Supabase Dashboard > SQL Editor
-- Tabel profil + peran + status verifikasi, dengan keamanan baris (RLS).

create type user_role     as enum ('customer', 'sopir', 'admin');
create type verify_status as enum ('pending', 'verified', 'rejected');

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  nama              text not null default '',
  no_hp             text,
  role              user_role     not null default 'customer',
  status_verifikasi verify_status not null default 'pending',
  created_at        timestamptz   not null default now()
);

-- Buat profil otomatis saat ada akun baru.
-- Peran dari form hanya boleh 'sopir' atau 'customer'; 'admin' tidak bisa didaftarkan lewat form.
-- Sopir mulai 'pending' (menunggu admin); customer langsung 'verified'.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r user_role;
begin
  r := case when new.raw_user_meta_data->>'role' = 'sopir'
            then 'sopir'::user_role else 'customer'::user_role end;
  insert into public.profiles (id, nama, no_hp, role, status_verifikasi)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nama', ''),
          new.raw_user_meta_data->>'no_hp',
          r,
          case when r = 'sopir' then 'pending'::verify_status else 'verified'::verify_status end);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "baca profil sendiri" on public.profiles
  for select using (auth.uid() = id);
create policy "admin baca semua profil" on public.profiles
  for select using (public.is_admin());
create policy "admin ubah profil (verifikasi)" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());
-- Tidak ada policy update untuk pengguna biasa, jadi tidak ada yang bisa mengubah perannya sendiri.

-- Membuat akun admin: daftar dulu lewat form sebagai customer, lalu jalankan:
-- update public.profiles set role = 'admin', status_verifikasi = 'verified'
-- where id = (select id from auth.users where email = 'EMAIL-ADMIN-ANDA');
