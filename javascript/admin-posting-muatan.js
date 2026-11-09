/* admin-posting-muatan.js
   Modul bagi admin untuk membuat, memposting, dan mengelola muatan secara langsung.
   Bergantung pada: supabase-config.js, auth.js, dashboard.js, map.js */

const CONTOH_MUATAN_ADMIN = ['Trafo', 'Baja Profil', 'Semen Curah', 'Alat Berat Excavator', 'Pipa Besi', 'Beton Pracetak', 'Batu Bara', 'Bahan Konstruksi'];

function mountAdminPostingMuatan(root, ctx) {
  const profile = ctx.profile;
  const wadah = el('div', { class: 'admin-module dash-grid' });
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const daftarEl = el('div', { class: 'dash-list' });

  // Form Posting Muatan
  const form = el('form', { class: 'dash-form' },
    field('Jenis muatan', input('jenis', 'text', { required: true, list: 'contoh-muatan-admin', placeholder: 'Contoh: Trafo' })),
    el('datalist', { id: 'contoh-muatan-admin' }, CONTOH_MUATAN_ADMIN.map((m) => el('option', { value: m }))),
    field('Berat (ton)', numberInput('berat_ton')),
    dimensiFieldset('Dimensi muatan (meter)'),
    lokasiField('asal', 'Lokasi asal (muat)'),
    lokasiField('tujuan', 'Lokasi tujuan (bongkar)'),
    field('Jadwal muat', input('jadwal_muat', 'date', { required: true, min: hariIni() })),
    field('Jenis unit yang dibutuhkan', select('jenis_unit', JENIS_UNIT)),
    field('Harga tawaran (Rp)', numberInput('harga', { min: '0', step: '1000', inputmode: 'numeric' })),
    msg,
    el('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Posting Muatan Baru'));

  const formSection = el('section', { class: 'dash-card' },
    el('h2', {}, 'Posting Muatan'),
    el('p', { class: 'dash-meta', style: 'margin-bottom:14px' }, 'Admin dapat langsung memposting muatan untuk menguji alur penawaran dan pencarian muatan sopir.'),
    form);

  const listSection = el('section', { class: 'dash-card' },
    el('h2', {}, 'Daftar Muatan Aktif'),
    daftarEl);

  wadah.append(formSection, listSection);
  root.replaceChildren(wadah);

  async function muatDaftar() {
    setMsg(msg, 'Memuat daftar muatan...', 'ok');
    const { data, error } = await supabaseClient
      .from('muatan')
      .select('*, customer:customer_id(nama, no_hp)')
      .order('created_at', { ascending: false });

    if (error) {
      daftarEl.replaceChildren(kosong(pesanDb(error)));
      return;
    }
    setMsg(msg, '');
    const list = data || [];
    daftarEl.replaceChildren(...(list.length ? list.map(kartuMuatan) : [kosong('Belum ada muatan yang diposting. Gunakan form di sebelah kiri untuk memposting muatan pertama.')]));
  }

  function kartuMuatan(m) {
    const STATUS_MAP = {
      terbuka: ['Terbuka', 'ok'],
      terkunci: ['Sopir Dipilih', 'wait'],
      selesai: ['Selesai', 'ok'],
      dibatalkan: ['Dibatalkan', 'no'],
    };
    const [labelStatus, tone] = STATUS_MAP[m.status] || [m.status, 'wait'];

    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' },
        el('strong', {}, `${m.jenis}, ${m.berat_ton} ton`),
        badge(labelStatus, tone)),
      el('p', {}, `${m.asal_nama} ke ${m.tujuan_nama}`),
      el('p', { class: 'dash-meta' }, `Unit: ${m.jenis_unit}, Jadwal: ${tanggal(m.jadwal_muat)}, Tawaran: ${rupiah(m.harga)}`),
      el('p', { class: 'dash-meta' }, `Ukuran: ${m.panjang_m} x ${m.lebar_m} x ${m.tinggi_m} m`),
      m.customer ? el('p', { class: 'dash-meta' }, `Diposting oleh: ${m.customer.nama || 'Pengguna'} (${m.customer.no_hp || '-'})`) : null,
      el('div', { class: 'dash-actions', style: 'margin-top:8px' },
        el('button', {
          type: 'button', class: 'btn btn--ghost dash-btn-sm',
          onclick: async () => {
            if (!confirm(`Hapus muatan "${m.jenis}" (${m.asal_nama} ke ${m.tujuan_nama})?`)) return;
            const { error } = await supabaseClient.from('muatan').delete().eq('id', m.id);
            if (error) setMsg(msg, pesanDb(error));
            else muatDaftar();
          },
        }, 'Hapus Muatan')));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.asal_lat || !d.tujuan_lat) {
      setMsg(msg, 'Tentukan titik asal dan tujuan menggunakan tombol "Cari titik" atau "Pilih di Peta".');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    setMsg(msg, 'Menyimpan muatan...', 'ok');

    const { error } = await supabaseClient.from('muatan').insert({
      customer_id: profile.id,
      jenis: d.jenis.trim(),
      berat_ton: Number(d.berat_ton),
      panjang_m: Number(d.panjang_m),
      lebar_m: Number(d.lebar_m),
      tinggi_m: Number(d.tinggi_m),
      asal_nama: d.asal_nama.trim(),
      asal_lat: Number(d.asal_lat),
      asal_lon: Number(d.asal_lon),
      tujuan_nama: d.tujuan_nama.trim(),
      tujuan_lat: Number(d.tujuan_lat),
      tujuan_lon: Number(d.tujuan_lon),
      jadwal_muat: d.jadwal_muat,
      jenis_unit: d.jenis_unit,
      harga: Number(d.harga),
      status: 'terbuka',
    });

    btn.disabled = false;
    if (error) {
      setMsg(msg, pesanDb(error));
      return;
    }

    form.reset();
    form.querySelectorAll('[name$="_nama"]').forEach((i) => i.dispatchEvent(new Event('input')));
    setMsg(msg, 'Muatan berhasil diposting. Sekarang dapat dicari di menu Cari Muatan.', 'ok');
    muatDaftar();
  });

  muatDaftar();
}
