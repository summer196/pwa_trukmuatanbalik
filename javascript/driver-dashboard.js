/* driver-dashboard.js - Profil Armada untuk sopir.
   Bergantung pada: supabase-config.js, auth.js, dashboard.js */

const STATUS_ARMADA = {
  pending: ['Menunggu verifikasi', 'wait'],
  verified: ['Terverifikasi', 'ok'],
  rejected: ['Ditolak', 'no'],
};

function normalisasiPlat(s) { return s.toUpperCase().replace(/\s+/g, ' ').trim(); }

async function mountDriverDashboard(root, profile) {
  const msg = el('p', { class: 'dash-msg', role: 'status' });
  const daftar = el('div', { class: 'dash-list' });

  const form = el('form', { class: 'dash-form' },
    field('Jenis unit', select('jenis_unit', JENIS_UNIT)),
    field('Plat nomor', input('plat_nomor', 'text', {
      required: true, autocapitalize: 'characters', placeholder: 'B 1234 XYZ',
      pattern: '[A-Za-z]{1,2} ?[0-9]{1,4} ?[A-Za-z]{0,3}', title: 'Contoh: B 1234 XYZ',
    })),
    field('Kapasitas maksimal (ton)', numberInput('kapasitas_ton', { min: '1', max: '100' })),
    dimensiFieldset('Dimensi bak (meter)'),
    msg,
    el('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Simpan armada'));

  root.replaceChildren(el('div', { class: 'dash-grid' },
    el('section', { class: 'dash-card' }, el('h2', {}, 'Tambah armada'), form),
    el('section', { class: 'dash-card' }, el('h2', {}, 'Armada Anda'), daftar)));

  async function muatDaftar() {
    const { data, error } = await supabaseClient.from('armada').select('*').order('created_at', { ascending: false });
    if (error) { daftar.replaceChildren(el('p', { class: 'dash-empty' }, pesanDb(error))); return; }
    if (!data.length) { daftar.replaceChildren(el('p', { class: 'dash-empty' }, 'Belum ada armada. Isi form untuk menambahkan unit pertama Anda.')); return; }
    daftar.replaceChildren(...data.map(kartuArmada));
  }

  function kartuArmada(a) {
    const [label, tone] = STATUS_ARMADA[a.status_verifikasi] || STATUS_ARMADA.pending;
    return el('article', { class: 'dash-item' },
      el('div', { class: 'dash-item__head' }, el('strong', {}, a.plat_nomor), badge(label, tone)),
      el('p', {}, `${a.jenis_unit}, kapasitas ${a.kapasitas_ton} ton`),
      el('p', { class: 'dash-meta' }, `Bak ${a.panjang_m} x ${a.lebar_m} x ${a.tinggi_m} m`),
      el('button', {
        type: 'button', class: 'btn btn--ghost dash-btn-sm',
        onclick: async () => {
          if (!confirm(`Hapus armada ${a.plat_nomor}?`)) return;
          const { error } = await supabaseClient.from('armada').delete().eq('id', a.id);
          if (error) setMsg(msg, pesanDb(error)); else muatDaftar();
        },
      }, 'Hapus'));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; setMsg(msg, 'Menyimpan...', 'ok');
    const { error } = await supabaseClient.from('armada').insert({
      pengguna_id: profile.id,
      jenis_unit: d.jenis_unit,
      plat_nomor: normalisasiPlat(d.plat_nomor),
      kapasitas_ton: Number(d.kapasitas_ton),
      panjang_m: Number(d.panjang_m), lebar_m: Number(d.lebar_m), tinggi_m: Number(d.tinggi_m),
      status_verifikasi: 'pending', // wajib 'pending'; hanya admin yang bisa memverifikasi
    });
    btn.disabled = false;
    if (error) { setMsg(msg, pesanDb(error)); return; }
    form.reset(); setMsg(msg, 'Armada tersimpan dan menunggu verifikasi admin.', 'ok');
    muatDaftar();
  });

  muatDaftar();
}
