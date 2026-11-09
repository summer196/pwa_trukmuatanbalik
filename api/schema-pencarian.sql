-- schema-pencarian.sql : jalankan di Supabase SQL Editor setelah schema-armada-muatan.sql

-- Sopir TERVERIFIKASI boleh melihat muatan yang masih terbuka (untuk pencarian).
create policy "sopir terverifikasi baca muatan terbuka" on public.muatan
  for select using (
    status = 'terbuka'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'sopir' and p.status_verifikasi = 'verified'));

-- Mempercepat penyaringan kotak lintang/bujur untuk muatan terbuka.
create index muatan_asal_terbuka_idx on public.muatan (asal_lat, asal_lon) where status = 'terbuka';
