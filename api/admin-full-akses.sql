-- admin-full-akses.sql
-- Jalankan di Supabase Dashboard > SQL Editor
-- Memberikan izin penuh kepada akun Admin untuk posting muatan, mengubah, dan menghapus muatan tanpa perlu akun customer.

-- 1. Admin boleh posting muatan baru
create policy "admin posting muatan" on public.muatan
  for insert with check (
    customer_id = auth.uid()
    and public.is_admin());

-- 2. Admin boleh mengubah muatan apapun
create policy "admin ubah muatan" on public.muatan
  for update using (public.is_admin()) with check (public.is_admin());

-- 3. Admin boleh menghapus muatan apapun
create policy "admin hapus muatan" on public.muatan
  for delete using (public.is_admin());
