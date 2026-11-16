-- seed-hapus-dummy.sql : menghapus SEMUA data dummy dari seed-dummy.sql (akun, profil, armada, muatan,
-- penawaran, pengiriman, dan riwayat status). Data milik akun lain tidak tersentuh.
delete from auth.users where email like '%@muatanku.test';
