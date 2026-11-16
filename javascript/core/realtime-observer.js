/* javascript/core/realtime-observer.js
   Pola Observer untuk pembaruan muatan baru secara realtime (SRS Subbab 4.4.3 & FR-15).
*/

// Dependensi dimuat sendiri agar filter radius tetap jalan di Node (CommonJS) maupun di browser.
// Nama konstanta unik karena skrip klasik berbagi satu lingkup global.
const HaversineDiObserver = typeof HaversineCalculator !== 'undefined'
  ? HaversineCalculator
  : (typeof require !== 'undefined' ? require('./haversine.js').HaversineCalculator : null);

class RealtimeObserver {
  /**
   * @param {Object} [client] Supabase client
   */
  constructor(client = (typeof supabaseClient !== 'undefined' ? supabaseClient : null)) {
    this.client = client;
    this.kanal = null;
  }

  /**
   * Mendaftar pengamat muatan baru dengan filter radius dan validasi otomatis (FR-15).
   * @param {Object} opsi
   * @param {Object} opsi.lokasiSopir { lat, lon }
   * @param {number} opsi.radiusKm Radius titik muat
   * @param {Object} [opsi.kotaPulang] { lat, lon }; jika ada, berlaku mode muatan balik
   * @param {number} [opsi.radiusTujuanKm] Radius tujuan ke kota pulang (mode muatan balik)
   * @param {Array<Object>|Object} opsi.armada
   * @param {Object} [opsi.validator]
   * @param {Function} opsi.onMuatanBaru Callback saat ada muatan baru yang relevan
   * @returns {Function} Fungsi untuk berhenti berlangganan
   */
  amatiMuatanBaru({ lokasiSopir, radiusKm = 50, kotaPulang = null, radiusTujuanKm = 100, armada, validator, onMuatanBaru }) {
    if (!this.client) {
      console.warn('RealtimeObserver: Supabase client belum tersedia.');
      return () => {};
    }

    const idKanal = `muatan-baru-${Math.random().toString(36).slice(2, 9)}`;
    this.kanal = this.client.channel(idKanal);

    this.kanal.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'muatan' },
      (payload) => {
        const muatanBaru = payload.new;
        if (!muatanBaru) return;

        // Hanya muatan aktif (status awal saat posting adalah 'terbuka')
        const status = String(muatanBaru.status || 'terbuka').toLowerCase();
        if (status !== 'terbuka' && status !== 'tersedia') return;

        // Saring berdasarkan radius titik muat, dan (mode muatan balik) radius tujuan ke kota pulang
        if (lokasiSopir && HaversineDiObserver) {
          try {
            const dAsal = HaversineDiObserver.jarakKm(
              lokasiSopir.lat, lokasiSopir.lon,
              muatanBaru.asal_lat ?? muatanBaru.asalLat, muatanBaru.asal_lon ?? muatanBaru.asalLon);
            if (!(dAsal <= radiusKm)) return;                    // di luar radius aktif sopir
            muatanBaru.jarakKm = dAsal;
            muatanBaru.jarakAsalKm = dAsal;

            if (kotaPulang) {
              const dTujuan = HaversineDiObserver.jarakKm(
                kotaPulang.lat, kotaPulang.lon,
                muatanBaru.tujuan_lat ?? muatanBaru.tujuanLat, muatanBaru.tujuan_lon ?? muatanBaru.tujuanLon);
              if (!(dTujuan <= radiusTujuanKm)) return;          // tujuan terlalu jauh dari kota pulang
              muatanBaru.jarakTujuanKm = dTujuan;
              muatanBaru.skorKm = Math.round((dAsal + dTujuan) * 100) / 100;
            }
          } catch (err) {
            console.warn('RealtimeObserver: koordinat muatan baru tidak valid, diabaikan.', err);
            return;
          }
        }

        // Validasi kompatibilitas jika validator dan armada tersedia
        if (validator && armada) {
          if (Array.isArray(armada) && typeof validator.validasiUntukSopir === 'function') {
            const v = validator.validasiUntukSopir(muatanBaru, armada);
            muatanBaru.kompatibilitas = v;
            muatanBaru.bisaTawar = v.bolehTawar;
          } else if (typeof validator.validasi === 'function') {
            const v = validator.validasi(muatanBaru, armada);
            muatanBaru.hasilValidasi = v;
            muatanBaru.kompatibilitas = { cocok: v.kompatibel, alasan: v.alasan };
            muatanBaru.bisaTawar = v.bolehTawar();
          }
        }

        if (typeof onMuatanBaru === 'function') {
          onMuatanBaru(muatanBaru);
        }
      }
    );

    this.kanal.subscribe();

    return () => {
      this.berhenti();
    };
  }

  /**
   * Melepas pengamat agar tidak terjadi kebocoran memori (memory leak).
   */
  berhenti() {
    if (this.kanal && this.client) {
      this.client.removeChannel(this.kanal);
      this.kanal = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.RealtimeObserver = RealtimeObserver;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RealtimeObserver };
}
