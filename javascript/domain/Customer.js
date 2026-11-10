/* javascript/domain/Customer.js
   Kelas Domain Customer turunan dari Pengguna (SRS Subbab 4.2.1 Gambar 4.2).
*/

const PenggunaBaseCustomer = typeof Pengguna !== 'undefined'
  ? Pengguna
  : (typeof require !== 'undefined' ? require('./Pengguna.js').Pengguna : class {});

class Customer extends PenggunaBaseCustomer {
  constructor(data = {}) {
    super({ ...data, peran: 'customer' });
  }

  async postingMuatan(dataMuatan, supabase = (typeof supabaseClient !== 'undefined' ? supabaseClient : null)) {
    if (!supabase) throw new Error('Supabase client belum tersedia.');
    const muatan = {
      ...dataMuatan,
      customer_id: this.id,
      status: 'terbuka',
    };
    const { data, error } = await supabase.from('muatan').insert(muatan).select().single();
    if (error) throw error;
    return data;
  }

  async pilihSopir(penawaranId) {
    if (typeof Transaksi !== 'undefined' && typeof Transaksi.pilihPenawaran === 'function') {
      return await Transaksi.pilihPenawaran(penawaranId);
    }
    return { ok: true, penawaranId };
  }

  async pantauStatus(pengirimanId) {
    if (typeof Transaksi !== 'undefined' && typeof Transaksi.riwayatStatus === 'function') {
      return await Transaksi.riwayatStatus(pengirimanId);
    }
    return { ok: true, pengirimanId };
  }
}

if (typeof window !== 'undefined') {
  window.Customer = Customer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Customer };
}
