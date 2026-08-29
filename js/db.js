import { CryptoUtil } from './crypto.js';
import {
  fetchAllFromSupabase,
  upsertToSupabase,
  deleteFromSupabase,
  SUPABASE_TABLES
} from './supabase.js';

/**
 * AccExpress Database Engine & Persistence Manager (Supabase + Local Cache)
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
    // 1. Sync data dari database Cloud Supabase
    await this.syncFromSupabase();

    // 2. Jika data lokal / Supabase masih kosong, jalankan seeding awal
    if (!localStorage.getItem(this.STORAGE_KEYS.ADMIN_USERS)) {
      await this.seedInitialData();
    }
    
    // 3. Update status akun expired secara otomatis
    await this.updateAutomaticExpirations();
  }

  // --- Remote Cloud Sync Methods ---
  async syncFromSupabase() {
    try {
      const [remoteProducts, remoteAccounts, remoteTemplates, remoteTx, remoteLogs, remoteSettings, remoteAdmin] = await Promise.all([
        fetchAllFromSupabase(SUPABASE_TABLES.PRODUCTS),
        fetchAllFromSupabase(SUPABASE_TABLES.ACCOUNTS),
        fetchAllFromSupabase(SUPABASE_TABLES.TEMPLATES),
        fetchAllFromSupabase(SUPABASE_TABLES.TRANSACTIONS),
        fetchAllFromSupabase(SUPABASE_TABLES.ACTIVITY_LOGS),
        fetchAllFromSupabase(SUPABASE_TABLES.SETTINGS),
        fetchAllFromSupabase(SUPABASE_TABLES.ADMIN_USERS)
      ]);

      if (remoteProducts && remoteProducts.length > 0) {
        this._set(this.STORAGE_KEYS.PRODUCTS, remoteProducts);
      }
      if (remoteAccounts && remoteAccounts.length > 0) {
        this._set(this.STORAGE_KEYS.ACCOUNTS, remoteAccounts);
      }
      if (remoteTemplates && remoteTemplates.length > 0) {
        this._set(this.STORAGE_KEYS.TEMPLATES, remoteTemplates);
      }
      if (remoteTx && remoteTx.length > 0) {
        this._set(this.STORAGE_KEYS.TRANSACTIONS, remoteTx);
      }
      if (remoteLogs && remoteLogs.length > 0) {
        this._set(this.STORAGE_KEYS.ACTIVITY_LOGS, remoteLogs);
      }
      if (remoteAdmin && remoteAdmin.length > 0) {
        this._set(this.STORAGE_KEYS.ADMIN_USERS, remoteAdmin);
      }
      if (remoteSettings && remoteSettings.length > 0) {
        const settingsRecord = remoteSettings.find(s => s.id === 'main_settings') || remoteSettings[0];
        if (settingsRecord) {
          const { id, ...cleanSettings } = settingsRecord;
          localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(cleanSettings));
        }
      }
    } catch (e) {
      console.warn('[Supabase Sync Warning] Could not sync from Supabase DB on init:', e);
    }
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
  async updateAutomaticExpirations() {
    const accounts = this._get(this.STORAGE_KEYS.ACCOUNTS);
    const now = new Date();
    let updatedAccs = [];

    accounts.forEach(acc => {
      if (acc.status === 'TERKIRIM' && acc.expires_at) {
        const expDate = new Date(acc.expires_at);
        if (now >= expDate) {
          acc.status = 'EXPIRED';
          updatedAccs.push(acc);
        }
      }
    });

    if (updatedAccs.length > 0) {
      this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
      await upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, updatedAccs);
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
    await upsertToSupabase(SUPABASE_TABLES.ADMIN_USERS, adminUsers);

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
    await upsertToSupabase(SUPABASE_TABLES.PRODUCTS, products);

    // 3. Encrypted Sample Accounts
    const encPass1 = await CryptoUtil.encrypt('passNetflix123!');
    const encPass2 = await CryptoUtil.encrypt('spotifySecret456');
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
    await upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, accounts);

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
    await upsertToSupabase(SUPABASE_TABLES.TEMPLATES, templates);

    // 5. Initial Settings
    const settings = {
      id: 'main_settings',
      web_name: 'AccExpress Seller Hub',
      shop_name: 'AccExpress Digital Store',
      shop_whatsapp: '081234567890',
      admin_pin: '2001',
      timezone: 'Asia/Jakarta (UTC+7)',
      updated_at: new Date().toISOString()
    };
    localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    await upsertToSupabase(SUPABASE_TABLES.SETTINGS, settings);

    // 6. Activity Log Initial
    await this.addActivityLog('system', 'System Seed', 'system', 'Database successfully initialized with Supabase seed data');
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

  async saveProduct(productData) {
    const products = this.getProducts();
    let savedProd = null;

    if (productData.id && String(productData.id).trim() !== '') {
      const idx = products.findIndex(p => p.id === productData.id);
      if (idx !== -1) {
        products[idx] = { ...products[idx], ...productData, updated_at: new Date().toISOString() };
        savedProd = products[idx];
      }
    }

    if (!savedProd) {
      const cleanData = { ...productData };
      delete cleanData.id;

      savedProd = {
        id: this._generateId(),
        ...cleanData,
        status: cleanData.status || 'Aktif',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      products.unshift(savedProd);
    }

    this._set(this.STORAGE_KEYS.PRODUCTS, products);
    await upsertToSupabase(SUPABASE_TABLES.PRODUCTS, savedProd);
    return savedProd;
  }

  async deleteProduct(id) {
    const products = this.getProducts().filter(p => p.id !== id);
    this._set(this.STORAGE_KEYS.PRODUCTS, products);
    await deleteFromSupabase(SUPABASE_TABLES.PRODUCTS, id);
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

    let savedAcc = null;

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
        savedAcc = accounts[idx];
      }
    }

    if (!savedAcc) {
      const cleanData = { ...accData };
      delete cleanData.id;
      delete cleanData.password;

      const isLinkType = cleanData.access_type === 'LINK' || Boolean(cleanData.link);

      savedAcc = {
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      accounts.unshift(savedAcc);
    }

    this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
    await upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, savedAcc);
    return savedAcc;
  }

  async deleteAccount(id) {
    const accounts = this.getAccounts().filter(a => a.id !== id);
    this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
    await deleteFromSupabase(SUPABASE_TABLES.ACCOUNTS, id);
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
      await upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, accounts[idx]);
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

  async saveTemplate(templateData) {
    let templates = this.getTemplates();
    let savedTpl = null;

    if (templateData.is_default) {
      templates.forEach(t => t.is_default = false);
    }

    if (templateData.id && String(templateData.id).trim() !== '') {
      const idx = templates.findIndex(t => t.id === templateData.id);
      if (idx !== -1) {
        templates[idx] = { ...templates[idx], ...templateData, updated_at: new Date().toISOString() };
        savedTpl = templates[idx];
      }
    }

    if (!savedTpl) {
      const cleanData = { ...templateData };
      delete cleanData.id;

      savedTpl = {
        id: this._generateId(),
        ...cleanData,
        is_default: cleanData.is_default || templates.length === 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      templates.unshift(savedTpl);
    }

    this._set(this.STORAGE_KEYS.TEMPLATES, templates);
    await upsertToSupabase(SUPABASE_TABLES.TEMPLATES, templates);
    return savedTpl;
  }

  async setDefaultTemplate(id) {
    const templates = this.getTemplates();
    templates.forEach(t => {
      t.is_default = (t.id === id);
    });
    this._set(this.STORAGE_KEYS.TEMPLATES, templates);
    await upsertToSupabase(SUPABASE_TABLES.TEMPLATES, templates);
  }

  async deleteTemplate(id) {
    const templates = this.getTemplates().filter(t => t.id !== id);
    this._set(this.STORAGE_KEYS.TEMPLATES, templates);
    await deleteFromSupabase(SUPABASE_TABLES.TEMPLATES, id);
  }

  // --- Transactions ---
  getTransactions() {
    return this._get(this.STORAGE_KEYS.TRANSACTIONS);
  }

  async addTransaction(txData) {
    const transactions = this.getTransactions();
    const newTx = {
      id: this._generateId(),
      account_id: txData.account_id || '',
      product_id: txData.product_id || '',
      customer_whatsapp: txData.customer_whatsapp || '',
      delivery_method: txData.delivery_method || 'QUICK_ACCESS',
      duration: txData.duration ? Number(txData.duration) : 30,
      duration_unit: txData.duration_unit || 'Hari',
      sent_at: txData.sent_at || new Date().toISOString(),
      expires_at: txData.expires_at || null,
      status: txData.status || 'TERKIRIM',
      created_at: new Date().toISOString()
    };
    transactions.unshift(newTx);
    this._set(this.STORAGE_KEYS.TRANSACTIONS, transactions);
    await upsertToSupabase(SUPABASE_TABLES.TRANSACTIONS, newTx);
    return newTx;
  }

  // --- Activity Logs ---
  getActivityLogs() {
    return this._get(this.STORAGE_KEYS.ACTIVITY_LOGS);
  }

  async addActivityLog(adminId, action, targetType, description, targetId = '') {
    const logs = this.getActivityLogs();
    const newLog = {
      id: this._generateId(),
      admin_id: adminId || 'admin',
      action: action || 'Aktivitas',
      target_type: targetType || 'sistem',
      target_id: targetId || '',
      description: description || '',
      created_at: new Date().toISOString()
    };
    logs.unshift(newLog);
    this._set(this.STORAGE_KEYS.ACTIVITY_LOGS, logs);
    await upsertToSupabase(SUPABASE_TABLES.ACTIVITY_LOGS, newLog);
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
    return cleanInput === activePin;
  }

  async updateAdminPassword(username, newPin) {
    const cleanPin = String(newPin || '2001').trim();
    const settings = this.getSettings();
    settings.admin_pin = cleanPin;
    await this.saveSettings(settings);

    let adminUsers = this._get(this.STORAGE_KEYS.ADMIN_USERS);
    const passHash = await CryptoUtil.hashPassword(cleanPin);

    if (adminUsers.length > 0) {
      adminUsers[0].password_hash = passHash;
    } else {
      adminUsers.push({
        id: 'admin_1',
        username: 'admin',
        password_hash: passHash,
        role: 'SUPER_ADMIN',
        created_at: new Date().toISOString()
      });
    }
    this._set(this.STORAGE_KEYS.ADMIN_USERS, adminUsers);
    await upsertToSupabase(SUPABASE_TABLES.ADMIN_USERS, adminUsers);
    return true;
  }

  // --- Settings ---
  getSettings() {
    const data = localStorage.getItem(this.STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      web_name: 'AccExpress Seller Hub',
      shop_name: 'AccExpress Digital Store',
      shop_whatsapp: '081234567890',
      admin_pin: '2001',
      timezone: 'Asia/Jakarta (UTC+7)'
    };
  }

  async saveSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(updated));

    const settingsRecord = {
      id: 'main_settings',
      ...updated,
      updated_at: new Date().toISOString()
    };
    await upsertToSupabase(SUPABASE_TABLES.SETTINGS, settingsRecord);
    return updated;
  }
}

export const db = new AccExpressDB();
