import { CryptoUtil } from './crypto.js';

/**
 * AccExpress Database Engine & Persistence Manager
 */
class AccExpressDB {
  constructor() {
    this.STORAGE_KEYS = {
      PRODUCTS: 'accexpress_products',
      ACCOUNTS: 'accexpress_accounts',
      TEMPLATES: 'accexpress_templates',
      TRANSACTIONS: 'accexpress_transactions',
      ACTIVITY_LOGS: 'accexpress_activity_logs',
      ADMIN_USERS: 'accexpress_admin_users',
      SETTINGS: 'accexpress_settings'
    };
  }

  async init() {
    if (!localStorage.getItem(this.STORAGE_KEYS.ADMIN_USERS)) {
      await this.seedInitialData();
    }
    this.updateAutomaticExpirations();
  }

  // --- Utility Storage Methods ---
  _get(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  _set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  _generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  // --- Automatic Expiration Updater ---
  updateAutomaticExpirations() {
    const accounts = this._get(this.STORAGE_KEYS.ACCOUNTS);
    const now = new Date();
    let updated = false;

    accounts.forEach(acc => {
      if (acc.status === 'TERKIRIM' && acc.expires_at) {
        const expDate = new Date(acc.expires_at);
        if (now >= expDate) {
          acc.status = 'EXPIRED';
          updated = true;
        }
      }
    });

    if (updated) {
      this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
    }
  }

  // --- Initial Database Seed ---
  async seedInitialData() {
    // 1. Admin User
    const adminPassHash = await CryptoUtil.hashPassword('2001');
    const adminUsers = [{
      id: 'admin_1',
      username: 'admin',
      password_hash: adminPassHash,
      role: 'SUPER_ADMIN',
      created_at: new Date().toISOString()
    }];
    this._set(this.STORAGE_KEYS.ADMIN_USERS, adminUsers);

    // 2. Default Products
    const products = [
      {
        id: 'prod_netflix',
        name: 'Netflix Premium',
        description: 'Akun Netflix Ultra HD 4K Profile Shared / Private',
        default_duration: 30,
        duration_unit: 'Hari',
        status: 'Aktif',
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_spotify',
        name: 'Spotify Premium',
        description: 'Akun Spotify Individual / Family Plan Premium',
        default_duration: 30,
        duration_unit: 'Hari',
        status: 'Aktif',
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_canva',
        name: 'Canva Pro',
        description: 'Canva Pro Lifetime / Member Invitation',
        default_duration: 1,
        duration_unit: 'Bulan',
        status: 'Aktif',
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_youtube',
        name: 'YouTube Premium',
        description: 'YouTube Premium & Music Individual Plan',
        default_duration: 30,
        duration_unit: 'Hari',
        status: 'Aktif',
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_chatgpt',
        name: 'ChatGPT Plus',
        description: 'ChatGPT Plus GPT-4o Access Private Account',
        default_duration: 30,
        duration_unit: 'Hari',
        status: 'Aktif',
        created_at: new Date().toISOString()
      }
    ];
    this._set(this.STORAGE_KEYS.PRODUCTS, products);

    // 3. Encrypted Sample Accounts
    const encPass1 = await CryptoUtil.encrypt('passNetflix123!');
    const encPass2 = await CryptoUtil.encrypt('spotifySecret456');
    const encPass3 = await CryptoUtil.encrypt('canvaPro999#');
    const encPass4 = await CryptoUtil.encrypt('ytPremium777');

    const accounts = [
      {
        id: 'acc_1',
        product_id: 'prod_netflix',
        access_type: 'ACCOUNT',
        username_or_email: 'netflix.user1@accexpress.com',
        encrypted_password: encPass1,
        link: '',
        status: 'TERSEDIA',
        customer_whatsapp: '',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: null,
        expires_at: null,
        notes: 'Profile 1 - PIN 1234',
        created_at: new Date().toISOString()
      },
      {
        id: 'acc_2',
        product_id: 'prod_spotify',
        access_type: 'ACCOUNT',
        username_or_email: 'spotify.vip2@accexpress.com',
        encrypted_password: encPass2,
        link: '',
        status: 'TERSEDIA',
        customer_whatsapp: '',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: null,
        expires_at: null,
        notes: 'Indo Region Family Plan',
        created_at: new Date().toISOString()
      },
      {
        id: 'acc_3',
        product_id: 'prod_canva',
        access_type: 'LINK',
        username_or_email: 'https://canva.com/brand/join?invite=ax_sub_canva_pro_invite_2026',
        encrypted_password: '',
        link: 'https://canva.com/brand/join?invite=ax_sub_canva_pro_invite_2026',
        status: 'TERSEDIA',
        customer_whatsapp: '',
        duration: 1,
        duration_unit: 'Bulan',
        sent_at: null,
        expires_at: null,
        notes: 'Link Undangan Canva Pro Team Member',
        created_at: new Date().toISOString()
      },
      {
        id: 'acc_4',
        product_id: 'prod_youtube',
        access_type: 'ACCOUNT',
        username_or_email: 'yt.premium4@accexpress.com',
        encrypted_password: encPass4,
        link: '',
        status: 'TERSEDIA',
        customer_whatsapp: '',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: null,
        expires_at: null,
        notes: 'No ads account',
        created_at: new Date().toISOString()
      }
    ];
    this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);

    // 4. Default WhatsApp Message Template
    const templates = [
      {
        id: 'tpl_1',
        name: 'Template Standard WhatsApp (Global)',
        type: 'GLOBAL',
        product_id: '',
        content: 'Halo kak, terima kasih sudah order di *AccExpress Seller Hub*! 🙏\n\nBerikut detail {{product}} Anda:\n-------------------------------------\n📧 *Email / Link*: {{email/link}}\n🔑 *Password*: {{password}}\n⏱️ *Durasi*: {{duration}} {{duration_unit}}\n📅 *Tanggal Kirim*: {{sent_date}}\n⏳ *Expired Pada*: {{expires_date}}\n-------------------------------------\nHarap simpan bukti pengiriman ini. Jika ada kendala, hubungi kami!\nTerima kasih dan selamat menikmati layanan premium! ✨',
        is_default: true,
        created_at: new Date().toISOString()
      },
      {
        id: 'tpl_2',
        name: 'Template Khusus Netflix Premium',
        type: 'PRODUCT',
        product_id: 'prod_netflix',
        content: 'Halo kak, pesanan *Netflix Premium* siap digunakan! 🎬\n\n📧 *Email*: {{email/link}}\n🔑 *Password*: {{password}}\n⏱️ *Durasi*: {{duration}} {{duration_unit}}\n⏳ *Expired*: {{expires_date}}\n\n*Aturan*: Dilarang mengubah password/profile pin agar garansi tetap berlaku. Enjoy your movies! 🍿',
        is_default: false,
        created_at: new Date().toISOString()
      }
    ];
    this._set(this.STORAGE_KEYS.TEMPLATES, templates);

    // 5. Initial Settings
    const settings = {
      web_name: 'AccExpress Seller Hub',
      shop_name: 'AccExpress Digital Store',
      shop_whatsapp: '081234567890',
      admin_pin: '2001',
      timezone: 'Asia/Jakarta (UTC+7)'
    };
    localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

    // 6. Activity Log Initial
    this.addActivityLog('system', 'System Seed', 'system', 'Database successfully initialized with seed data');
  }

  // --- Products CRUD ---
  getProducts() {
    return this._get(this.STORAGE_KEYS.PRODUCTS);
  }

  getActiveProducts() {
    return this.getProducts().filter(p => p.status === 'Aktif');
  }

  getProductById(id) {
    if (!id) return null;
    return this.getProducts().find(p => p.id === id);
  }

  saveProduct(productData) {
    const products = this.getProducts();

    if (productData.id && String(productData.id).trim() !== '') {
      const idx = products.findIndex(p => p.id === productData.id);
      if (idx !== -1) {
        products[idx] = { ...products[idx], ...productData, updated_at: new Date().toISOString() };
        this._set(this.STORAGE_KEYS.PRODUCTS, products);
        return products[idx];
      }
    }

    const cleanData = { ...productData };
    delete cleanData.id;

    const newProd = {
      id: this._generateId(),
      ...cleanData,
      status: cleanData.status || 'Aktif',
      created_at: new Date().toISOString()
    };
    products.unshift(newProd);
    this._set(this.STORAGE_KEYS.PRODUCTS, products);
    return newProd;
  }

  deleteProduct(id) {
    const products = this.getProducts().filter(p => p.id !== id);
    this._set(this.STORAGE_KEYS.PRODUCTS, products);
  }

  // --- Accounts CRUD ---
  getAccounts() {
    this.updateAutomaticExpirations();
    return this._get(this.STORAGE_KEYS.ACCOUNTS);
  }

  getAccountsByProductId(productId) {
    if (!productId) return [];
    return this.getAccounts().filter(a => a.product_id === productId);
  }

  getAccountById(id) {
    if (!id) return null;
    return this.getAccounts().find(a => a.id === id);
  }

  async saveAccount(accData) {
    const accounts = this.getAccounts();
    let encPass = accData.encrypted_password || '';
    if (accData.password) {
      encPass = await CryptoUtil.encrypt(accData.password);
    }

    if (accData.id && String(accData.id).trim() !== '') {
      const idx = accounts.findIndex(a => a.id === accData.id);
      if (idx !== -1) {
        accounts[idx] = {
          ...accounts[idx],
          ...accData,
          encrypted_password: encPass || accounts[idx].encrypted_password,
          updated_at: new Date().toISOString()
        };
        delete accounts[idx].password;
        this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
        return accounts[idx];
      }
    }

    const cleanData = { ...accData };
    delete cleanData.id;
    delete cleanData.password;

    const isLinkType = cleanData.access_type === 'LINK' || Boolean(cleanData.link);

    const newAcc = {
      id: this._generateId(),
      product_id: cleanData.product_id,
      access_type: isLinkType ? 'LINK' : 'ACCOUNT',
      username_or_email: isLinkType ? (cleanData.link || cleanData.username_or_email || '') : (cleanData.username_or_email || ''),
      encrypted_password: isLinkType ? '' : encPass,
      link: cleanData.link || (isLinkType ? cleanData.username_or_email : ''),
      status: cleanData.status || 'TERSEDIA',
      customer_whatsapp: cleanData.customer_whatsapp || '',
      duration: cleanData.duration ? Number(cleanData.duration) : 30,
      duration_unit: cleanData.duration_unit || 'Hari',
      sent_at: cleanData.sent_at || null,
      expires_at: cleanData.expires_at || null,
      notes: cleanData.notes || '',
      created_at: new Date().toISOString()
    };
    accounts.unshift(newAcc);
    this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
    return newAcc;
  }

  deleteAccount(id) {
    const accounts = this.getAccounts().filter(a => a.id !== id);
    this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
  }

  async resetAccount(id) {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx !== -1) {
      accounts[idx].status = 'TERSEDIA';
      accounts[idx].customer_whatsapp = '';
      accounts[idx].sent_at = null;
      accounts[idx].expires_at = null;
      accounts[idx].updated_at = new Date().toISOString();
      this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
      return accounts[idx];
    }
    return null;
  }

  // --- Templates CRUD ---
  getTemplates() {
    return this._get(this.STORAGE_KEYS.TEMPLATES);
  }

  getDefaultTemplate() {
    const tpls = this.getTemplates();
    return tpls.find(t => t.is_default) || tpls[0] || null;
  }

  getTemplateForProduct(productId) {
    const tpls = this.getTemplates();
    if (productId) {
      const prodTpl = tpls.find(t => t.type === 'PRODUCT' && t.product_id === productId);
      if (prodTpl) return prodTpl;
    }
    return this.getDefaultTemplate();
  }

  saveTemplate(templateData) {
    let templates = this.getTemplates();

    if (templateData.is_default) {
      templates.forEach(t => t.is_default = false);
    }

    if (templateData.id && String(templateData.id).trim() !== '') {
      const idx = templates.findIndex(t => t.id === templateData.id);
      if (idx !== -1) {
        templates[idx] = { ...templates[idx], ...templateData, updated_at: new Date().toISOString() };
        this._set(this.STORAGE_KEYS.TEMPLATES, templates);
        return templates[idx];
      }
    }

    const cleanData = { ...templateData };
    delete cleanData.id;

    const newTpl = {
      id: this._generateId(),
      ...cleanData,
      is_default: cleanData.is_default || templates.length === 0,
      created_at: new Date().toISOString()
    };
    templates.unshift(newTpl);
    this._set(this.STORAGE_KEYS.TEMPLATES, templates);
    return newTpl;
  }

  setDefaultTemplate(id) {
    const templates = this.getTemplates();
    templates.forEach(t => {
      t.is_default = (t.id === id);
    });
    this._set(this.STORAGE_KEYS.TEMPLATES, templates);
  }

  deleteTemplate(id) {
    const templates = this.getTemplates().filter(t => t.id !== id);
    this._set(this.STORAGE_KEYS.TEMPLATES, templates);
  }

  // --- Transactions ---
  getTransactions() {
    return this._get(this.STORAGE_KEYS.TRANSACTIONS);
  }

  addTransaction(txData) {
    const transactions = this.getTransactions();
    const newTx = {
      id: this._generateId(),
      account_id: txData.account_id,
      product_id: txData.product_id,
      customer_whatsapp: txData.customer_whatsapp,
      delivery_method: txData.delivery_method,
      duration: txData.duration,
      duration_unit: txData.duration_unit,
      sent_at: txData.sent_at || new Date().toISOString(),
      expires_at: txData.expires_at,
      status: txData.status || 'TERKIRIM',
      created_at: new Date().toISOString()
    };
    transactions.unshift(newTx);
    this._set(this.STORAGE_KEYS.TRANSACTIONS, transactions);
    return newTx;
  }

  // --- Activity Logs ---
  getActivityLogs() {
    return this._get(this.STORAGE_KEYS.ACTIVITY_LOGS);
  }

  addActivityLog(adminId, action, targetType, description, targetId = '') {
    const logs = this.getActivityLogs();
    const newLog = {
      id: this._generateId(),
      admin_id: adminId || 'admin',
      action,
      target_type: targetType,
      target_id: targetId,
      description,
      created_at: new Date().toISOString()
    };
    logs.unshift(newLog);
    this._set(this.STORAGE_KEYS.ACTIVITY_LOGS, logs);
    return newLog;
  }

  // --- OTENTIKASI PIN ADMIN (DEFAULT: 2001) ---
  getAdminPin() {
    const settings = this.getSettings();
    return settings.admin_pin || '2001';
  }

  async verifyAdmin(username, pinInput) {
    const activePin = this.getAdminPin();
    const cleanInput = String(pinInput || '').trim();
    // PIN VERIFIKASI STRICT DENGAN PIN UTAMA YANG AKTIF!
    return cleanInput === activePin;
  }

  async updateAdminPassword(username, newPin) {
    const cleanPin = String(newPin || '2001').trim();
    const settings = this.getSettings();
    settings.admin_pin = cleanPin;
    this.saveSettings(settings);

    let adminUsers = this._get(this.STORAGE_KEYS.ADMIN_USERS);
    if (adminUsers.length > 0) {
      adminUsers[0].password_hash = await CryptoUtil.hashPassword(cleanPin);
      this._set(this.STORAGE_KEYS.ADMIN_USERS, adminUsers);
    }
    return true;
  }

  // --- Settings ---
  getSettings() {
    const data = localStorage.getItem(this.STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      web_name: 'AccExpress Seller Hub',
      shop_name: 'AccExpress Store',
      shop_whatsapp: '081234567890',
      admin_pin: '2001',
      timezone: 'Asia/Jakarta (UTC+7)'
    };
  }

  saveSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  }
}

export const db = new AccExpressDB();
