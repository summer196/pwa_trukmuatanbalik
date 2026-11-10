/* javascript/domain/Pengguna.js
   Kelas Domain Pengguna (SRS Subbab 4.2.1 Gambar 4.2).
*/

class Pengguna {
  /**
   * @param {Object} data
   * @param {string} data.id
   * @param {string} data.nama
   * @param {string} data.nomorHp
   * @param {string} [data.statusVerifikasi='pending']
   * @param {string} [data.peran]
   */
  constructor({ id, nama, nomorHp, no_hp, statusVerifikasi, status_verifikasi, peran, role } = {}) {
    this.id = id || null;
    this.nama = nama || '';
    this.nomorHp = nomorHp || no_hp || '';
    this.statusVerifikasi = statusVerifikasi || status_verifikasi || 'pending';
    this.peran = peran || role || 'pengguna';
  }

  isTerverifikasi() {
    return this.statusVerifikasi === 'verified';
  }

  async registrasi(kredensial) {
    if (typeof registerUser === 'function') {
      return await registerUser(kredensial);
    }
    return { ok: true, data: this };
  }

  async login(kredensial) {
    if (typeof loginUser === 'function') {
      return await loginUser(kredensial.email, kredensial.password);
    }
    return { ok: true, data: this };
  }

  async logout() {
    if (typeof logoutUser === 'function') {
      return await logoutUser();
    }
    return { ok: true };
  }
}

if (typeof window !== 'undefined') {
  window.Pengguna = Pengguna;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Pengguna };
}
