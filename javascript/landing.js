/* landing.js - Menghubungkan fitur Hero dan Aksi Cepat di halaman utama (index.html).
   Bergantung pada: supabase-config.js, auth.js, map.js (Leaflet), transaction.js */

document.addEventListener('DOMContentLoaded', () => {
  initHeroForms();
  initQuickActions();
});

function initHeroForms() {
  const formCari = document.getElementById('hero-form-cari');
  const inputSekarang = document.getElementById('hero-lokasi-sekarang');
  const inputSekarangLat = document.getElementById('hero-sekarang-lat');
  const inputSekarangLon = document.getElementById('hero-sekarang-lon');
  const btnMapSekarang = document.getElementById('hero-btn-map-sekarang');

  const inputPulang = document.getElementById('hero-kota-pulang');
  const inputPulangLat = document.getElementById('hero-pulang-lat');
  const inputPulangLon = document.getElementById('hero-pulang-lon');
  const btnMapPulang = document.getElementById('hero-btn-map-pulang');

  const formLacak = document.getElementById('hero-form-lacak');
  const inputLacak = document.getElementById('hero-nomor-pengiriman');
  const modalLacak = document.getElementById('lacak-modal');

  // 1. Tombol Pilih Titik di Peta (Lokasi Sekarang)
  if (btnMapSekarang) {
    btnMapSekarang.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof MapUI === 'undefined' || !MapUI.bukaModalPilihTitik) {
        alert('Modul peta sedang dimuat, coba sesaat lagi.');
        return;
      }
      MapUI.bukaModalPilihTitik({
        judul: 'Pilih Lokasi Sekarang di Peta',
        lat: inputSekarangLat.value ? Number(inputSekarangLat.value) : null,
        lon: inputSekarangLon.value ? Number(inputSekarangLon.value) : null,
        namaAwal: inputSekarang.value || '',
        onPilih: (p) => {
          inputSekarangLat.value = p.lat.toFixed(6);
          inputSekarangLon.value = p.lon.toFixed(6);
          inputSekarang.value = p.nama;
        },
      });
    });
  }

  // 2. Tombol Pilih Titik di Peta (Kota Pulang)
  if (btnMapPulang) {
    btnMapPulang.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof MapUI === 'undefined' || !MapUI.bukaModalPilihTitik) {
        alert('Modul peta sedang dimuat, coba sesaat lagi.');
        return;
      }
      MapUI.bukaModalPilihTitik({
        judul: 'Pilih Kota Pulang di Peta',
        lat: inputPulangLat.value ? Number(inputPulangLat.value) : null,
        lon: inputPulangLon.value ? Number(inputPulangLon.value) : null,
        namaAwal: inputPulang.value || '',
        onPilih: (p) => {
          inputPulangLat.value = p.lat.toFixed(6);
          inputPulangLon.value = p.lon.toFixed(6);
          inputPulang.value = p.nama;
        },
      });
    });
  }

  // Bersihkan koordinat jika user mengetik manual lagi
  if (inputSekarang) {
    inputSekarang.addEventListener('input', () => {
      inputSekarangLat.value = '';
      inputSekarangLon.value = '';
    });
  }
  if (inputPulang) {
    inputPulang.addEventListener('input', () => {
      inputPulangLat.value = '';
      inputPulangLon.value = '';
    });
  }

  // Helper geocode cepat jika teks diisi tapi koordinat belum ada
  async function cariKoordinatTeks(teks) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(teks)}`;
      const [hit] = await (await fetch(url)).json();
      if (hit) return { lat: Number(hit.lat).toFixed(6), lon: Number(hit.lon).toFixed(6), nama: hit.display_name };
    } catch (e) { /* abaikan */ }
    return null;
  }

  // 3. Submit Form Cari Muatan Balik
  if (formCari) {
    formCari.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = formCari.querySelector('button[type="submit"]');
      const labelAsli = btnSubmit.textContent;

      let sNama = inputSekarang.value.trim();
      let sLat = inputSekarangLat.value;
      let sLon = inputSekarangLon.value;

      let pNama = inputPulang.value.trim();
      let pLat = inputPulangLat.value;
      let pLon = inputPulangLon.value;

      if (!sNama) {
        alert('Mohon masukkan lokasi sekarang atau pilih titik di peta.');
        inputSekarang.focus();
        return;
      }
      if (!pNama) {
        alert('Mohon masukkan kota tujuan pulang atau pilih titik di peta.');
        inputPulang.focus();
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Mencari lokasi...';

      // Geocode jika belum ada titik pasti
      if (!sLat || !sLon) {
        const hit = await cariKoordinatTeks(sNama);
        if (hit) { sLat = hit.lat; sLon = hit.lon; }
        else {
          alert(`Lokasi "${sNama}" tidak ditemukan. Coba gunakan tombol Peta untuk memilih titik.`);
          btnSubmit.disabled = false; btnSubmit.textContent = labelAsli;
          return;
        }
      }
      if (!pLat || !pLon) {
        const hit = await cariKoordinatTeks(pNama);
        if (hit) { pLat = hit.lat; pLon = hit.lon; }
        else {
          alert(`Lokasi pulang "${pNama}" tidak ditemukan. Coba gunakan tombol Peta untuk memilih titik.`);
          btnSubmit.disabled = false; btnSubmit.textContent = labelAsli;
          return;
        }
      }

      const searchPayload = {
        sekarang_lat: sLat, sekarang_lon: sLon, sekarang_nama: sNama,
        pulang_lat: pLat, pulang_lon: pLon, pulang_nama: pNama,
      };

      // Cek status login
      let profile = null;
      try { profile = await getCurrentProfile(); } catch (err) { /* abaikan */ }

      if (profile && (profile.role === 'sopir' || profile.role === 'admin')) {
        const isAdmin = profile.role === 'admin';
        const targetUrl = isAdmin ? 'html/admin.html' : 'html/dashboard.html';
        const qs = new URLSearchParams({
          ...(isAdmin ? { menu: 'cari' } : { tab: 'cari' }),
          mode: 'balik', auto: '1',
          ...searchPayload,
        }).toString();
        window.location.href = `${targetUrl}?${qs}`;
      } else if (profile && profile.role === 'customer') {
        btnSubmit.disabled = false; btnSubmit.textContent = labelAsli;
        alert('Pencarian muatan balik dikhususkan untuk akun Sopir atau Admin. Anda saat ini masuk sebagai Customer.');
      } else {
        // Belum login -> simpan pencarian dan arahkan untuk login / daftar sopir
        btnSubmit.disabled = false; btnSubmit.textContent = labelAsli;
        sessionStorage.setItem('muatanku:pending_search', JSON.stringify(searchPayload));

        const modal = document.getElementById('auth-modal');
        if (modal) {
          const tabBtn = modal.querySelector('[data-auth-tab="login"]');
          if (tabBtn) tabBtn.click();
          const roleRadio = modal.querySelector('input[name="role"][value="sopir"]');
          if (roleRadio) roleRadio.checked = true;
          alert('Silakan Masuk atau Buat Akun Sopir untuk melihat muatan yang cocok dan melakukan penawaran.');
          if (!modal.open) modal.showModal();
        }
      }
    });
  }

  // 4. Submit Form Lacak Pengiriman
  if (formLacak) {
    formLacak.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idKirim = inputLacak.value.trim();
      if (!idKirim) {
        alert('Masukkan nomor atau ID pengiriman Anda.');
        inputLacak.focus();
        return;
      }

      let profile = null;
      try { profile = await getCurrentProfile(); } catch (err) { /* abaikan */ }

      if (!profile) {
        alert('Silakan Masuk ke akun Anda terlebih dahulu untuk melacak pengiriman.');
        const modal = document.getElementById('auth-modal');
        if (modal && !modal.open) modal.showModal();
        return;
      }

      const btnSubmit = formLacak.querySelector('button[type="submit"]');
      const labelAsli = btnSubmit.textContent;
      btnSubmit.disabled = true; btnSubmit.textContent = 'Melacak...';

      try {
        const { data: g, error } = await supabaseClient
          .from('pengiriman')
          .select('*, muatan:muatan_id(jenis, berat_ton, asal_nama, tujuan_nama), sopir:sopir_id(nama, no_hp), customer:customer_id(nama, no_hp)')
          .eq('id', idKirim)
          .single();

        btnSubmit.disabled = false; btnSubmit.textContent = labelAsli;

        if (error || !g) {
          bukaModalLacak({ ok: false, message: 'Nomor pengiriman tidak ditemukan atau Anda tidak memiliki akses ke pengiriman ini.' });
          return;
        }

        const { data: riwayat } = await supabaseClient
          .from('log_status')
          .select('status, waktu, catatan')
          .eq('pengiriman_id', idKirim)
          .order('waktu', { ascending: true });

        bukaModalLacak({ ok: true, pengiriman: g, riwayat: riwayat || [] });
      } catch (err) {
        btnSubmit.disabled = false; btnSubmit.textContent = labelAsli;
        bukaModalLacak({ ok: false, message: 'Gagal menghubungi server. Periksa koneksi internet Anda.' });
      }
    });
  }
}

function bukaModalLacak(hasil) {
  let modal = document.getElementById('lacak-modal');
  if (!modal) {
    modal = document.createElement('dialog');
    modal.id = 'lacak-modal';
    modal.className = 'lacak-modal';
    document.body.appendChild(modal);
  }

  if (!hasil.ok) {
    modal.innerHTML = `
      <div class="lacak-modal__box">
        <button type="button" class="lacak-modal__close" onclick="this.closest('dialog').close()">&times;</button>
        <h3 style="color:#b42318;margin-bottom:8px">Pelacakan Tidak Ditemukan</h3>
        <p>${hasil.message}</p>
        <button type="button" class="btn btn--primary btn--block" style="margin-top:16px" onclick="this.closest('dialog').close()">Tutup</button>
      </div>`;
    modal.showModal();
    return;
  }

  const g = hasil.pengiriman;
  const labelStatus = (typeof Transaksi !== 'undefined' && Transaksi.LABEL_STATUS[g.status]) || g.status;
  const muatanInfo = g.muatan ? `${g.muatan.jenis} (${g.muatan.berat_ton} ton)` : 'Muatan';
  const rute = g.muatan ? `${g.muatan.asal_nama} &rarr; ${g.muatan.tujuan_nama}` : '-';

  const riwayatHtml = hasil.riwayat.map((r) => {
    const waktu = new Date(r.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    const namaStatus = (typeof Transaksi !== 'undefined' && Transaksi.LABEL_STATUS[r.status]) || r.status;
    return `
      <div class="lacak-timeline__item">
        <strong>${namaStatus}</strong>
        ${r.catatan ? `<span> - ${r.catatan}</span>` : ''}
        <div class="lacak-timeline__time">${waktu}</div>
      </div>`;
  }).join('');

  modal.innerHTML = `
    <div class="lacak-modal__box">
      <button type="button" class="lacak-modal__close" onclick="this.closest('dialog').close()">&times;</button>
      <h3 style="margin-bottom:4px;color:var(--blue-950)">Detail Pengiriman</h3>
      <small style="color:var(--muted)">No: ${g.id}</small>
      <div class="lacak-card">
        <div style="background:var(--blue-50);padding:10px 14px;border-radius:8px">
          <span style="font-size:.8rem;color:var(--muted);text-transform:uppercase;font-weight:700">Status Saat Ini</span>
          <div style="font-size:1.1rem;font-weight:700;color:var(--blue-800)">${labelStatus}</div>
        </div>
        <div>
          <strong>${muatanInfo}</strong>
          <div style="font-size:.9rem;color:var(--muted)">${rute}</div>
        </div>
        ${g.sopir ? `<div style="font-size:.9rem"><strong>Sopir:</strong> ${g.sopir.nama} ${g.sopir.no_hp ? `(${g.sopir.no_hp})` : ''}</div>` : ''}
        ${g.customer ? `<div style="font-size:.9rem"><strong>Customer:</strong> ${g.customer.nama} ${g.customer.no_hp ? `(${g.customer.no_hp})` : ''}</div>` : ''}
        <div style="margin-top:8px">
          <strong>Riwayat Perjalanan:</strong>
          <div class="lacak-timeline">${riwayatHtml || '<p style="color:var(--muted);font-size:.85rem">Belum ada pembaruan log status.</p>'}</div>
        </div>
        <button type="button" class="btn btn--primary btn--block" style="margin-top:12px" onclick="this.closest('dialog').close()">Tutup</button>
      </div>
    </div>`;
  modal.showModal();
}

function initQuickActions() {
  const btnMuatanSekitar = document.getElementById('quick-muatan-sekitar');
  const btnPostingMuatan = document.getElementById('quick-posting-muatan');
  const btnProfilArmada = document.getElementById('quick-profil-armada');

  function bukaModalAuth(tab = 'login', role = 'sopir') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    const tabBtn = modal.querySelector(`[data-auth-tab="${tab}"]`);
    if (tabBtn) tabBtn.click();
    const roleRadio = modal.querySelector(`input[name="role"][value="${role}"]`);
    if (roleRadio) roleRadio.checked = true;
    if (!modal.open) modal.showModal();
  }

  // Muatan Sekitar -> tab cari muatan (Sopir / Admin)
  if (btnMuatanSekitar) {
    btnMuatanSekitar.addEventListener('click', async (e) => {
      e.preventDefault();
      let profile = null;
      try { profile = await getCurrentProfile(); } catch (err) { /* abaikan */ }

      if (!profile) {
        bukaModalAuth('login', 'sopir');
      } else if (profile.role === 'admin') {
        window.location.href = 'html/admin.html?menu=cari';
      } else if (profile.role === 'sopir') {
        window.location.href = 'html/dashboard.html?tab=cari';
      } else {
        alert('Fitur pencarian muatan sekitar adalah untuk Sopir atau Admin. Buka dasbor untuk melihat muatan Anda.');
      }
    });
  }

  // Posting Muatan -> tab muatan (Customer / Admin)
  if (btnPostingMuatan) {
    btnPostingMuatan.addEventListener('click', async (e) => {
      e.preventDefault();
      let profile = null;
      try { profile = await getCurrentProfile(); } catch (err) { /* abaikan */ }

      if (!profile) {
        bukaModalAuth('register', 'customer');
      } else if (profile.role === 'admin') {
        window.location.href = 'html/admin.html?menu=posting';
      } else if (profile.role === 'customer') {
        window.location.href = 'html/dashboard.html?tab=muatan';
      } else {
        alert('Fitur posting muatan adalah untuk Customer atau Admin. Buka dasbor Sopir Anda untuk mencari muatan.');
      }
    });
  }

  // Profil Armada -> tab armada (Sopir / Admin verifikasi)
  if (btnProfilArmada) {
    btnProfilArmada.addEventListener('click', async (e) => {
      e.preventDefault();
      let profile = null;
      try { profile = await getCurrentProfile(); } catch (err) { /* abaikan */ }

      if (!profile) {
        bukaModalAuth('register', 'sopir');
      } else if (profile.role === 'admin') {
        window.location.href = 'html/admin.html?menu=verifikasi';
      } else if (profile.role === 'sopir') {
        window.location.href = 'html/dashboard.html?tab=armada';
      } else {
        alert('Profil armada dikhususkan untuk akun Sopir.');
      }
    });
  }
}
