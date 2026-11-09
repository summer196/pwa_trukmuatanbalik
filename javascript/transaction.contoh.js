/* transaction.contoh.js
   CONTOH pemakaian Transaksi di UI. Tidak dimuat di halaman mana pun; salin polanya ke
   driver-dashboard.js dan customer-dashboard.js. Butuh: dashboard.js (el, badge, setMsg, rupiah), transaction.js */

/* --- SOPIR: tombol Tawar pada kartu hasil pencarian (lihat kartuHasil di search-engine.contoh.js) --- */
async function contohTawar(m, msgEl) {
  const armada = m.kompatibilitas.armadaCocok[0];                    // armada terverifikasi yang cocok
  const input = prompt('Harga tawaran (Rp):', String(m.harga));
  if (input === null) return;
  const r = await Transaksi.buatPenawaran({ muatan: m, armada, harga: input });
  setMsg(msgEl, r.ok ? 'Penawaran terkirim. Menunggu customer memilih.' : r.message, r.ok ? 'ok' : 'error');
}

/* --- CUSTOMER: daftar penawaran untuk satu muatan + tombol Pilih --- */
async function contohDaftarPenawaran(muatan, wadah, msgEl, muatUlang) {
  const r = await Transaksi.penawaranUntukMuatan(muatan.id);
  if (!r.ok) { setMsg(msgEl, r.message); return; }
  wadah.replaceChildren(...(r.data.length ? r.data : []).map((w) => el('article', { class: 'dash-item' },
    el('div', { class: 'dash-item__head' }, el('strong', {}, w.sopir ? w.sopir.nama : 'Sopir'), el('strong', {}, rupiah(w.harga))),
    el('p', { class: 'dash-meta' }, `${w.armada.plat_nomor}, ${w.armada.jenis_unit}, ${w.armada.kapasitas_ton} ton`),
    muatan.status === 'terbuka' ? el('button', {
      type: 'button', class: 'btn btn--primary dash-btn-sm',
      onclick: async () => {
        if (!confirm('Pilih sopir ini? Penawaran lain akan ditolak.')) return;
        const p = await Transaksi.pilihPenawaran(w.id);
        setMsg(msgEl, p.ok ? 'Sopir dipilih. Pengiriman dibuat.' : p.message, p.ok ? 'ok' : 'error');
        if (p.ok) muatUlang();
      },
    }, 'Pilih sopir') : null)));
}

/* --- SOPIR: kartu pengiriman dengan tombol status berikutnya --- */
function contohKartuPengiriman(g, msgEl, muatUlang) {
  const berikut = Transaksi.statusBerikutnya(g.status);
  return el('article', { class: 'dash-item' },
    el('div', { class: 'dash-item__head' }, el('strong', {}, `${g.muatan.jenis}, ${g.muatan.berat_ton} ton`), badge(Transaksi.LABEL_STATUS[g.status], g.status === 'selesai' ? 'ok' : 'wait')),
    el('p', {}, `${g.muatan.asal_nama} ke ${g.muatan.tujuan_nama}`),
    berikut ? el('button', {
      type: 'button', class: 'btn btn--primary dash-btn-sm',
      onclick: async () => {
        const r = await Transaksi.ubahStatus(g.id, berikut);
        setMsg(msgEl, r.ok ? 'Status diperbarui.' : r.message, r.ok ? 'ok' : 'error');
        if (r.ok) muatUlang();
      },
    }, Transaksi.LABEL_AKSI[berikut]) : null);
}

/* --- REALTIME: muat ulang daftar saat ada data baru --- */
function contohRealtime(muatUlang) {
  const berhenti = Transaksi.berlangganan({
    onMuatanBaru: muatUlang,          // sopir: muatan baru muncul
    onPenawaranBaru: muatUlang,       // customer: ada penawaran masuk
    onPengirimanBerubah: muatUlang,   // dua pihak: status pengiriman berubah
  });
  window.addEventListener('pagehide', berhenti);
}
