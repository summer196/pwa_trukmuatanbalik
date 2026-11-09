/* customer-dashboard.js - Posting Muatan untuk customer.
   Bergantung pada: supabase-config.js, auth.js, dashboard.js */

const STATUS_MUATAN = {
  terbuka: ['Terbuka', 'ok'],
  terkunci: ['Terkunci', 'wait'],
  selesai: ['Selesai', 'ok'],
  dibatalkan: ['Dibatalkan', 'no'],
};
const CONTOH_MUATAN = ['Trafo', 'Baja', 'Semen', 'Alat berat', 'Pipa', 'Beton pracetak'];

async function mountCustomerDashboard(root, profile) {
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const daftar = el('div', { class: 'dash-list' });

  const form = el('form', { class: 'dash-form' },
    field('Jenis muatan', input('jenis', 'text', { required: true, list: 'contoh-muatan', placeholder: 'Contoh: Trafo' })),
    el('datalist', { id: 'contoh-muatan' }, CONTOH_MUATAN.map((m) => el('option', { value: m }))),
    field('Berat (ton)', numberInput('berat_ton')),
    dimensiFieldset('Dimensi muatan (meter)'),
    lokasiField('asal', 'Lokasi asal (muat)'),
    lokasiField('tujuan', 'Lokasi tujuan (bongkar)'),
    field('Jadwal muat', input('jadwal_muat', 'date', { required: true, min: hariIni() })),
    field('Jenis unit yang dibutuhkan', select('jenis_unit', JENIS_UNIT)),
    field('Harga tawaran (Rp)', numberInput('harga', { min: '0', step: '1000', inputmode: 'numeric' })),
    msg,
    el('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Posting muatan'));

  root.replaceChildren(el('div', { class: 'dash-grid' },
    el('section', { class: 'dash-card' }, el('h2', {}, 'Muatan baru'), form),
    el('section', { class: 'dash-card' }, el('h2', {}, 'Muatan Anda'), daftar)));

  async function muatDaftar() {
    const { data, error } = await supabaseClient.from('muatan').select('*').order('created_at', { ascending: false });
    if (error) { daftar.replaceChildren(el('p', { class: 'dash-empty' }, pesanDb(error))); return; }
    if (!data.length) { daftar.replaceChildren(el('p', { class: 'dash-empty' }, 'Belum ada muatan. Isi form untuk memposting muatan pertama Anda.')); return; }
    daftar.replaceChildren(...data.map(kartuMuatan));
  }

  function kartuMuatan(m) {
    const [label, tone] = STATUS_MUATAN[m.status] || STATUS_MUATAN.terbuka;
    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, `${m.jenis}, ${m.berat_ton} ton`), badge(label, tone)),
      el('p', {}, `${m.asal_nama} ke ${m.tujuan_nama}`),
      el('p', { class: 'dash-meta' }, `Muat ${tanggal(m.jadwal_muat)}, ${m.jenis_unit}, ${rupiah(m.harga)}`),
      el('p', { class: 'dash-meta' }, `Dimensi ${m.panjang_m} x ${m.lebar_m} x ${m.tinggi_m} m`),
      m.status === 'terbuka' ? el('button', {
        type: 'button', class: 'btn btn--ghost dash-btn-sm',
        onclick: async () => {
          if (!confirm('Hapus muatan ini?')) return;
          const { error } = await supabaseClient.from('muatan').delete().eq('id', m.id);
          if (error) setMsg(msg, pesanDb(error)); else muatDaftar();
        },
      }, 'Hapus') : null);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.asal_lat || !d.tujuan_lat) { setMsg(msg, 'Tentukan titik asal dan tujuan dengan tombol "Cari titik".'); return; }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; setMsg(msg, 'Menyimpan...', 'ok');
    const { error } = await supabaseClient.from('muatan').insert({
      customer_id: profile.id,
      jenis: d.jenis.trim(), berat_ton: Number(d.berat_ton),
      panjang_m: Number(d.panjang_m), lebar_m: Number(d.lebar_m), tinggi_m: Number(d.tinggi_m),
      asal_nama: d.asal_nama.trim(), asal_lat: Number(d.asal_lat), asal_lon: Number(d.asal_lon),
      tujuan_nama: d.tujuan_nama.trim(), tujuan_lat: Number(d.tujuan_lat), tujuan_lon: Number(d.tujuan_lon),
      jadwal_muat: d.jadwal_muat, jenis_unit: d.jenis_unit, harga: Number(d.harga),
      status: 'terbuka',
    });
    btn.disabled = false;
    if (error) { setMsg(msg, pesanDb(error)); return; }

    form.reset();
    form.querySelectorAll('[name$="_nama"]').forEach((i) => i.dispatchEvent(new Event('input'))); // kosongkan koordinat
    setMsg(msg, 'Muatan berhasil diposting.', 'ok');
    muatDaftar();
  });

  muatDaftar();
}
