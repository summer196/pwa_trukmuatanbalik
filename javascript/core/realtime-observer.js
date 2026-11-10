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
   * Mendaftar pengamat muatan baru dengan filter radius dan validasi otomatis.
   * @param {Object} opsi
   * @param {Object} opsi.lokasiSopir { lat, lon }
   * @param {number} opsi.radiusKm
   * @param {Array<Object>|Object} opsi.armada
   * @param {Object} [opsi.validator]
   * @param {Function} opsi.onMuatanBaru Callback saat ada muatan baru yang relevan
   * @returns {Function} Fungsi untuk berhenti berlangganan
   */
  amatiMuatanBaru({ lokasiSopir, radiusKm = 50, armada, validator, onMuatanBaru }) {
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

        // Hitung jarak jika lokasi sopir tersedia
        if (lokasiSopir && HaversineDiObserver) {
          const asalLat = muatanBaru.asal_lat ?? muatanBaru.asalLat;
          const asalLon = muatanBaru.asal_lon ?? muatanBaru.asalLon;

          if (asalLat != null && asalLon != null) {
            try {
              const jarak = HaversineDiObserver.jarakKm(lokasiSopir.lat, lokasiSopir.lon, asalLat, asalLon);
              muatanBaru.jarakKm = jarak;
              if (jarak > radiusKm) {
                // Di luar radius aktif sopir, abaikan
                return;
              }
            } catch (err) {
              console.warn('Gagal menghitung jarak muatan baru:', err);
            }
          }
        }

        // Lakukan validasi kompatibilitas jika validator dan armada tersedia
        if (validator && armada) {
          if (Array.isArray(armada) && typeof validator.validasiUntukSopir === 'function') {
            const v = validator.validasiUntukSopir(muatanBaru, armada);
            muatanBaru.kompatibilitas = v;
            muatanBaru.bisaTawar = v.bolehTawar;
          } else if (typeof validator.validasi === 'function') {
            const v = validator.validasi(muatanBaru, armada);
            muatanBaru.hasilValidasi = v;
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
