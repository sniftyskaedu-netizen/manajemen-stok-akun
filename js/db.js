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
      SETTINGS: 'accexpress_settings',
      ID_KEYS: 'accexpress_id_keys',
      VERSIONS: 'accexpress_versions'
    };
  }

  async init() {
    // 1. Sync data dari database Cloud Supabase dan AWAIT hasilnya agar cache & memory tersinkron penuh
    await this.syncFromSupabase().catch(e => console.warn('[Supabase Sync Init Warning]:', e));

    // 2. Jika data lokal & remote masih kosong (belum ada admin / produk / akun), jalankan seeding awal
    const localAccounts = this._get(this.STORAGE_KEYS.ACCOUNTS);
    const localProducts = this._get(this.STORAGE_KEYS.PRODUCTS);
    const localAdmins = this._get(this.STORAGE_KEYS.ADMIN_USERS);
    if ((!localAdmins || localAdmins.length === 0) && (!localAccounts || localAccounts.length === 0) && (!localProducts || localProducts.length === 0)) {
      await this.seedInitialData();
    }

    // 3. Otomatis klasifikasikan versi produk berdasarkan kata kunci nama produk
    this.autoClassifyAllProducts();

    // 4. Update status akun expired secara otomatis
    this.updateAutomaticExpirations().catch(e => console.warn(e));
  }

  // --- Remote Cloud Sync Methods ---
  async syncFromSupabase() {
    try {
      const [remoteProducts, remoteAccounts, remoteTemplates, remoteTx, remoteLogs, remoteSettings, remoteAdmin, remoteIdKeys] = await Promise.all([
        fetchAllFromSupabase(SUPABASE_TABLES.PRODUCTS),
        fetchAllFromSupabase(SUPABASE_TABLES.ACCOUNTS),
        fetchAllFromSupabase(SUPABASE_TABLES.TEMPLATES),
        fetchAllFromSupabase(SUPABASE_TABLES.TRANSACTIONS),
        fetchAllFromSupabase(SUPABASE_TABLES.ACTIVITY_LOGS),
        fetchAllFromSupabase(SUPABASE_TABLES.SETTINGS),
        fetchAllFromSupabase(SUPABASE_TABLES.ADMIN_USERS),
        fetchAllFromSupabase(SUPABASE_TABLES.ID_KEYS)
      ]);

      const mergeCollection = (storageKey, remoteList, tableName) => {
        if (!Array.isArray(remoteList)) return;
        const localList = this._get(storageKey) || [];
        const mergedMap = new Map();
        const pendingPush = [];

        remoteList.forEach(item => {
          if (item && item.id) mergedMap.set(String(item.id), item);
        });

        localList.forEach(localItem => {
          if (!localItem || !localItem.id) return;
          const id = String(localItem.id);
          if (!mergedMap.has(id)) {
            mergedMap.set(id, localItem);
            pendingPush.push(localItem);
          } else {
            const remoteItem = mergedMap.get(id);
            const localTime = new Date(localItem.updated_at || localItem.created_at || 0).getTime();
            const remoteTime = new Date(remoteItem.updated_at || remoteItem.created_at || 0).getTime();
            if (localTime > remoteTime) {
              mergedMap.set(id, { ...remoteItem, ...localItem });
              pendingPush.push(localItem);
            } else {
              // Remote item timestamp is newer or equal: merge local fields so local-only properties are preserved
              mergedMap.set(id, { ...localItem, ...remoteItem });
            }
          }
        });

        const finalList = Array.from(mergedMap.values());
        this._set(storageKey, finalList);

        if (pendingPush.length > 0 && tableName) {
          upsertToSupabase(tableName, pendingPush).catch(e => console.warn(`[Supabase Sync Push Error ${tableName}]:`, e));
        }
      };

      mergeCollection(this.STORAGE_KEYS.PRODUCTS, remoteProducts, SUPABASE_TABLES.PRODUCTS);
      mergeCollection(this.STORAGE_KEYS.ACCOUNTS, remoteAccounts, SUPABASE_TABLES.ACCOUNTS);
      mergeCollection(this.STORAGE_KEYS.TEMPLATES, remoteTemplates, SUPABASE_TABLES.TEMPLATES);
      mergeCollection(this.STORAGE_KEYS.TRANSACTIONS, remoteTx, SUPABASE_TABLES.TRANSACTIONS);
      mergeCollection(this.STORAGE_KEYS.ACTIVITY_LOGS, remoteLogs, SUPABASE_TABLES.ACTIVITY_LOGS);
      mergeCollection(this.STORAGE_KEYS.ADMIN_USERS, remoteAdmin, SUPABASE_TABLES.ADMIN_USERS);
      mergeCollection(this.STORAGE_KEYS.ID_KEYS, remoteIdKeys, SUPABASE_TABLES.ID_KEYS);

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
      upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, updatedAccs).catch(e => console.warn('[Supabase Expiration Sync Warning]:', e));
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
        version: '',
        sub_category: 'Profile Shared 4K Ultra HD',
        description: 'Akun Netflix Ultra HD 4K Profile Shared / Private',
        default_duration: 30,
        duration_unit: 'Hari',
        status: 'Aktif',
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_spotify',
        name: 'Spotify Premium',
        version: '',
        sub_category: 'Individual & Family Plan',
        description: 'Akun Spotify Individual / Family Plan Premium',
        default_duration: 30,
        duration_unit: 'Hari',
        status: 'Aktif',
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_canva',
        name: 'Canva Pro',
        version: '',
        sub_category: 'Link Undangan Team Member',
        description: 'Canva Pro Lifetime / Member Invitation',
        default_duration: 1,
        duration_unit: 'Bulan',
        status: 'Aktif',
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_youtube',
        name: 'YouTube Premium',
        version: '',
        sub_category: 'Individual & Music Plan',
        description: 'YouTube Premium & Music Individual Plan',
        default_duration: 30,
        duration_unit: 'Hari',
        status: 'Aktif',
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_chatgpt',
        name: 'ChatGPT Plus',
        version: '',
        sub_category: 'GPT-4o Access Private Account',
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

    const now = new Date();
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
        created_at: now.toISOString()
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
        created_at: now.toISOString()
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
        created_at: now.toISOString()
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
        created_at: now.toISOString()
      },
      // --- 10 SAMPEL AKUN AKAN EXPIRED (< 12 JAM) ---
      {
        id: 'sample_soon_1',
        product_id: 'prod_netflix',
        access_type: 'ACCOUNT',
        username_or_email: 'netflix.exp1@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'TERKIRIM',
        customer_whatsapp: '081234567001',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - (29 * 24 + 21) * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() + 3 * 3600 * 1000).toISOString(),
        notes: 'Profile 1 PIN 1111',
        created_at: now.toISOString()
      },
      {
        id: 'sample_soon_2',
        product_id: 'prod_spotify',
        access_type: 'ACCOUNT',
        username_or_email: 'spotify.exp2@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'TERKIRIM',
        customer_whatsapp: '081234567002',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - (29 * 24 + 19) * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() + 5 * 3600 * 1000).toISOString(),
        notes: 'Family Plan Slot 1',
        created_at: now.toISOString()
      },
      {
        id: 'sample_soon_3',
        product_id: 'prod_canva',
        access_type: 'LINK',
        username_or_email: 'https://canva.com/brand/join?invite=sample_exp_3',
        encrypted_password: '',
        link: 'https://canva.com/brand/join?invite=sample_exp_3',
        status: 'TERKIRIM',
        customer_whatsapp: '081234567003',
        duration: 1,
        duration_unit: 'Bulan',
        sent_at: new Date(now.getTime() - (29 * 24 + 22) * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() + 2 * 3600 * 1000).toISOString(),
        notes: 'Member Team Invite',
        created_at: now.toISOString()
      },
      {
        id: 'sample_soon_4',
        product_id: 'prod_youtube',
        access_type: 'ACCOUNT',
        username_or_email: 'youtube.exp4@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'TERKIRIM',
        customer_whatsapp: '081234567004',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - (29 * 24 + 16) * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() + 8 * 3600 * 1000).toISOString(),
        notes: 'Individual No Ads',
        created_at: now.toISOString()
      },
      {
        id: 'sample_soon_5',
        product_id: 'prod_chatgpt',
        access_type: 'ACCOUNT',
        username_or_email: 'chatgpt.exp5@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'TERKIRIM',
        customer_whatsapp: '081234567005',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - (29 * 24 + 20) * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() + 4 * 3600 * 1000).toISOString(),
        notes: 'GPT-4o Access',
        created_at: now.toISOString()
      },
      {
        id: 'sample_soon_6',
        product_id: 'prod_netflix',
        access_type: 'ACCOUNT',
        username_or_email: 'netflix.exp6@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'TERKIRIM',
        customer_whatsapp: '081234567006',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - (29 * 24 + 17) * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() + 7 * 3600 * 1000).toISOString(),
        notes: 'Profile 2 PIN 2222',
        created_at: now.toISOString()
      },
      {
        id: 'sample_soon_7',
        product_id: 'prod_spotify',
        access_type: 'ACCOUNT',
        username_or_email: 'spotify.exp7@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'TERKIRIM',
        customer_whatsapp: '081234567007',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - (29 * 24 + 15) * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() + 9 * 3600 * 1000).toISOString(),
        notes: 'Indo Region VIP',
        created_at: now.toISOString()
      },
      {
        id: 'sample_soon_8',
        product_id: 'prod_canva',
        access_type: 'LINK',
        username_or_email: 'https://canva.com/brand/join?invite=sample_exp_8',
        encrypted_password: '',
        link: 'https://canva.com/brand/join?invite=sample_exp_8',
        status: 'TERKIRIM',
        customer_whatsapp: '081234567008',
        duration: 1,
        duration_unit: 'Bulan',
        sent_at: new Date(now.getTime() - (29 * 24 + 23) * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() + 1 * 3600 * 1000).toISOString(),
        notes: 'Canva Pro Link',
        created_at: now.toISOString()
      },
      {
        id: 'sample_soon_9',
        product_id: 'prod_youtube',
        access_type: 'ACCOUNT',
        username_or_email: 'youtube.exp9@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'TERKIRIM',
        customer_whatsapp: '081234567009',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - (29 * 24 + 18) * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() + 6 * 3600 * 1000).toISOString(),
        notes: 'YouTube Premium',
        created_at: now.toISOString()
      },
      {
        id: 'sample_soon_10',
        product_id: 'prod_chatgpt',
        access_type: 'ACCOUNT',
        username_or_email: 'chatgpt.exp10@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'TERKIRIM',
        customer_whatsapp: '081234567010',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - (29 * 24 + 13) * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() + 11 * 3600 * 1000).toISOString(),
        notes: 'Private Plus Account',
        created_at: now.toISOString()
      },

      // --- 10 SAMPEL AKUN EXPIRED ---
      {
        id: 'sample_old_1',
        product_id: 'prod_netflix',
        access_type: 'ACCOUNT',
        username_or_email: 'netflix.old1@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'EXPIRED',
        customer_whatsapp: '081987654001',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - 31 * 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString(),
        notes: 'Profile 3 PIN 3333',
        created_at: now.toISOString()
      },
      {
        id: 'sample_old_2',
        product_id: 'prod_spotify',
        access_type: 'ACCOUNT',
        username_or_email: 'spotify.old2@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'EXPIRED',
        customer_whatsapp: '081987654002',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - 33 * 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString(),
        notes: 'Individual Plan',
        created_at: now.toISOString()
      },
      {
        id: 'sample_old_3',
        product_id: 'prod_canva',
        access_type: 'LINK',
        username_or_email: 'https://canva.com/brand/join?invite=sample_old_3',
        encrypted_password: '',
        link: 'https://canva.com/brand/join?invite=sample_old_3',
        status: 'EXPIRED',
        customer_whatsapp: '081987654003',
        duration: 1,
        duration_unit: 'Bulan',
        sent_at: new Date(now.getTime() - 32 * 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
        notes: 'Expired Team Member',
        created_at: now.toISOString()
      },
      {
        id: 'sample_old_4',
        product_id: 'prod_youtube',
        access_type: 'ACCOUNT',
        username_or_email: 'youtube.old4@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'EXPIRED',
        customer_whatsapp: '081987654004',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - 35 * 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString(),
        notes: 'Individual Music',
        created_at: now.toISOString()
      },
      {
        id: 'sample_old_5',
        product_id: 'prod_chatgpt',
        access_type: 'ACCOUNT',
        username_or_email: 'chatgpt.old5@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'EXPIRED',
        customer_whatsapp: '081987654005',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - 34 * 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString(),
        notes: 'ChatGPT Plus Shared',
        created_at: now.toISOString()
      },
      {
        id: 'sample_old_6',
        product_id: 'prod_netflix',
        access_type: 'ACCOUNT',
        username_or_email: 'netflix.old6@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'EXPIRED',
        customer_whatsapp: '081987654006',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - 37 * 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString(),
        notes: 'Profile 4 PIN 4444',
        created_at: now.toISOString()
      },
      {
        id: 'sample_old_7',
        product_id: 'prod_spotify',
        access_type: 'ACCOUNT',
        username_or_email: 'spotify.old7@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'EXPIRED',
        customer_whatsapp: '081987654007',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - 36 * 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() - 6 * 24 * 3600 * 1000).toISOString(),
        notes: 'Family Member 2',
        created_at: now.toISOString()
      },
      {
        id: 'sample_old_8',
        product_id: 'prod_canva',
        access_type: 'LINK',
        username_or_email: 'https://canva.com/brand/join?invite=sample_old_8',
        encrypted_password: '',
        link: 'https://canva.com/brand/join?invite=sample_old_8',
        status: 'EXPIRED',
        customer_whatsapp: '081987654008',
        duration: 1,
        duration_unit: 'Bulan',
        sent_at: new Date(now.getTime() - 40 * 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
        notes: 'Team Link Old',
        created_at: now.toISOString()
      },
      {
        id: 'sample_old_9',
        product_id: 'prod_youtube',
        access_type: 'ACCOUNT',
        username_or_email: 'youtube.old9@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'EXPIRED',
        customer_whatsapp: '081987654009',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - 42 * 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() - 12 * 24 * 3600 * 1000).toISOString(),
        notes: 'YT Premium 2026',
        created_at: now.toISOString()
      },
      {
        id: 'sample_old_10',
        product_id: 'prod_chatgpt',
        access_type: 'ACCOUNT',
        username_or_email: 'chatgpt.old10@accexpress.com',
        encrypted_password: '',
        link: '',
        status: 'EXPIRED',
        customer_whatsapp: '081987654010',
        duration: 30,
        duration_unit: 'Hari',
        sent_at: new Date(now.getTime() - 45 * 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(now.getTime() - 15 * 24 * 3600 * 1000).toISOString(),
        notes: 'GPT-4 Account Old',
        created_at: now.toISOString()
      }
    ];
    const existingAccounts = this._get(this.STORAGE_KEYS.ACCOUNTS);
    if (!existingAccounts || existingAccounts.length === 0) {
      this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
      await upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, accounts);
    }

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

    // 5. Sample ID Keys & Enrollment Data
    const sampleIdKeys = [
      {
        id: 'idkey_1',
        id_key: '45829102',
        class_id: '45829102',
        enrollment_key: 'Turnitin2026',
        duration: 2,
        notes: 'Kelas Turnitin Regular A',
        created_at: new Date(now.getTime() - (1 * 24 + 5) * 3600 * 1000).toISOString()
      },
      {
        id: 'idkey_2',
        id_key: '45829103',
        class_id: '45829103',
        enrollment_key: 'ExpressPass88',
        duration: 7,
        notes: 'Kelas Turnitin Premium B',
        created_at: new Date(now.getTime() - (3 * 24 + 12) * 3600 * 1000).toISOString()
      },
      {
        id: 'idkey_3',
        id_key: '45829104',
        class_id: '45829104',
        enrollment_key: 'ClassKey99',
        duration: 2,
        notes: 'Moodle LMS Fast Track',
        created_at: new Date(now.getTime() - (3 * 24 + 2) * 3600 * 1000).toISOString()
      }
    ];
    this._set(this.STORAGE_KEYS.ID_KEYS, sampleIdKeys);
    await upsertToSupabase(SUPABASE_TABLES.ID_KEYS, sampleIdKeys);

    // 6. Initial Settings
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

    // 7. Activity Log Initial
    await this.addActivityLog('system', 'System Seed', 'system', 'Database successfully initialized with Supabase seed data');
  }

  // --- ID Keys & Enrollment CRUD ---
  getIdKeys() {
    const raw = localStorage.getItem(this.STORAGE_KEYS.ID_KEYS);
    if (!raw) return [];
    try {
      const items = JSON.parse(raw) || [];
      const now = new Date();
      return items.map(k => {
        const num = parseInt(String(k.assignment || k.assignment_count || 1).replace(/\D/g, ''), 10) || 1;
        const duration = Number(k.duration) || 1;
        const createdAt = k.created_at ? new Date(k.created_at) : now;
        const diffMs = Math.max(0, now.getTime() - createdAt.getTime());
        const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
        const daysPassed = Math.floor(totalHours / 24);
        const hoursPassed = totalHours % 24;

        // Expiration calculation: if diffMs >= duration * 24 * 60 * 60 * 1000, then status = EXPIRED
        const isExpired = diffMs >= (duration * 24 * 60 * 60 * 1000);
        const computedStatus = isExpired ? 'EXPIRED' : 'AKTIF';

        let runningDurationStr = '';
        if (daysPassed > 0) {
          runningDurationStr = hoursPassed > 0 ? `${daysPassed} Hari ${hoursPassed} Jam` : `${daysPassed} Hari`;
        } else if (hoursPassed > 0) {
          runningDurationStr = `${hoursPassed} Jam`;
        } else {
          const minutesPassed = Math.floor(diffMs / (1000 * 60));
          runningDurationStr = minutesPassed > 0 ? `${minutesPassed} Menit` : 'Baru saja';
        }

        return {
          ...k,
          category: k.category || 'Turnitin No Repository',
          id_key: k.id_key || k.class_id || '',
          class_id: k.class_id || k.id_key || '',
          assignment: num,
          assignment_count: num,
          enrollment_key: k.enrollment_key || '',
          duration: duration,
          status: computedStatus,
          running_duration: runningDurationStr,
          days_passed: daysPassed,
          hours_passed: hoursPassed,
          is_expired: isExpired,
          notes: k.notes || '',
          created_at: k.created_at || now.toISOString()
        };
      });
    } catch (e) {
      return [];
    }
  }

  getIdKeyById(id) {
    if (!id) return null;
    return this.getIdKeys().find(k => k.id === id);
  }

  async saveIdKey(keyData) {
    const keys = this.getIdKeys();
    let savedKey = null;

    const classIdVal = keyData.class_id || keyData.id_key || '';
    const durationVal = Number(keyData.duration) || 1;
    const categoryVal = (keyData.category || '').trim() || 'Turnitin No Repository';
    const rawAssignNum = parseInt(String(keyData.assignment || '').replace(/\D/g, ''), 10) || 1;
    const shouldResetCreated = Boolean(keyData.reset_created);

    if (keyData.id && String(keyData.id).trim() !== '') {
      const idx = keys.findIndex(k => k.id === keyData.id);
      if (idx !== -1) {
        keys[idx] = {
          ...keys[idx],
          category: categoryVal,
          id_key: classIdVal,
          class_id: classIdVal,
          assignment: rawAssignNum,
          assignment_count: rawAssignNum,
          enrollment_key: keyData.enrollment_key,
          duration: durationVal,
          notes: keyData.notes || '',
          created_at: shouldResetCreated ? new Date().toISOString() : (keys[idx].created_at || new Date().toISOString()),
          updated_at: new Date().toISOString()
        };
        savedKey = keys[idx];
      }
    }

    if (!savedKey) {
      savedKey = {
        id: this._generateId(),
        category: categoryVal,
        id_key: classIdVal,
        class_id: classIdVal,
        assignment: rawAssignNum,
        assignment_count: rawAssignNum,
        enrollment_key: keyData.enrollment_key,
        duration: durationVal,
        notes: keyData.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      keys.unshift(savedKey);
    }

    this._set(this.STORAGE_KEYS.ID_KEYS, keys);
    upsertToSupabase(SUPABASE_TABLES.ID_KEYS, savedKey).catch(e => console.warn('[Supabase Sync Error]', e));
    return savedKey;
  }

  isDuplicateIdKey(enrollmentKey, excludeId = null) {
    if (!enrollmentKey) return false;
    const cleanKey = String(enrollmentKey).trim().toLowerCase();
    const cleanExcludeId = String(excludeId || '').trim();

    const keys = this.getIdKeys();
    return keys.some(k => {
      if (cleanExcludeId && String(k.id || '').trim() === cleanExcludeId) {
        return false;
      }
      return String(k.enrollment_key || '').trim().toLowerCase() === cleanKey;
    });
  }

  async deleteIdKey(id) {
    const cleanId = String(id || '').trim();
    let keys = this.getIdKeys();
    keys = keys.filter(k => String(k.id || '').trim() !== cleanId);
    this._set(this.STORAGE_KEYS.ID_KEYS, keys);
    deleteFromSupabase(SUPABASE_TABLES.ID_KEYS, cleanId).catch(e => console.warn('[Supabase Sync Error]', e));
    return true;
  }

  async deleteIdKeyCategory(categoryName) {
    const cleanCat = String(categoryName || '').trim();
    if (!cleanCat) return false;

    let keys = this.getIdKeys();
    const cleanCatLower = cleanCat.toLowerCase();

    const deletedKeys = keys.filter(k => (k.category || '').trim().toLowerCase() === cleanCatLower);
    const remainingKeys = keys.filter(k => (k.category || '').trim().toLowerCase() !== cleanCatLower);

    this._set(this.STORAGE_KEYS.ID_KEYS, remainingKeys);

    for (const dKey of deletedKeys) {
      if (dKey.id) {
        await deleteFromSupabase(SUPABASE_TABLES.ID_KEYS, dKey.id);
      }
    }
    return true;
  }

  // --- Products CRUD ---
  getProducts() {
    return this._get(this.STORAGE_KEYS.PRODUCTS);
  }

  getActiveProducts() {
    return this.getProducts().filter(p => p.status === 'Aktif' || p.status === 'Active' || (p.status !== 'Tidak Aktif' && p.status !== 'Inactive'));
  }

  getProductById(id) {
    if (!id) return null;
    return this.getProducts().find(p => p.id === id || p.name === id);
  }

  // --- Versions CRUD ---
  getVersions() {
    const raw = localStorage.getItem(this.STORAGE_KEYS.VERSIONS);
    let list = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch (e) { list = []; }
    }
    const defaultVersions = ['OLD VIEW', 'NEW VIEW', 'NEW VIEW V2'];
    if (!Array.isArray(list) || list.length === 0) {
      list = defaultVersions;
      localStorage.setItem(this.STORAGE_KEYS.VERSIONS, JSON.stringify(list));
    } else {
      if (list.includes('Default View')) {
        list = list.filter(v => v !== 'Default View' && String(v).trim() !== '');
        localStorage.setItem(this.STORAGE_KEYS.VERSIONS, JSON.stringify(list));
      }
    }
    return list;
  }

  detectVersionFromText(text = '') {
    if (!text) return '';
    const upper = String(text).toUpperCase();
    if (upper.includes('NEW VIEW V2') || upper.includes('NEW VIEW 2') || upper.includes('V2')) {
      return 'NEW VIEW V2';
    }
    if (upper.includes('NEW VIEW') || upper.includes('NEW')) {
      return 'NEW VIEW';
    }
    if (upper.includes('OLD VIEW') || upper.includes('OLD')) {
      return 'OLD VIEW';
    }
    return '';
  }

  autoClassifyAllProducts() {
    // Disabled auto-classification to strictly preserve exact user input
  }

  async addVersion(versionName) {
    const clean = String(versionName || '').trim();
    if (!clean) return false;
    const versions = this.getVersions();
    if (!versions.includes(clean)) {
      versions.push(clean);
      localStorage.setItem(this.STORAGE_KEYS.VERSIONS, JSON.stringify(versions));
    }
    return true;
  }

  async deleteVersion(versionName) {
    const clean = String(versionName || '').trim();
    if (!clean) return false;
    let versions = this.getVersions();
    versions = versions.filter(v => v !== clean);
    if (versions.length === 0) versions = ['NEW VIEW'];
    localStorage.setItem(this.STORAGE_KEYS.VERSIONS, JSON.stringify(versions));
    return true;
  }

  getMainCategoryForProduct(prod) {
    if (!prod) return '';
    if (prod.version && String(prod.version).trim()) return prod.version.trim();
    if (prod.main_category && String(prod.main_category).trim()) return prod.main_category.trim();

    const detected = this.detectVersionFromText((prod.name || '') + ' ' + (prod.sub_category || '') + ' ' + (prod.description || ''));
    if (detected) return detected;

    return 'OLD VIEW';
  }

  getMainCategories() {
    return this.getVersions();
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
    await upsertToSupabase(SUPABASE_TABLES.PRODUCTS, savedProd).catch(e => console.warn('[Supabase Sync Error]', e));
    return savedProd;
  }

  async deleteProduct(id) {
    const prod = this.getProductById(id);
    const prodName = prod ? prod.name : id;
    const prodVersion = prod ? (prod.version || this.getMainCategoryForProduct(prod)) : '';

    // 1. Update status semua akun terkait menjadi EXPIRED & pertahankan nama produknya
    const accounts = this._get(this.STORAGE_KEYS.ACCOUNTS) || [];
    let accountsUpdated = false;

    for (const acc of accounts) {
      if (acc.product_id === id || acc.product_id === prodName) {
        if (!acc.product_name && prodName) {
          acc.product_name = prodName;
        }
        if (!acc.version && prodVersion) {
          acc.version = prodVersion;
        }
        acc.status = 'EXPIRED';
        accountsUpdated = true;
        await upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, acc).catch(e => console.warn('[Supabase Sync Error]', e));
      }
    }

    if (accountsUpdated) {
      this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
    }

    // 2. Hapus produk dari list produk
    const products = this.getProducts().filter(p => p.id !== id);
    this._set(this.STORAGE_KEYS.PRODUCTS, products);
    await deleteFromSupabase(SUPABASE_TABLES.PRODUCTS, id).catch(e => console.warn('[Supabase Sync Error]', e));
  }

  // --- Accounts CRUD ---
  getAccounts() {
    const accounts = this._get(this.STORAGE_KEYS.ACCOUNTS);
    const now = new Date();
    let hasExpired = false;

    accounts.forEach(acc => {
      if (acc.status === 'TERKIRIM' && acc.expires_at) {
        const expDate = new Date(acc.expires_at);
        if (now >= expDate) {
          acc.status = 'EXPIRED';
          hasExpired = true;
        }
      }
    });

    if (hasExpired) {
      this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
      this.updateAutomaticExpirations().catch(e => console.warn(e));
    }

    return accounts.sort((a, b) => {
      const dateA = a.sent_at ? new Date(a.sent_at).getTime() : (a.updated_at ? new Date(a.updated_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0));
      const dateB = b.sent_at ? new Date(b.sent_at).getTime() : (b.updated_at ? new Date(b.updated_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0));
      return dateB - dateA;
    });
  }

  // --- CEK PERINGATAN DUPLIKAT EMAIL, PASSWORD, ATAU LINK DI DAFTAR AKUN ---
  async checkDuplicateAccount(usernameOrEmail = '', rawPassword = '', link = '', excludeId = null) {
    const accounts = this.getAccounts();
    const cleanUser = (usernameOrEmail || '').trim().toLowerCase();
    const cleanPass = (rawPassword || '').trim();
    const cleanLink = (link || '').trim().toLowerCase();

    for (const acc of accounts) {
      if (excludeId && String(acc.id) === String(excludeId)) continue;
      // ABAYKAN AKUN DENGAN STATUS EXPIRED AGAR BISA DITAMBAHKAN KEMBALI
      if (acc.status === 'EXPIRED') continue;

      const accUser = (acc.username_or_email || '').trim().toLowerCase();
      const accLink = (acc.link || '').trim().toLowerCase();

      // 1. CEK DUPLIKAT EMAIL / USERNAME
      if (cleanUser && accUser && accUser === cleanUser) {
        return {
          isDuplicate: true,
          type: 'email',
          value: usernameOrEmail.trim(),
          message: `• Email / Username "${usernameOrEmail.trim()}" sudah ada di daftar akun database.`
        };
      }

      // 2. CEK DUPLIKAT LINK / URL AKSES
      if (cleanLink && ((accLink && accLink === cleanLink) || (accUser && accUser === cleanLink))) {
        return {
          isDuplicate: true,
          type: 'link',
          value: link.trim(),
          message: `• Link Akses "${link.trim()}" sudah ada di daftar akun database.`
        };
      }

      // 3. CEK DUPLIKAT PASSWORD
      if (cleanPass && acc.encrypted_password) {
        const decryptedPass = await CryptoUtil.decrypt(acc.encrypted_password);
        if (decryptedPass && decryptedPass.trim() === cleanPass) {
          return {
            isDuplicate: true,
            type: 'password',
            value: rawPassword.trim(),
            message: `• Password "${rawPassword.trim()}" sudah terdaftar/digunakan pada akun lain di database.`
          };
        }
      }
    }

    return { isDuplicate: false };
  }

  // Backward compatibility wrapper
  async isDuplicateAccount(usernameOrEmail, rawPassword = '', excludeId = null) {
    const res = await this.checkDuplicateAccount(usernameOrEmail, rawPassword, '', excludeId);
    return res.isDuplicate;
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

    // JIKA TIDAK ADA ID, CEK APAKAH ADA AKUN STATUS EXPIRED DENGAN EMAIL/LINK SAMA UNTUK DIPERBARUI
    if (!accData.id) {
      const isLinkType = accData.access_type === 'LINK' || Boolean(accData.link);
      const mainIdent = isLinkType
        ? (accData.link || accData.username_or_email || '').trim().toLowerCase()
        : (accData.username_or_email || '').trim().toLowerCase();

      if (mainIdent) {
        const existingExpiredAcc = accounts.find(a => {
          if (a.status !== 'EXPIRED') return false;
          const aIsLink = a.access_type === 'LINK' || Boolean(a.link);
          const aIdent = aIsLink
            ? (a.link || a.username_or_email || '').trim().toLowerCase()
            : (a.username_or_email || '').trim().toLowerCase();
          return aIdent === mainIdent;
        });
        if (existingExpiredAcc) {
          accData.id = existingExpiredAcc.id;
        }
      }
    }

    if (accData.id && String(accData.id).trim() !== '') {
      const idx = accounts.findIndex(a => a.id === accData.id);
      if (idx !== -1) {
        const targetProd = this.getProductById(accData.product_id || accounts[idx].product_id);
        accounts[idx] = {
          ...accounts[idx],
          ...accData,
          product_name: targetProd ? targetProd.name : (accData.product_name || accounts[idx].product_name || 'Produk Digital'),
          version: targetProd ? (targetProd.version || this.getMainCategoryForProduct(targetProd)) : (accData.version || accounts[idx].version || ''),
          status: accData.status || (accounts[idx].status === 'EXPIRED' ? 'TERSEDIA' : accounts[idx].status),
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

      const allProducts = this.getProducts();
      const targetProd = this.getProductById(cleanData.product_id) || (allProducts.length > 0 ? allProducts[0] : null);
      const finalProdId = targetProd ? targetProd.id : (cleanData.product_id || 'prod_default');

      savedAcc = {
        id: this._generateId(),
        product_id: finalProdId,
        product_name: targetProd ? targetProd.name : (cleanData.product_name || cleanData.product_id || 'Produk Digital'),
        version: targetProd ? (targetProd.version || this.getMainCategoryForProduct(targetProd)) : (cleanData.version || ''),
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
    await upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, savedAcc).catch(e => console.warn('[Supabase Sync Error]', e));
    return savedAcc;
  }

  // --- EXPIRE MASSAL AKUN BERDASARKAN KATEGORI ---
  async expireAccountsByCategory(productId = '', targetStatusScope = 'ALL_ACTIVE') {
    let accounts = this._get(this.STORAGE_KEYS.ACCOUNTS);
    const now = new Date().toISOString();
    let count = 0;
    const products = this.getProducts();
    let targetProdName = 'Semua Kategori Produk';

    if (productId && productId !== 'ALL') {
      const prod = products.find(p => p.id === productId);
      if (prod) targetProdName = prod.name;
    }

    accounts.forEach(acc => {
      const matchProd = !productId || productId === 'ALL' || acc.product_id === productId;
      let matchScope = false;

      if (targetStatusScope === 'TERSEDIA') {
        matchScope = (acc.status === 'TERSEDIA');
      } else if (targetStatusScope === 'TERKIRIM') {
        matchScope = (acc.status === 'TERKIRIM');
      } else {
        // ALL_ACTIVE (TERSEDIA & TERKIRIM)
        matchScope = (acc.status === 'TERSEDIA' || acc.status === 'TERKIRIM');
      }

      if (matchProd && matchScope) {
        acc.status = 'EXPIRED';
        acc.expires_at = now;
        acc.updated_at = now;
        count++;
      }
    });

    if (count > 0) {
      this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
      await upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, accounts).catch(e => console.warn('[Supabase Sync Error]', e));
      await this.addActivityLog(
        'admin',
        'Mass Expire Akun',
        'akun',
        `Berhasil meng-expiredkan ${count} akun pada kategori "${targetProdName}"`
      );
    }

    return { count, categoryName: targetProdName };
  }

  async deleteAccount(id) {
    const accounts = this.getAccounts().filter(a => a.id !== id);
    this._set(this.STORAGE_KEYS.ACCOUNTS, accounts);
    await deleteFromSupabase(SUPABASE_TABLES.ACCOUNTS, id).catch(e => console.warn('[Supabase Sync Error]', e));
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
      await upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, accounts[idx]).catch(e => console.warn('[Supabase Sync Error]', e));
      return accounts[idx];
    }
    return null;
  }

  // --- BULK UPLOAD STOK AKUN VIA EXCEL ---
  async bulkUploadAccounts(items = [], options = {}) {
    this.updateAutomaticExpirations();
    const accounts = this._get(this.STORAGE_KEYS.ACCOUNTS);
    const products = this.getProducts();

    const results = {
      total: items.length,
      addedCount: 0,
      updatedFromExpiredCount: 0,
      rejectedCount: 0,
      details: []
    };

    const now = new Date().toISOString();
    const updatedAccounts = [...accounts];
    const newOrUpdatedForSupabase = [];

    for (let i = 0; i < items.length; i++) {
      const raw = items[i];

      // Tentukan Product ID (pencocokan nama produk atau ID)
      let prodId = options.defaultProductId || '';
      if (raw.product_name) {
        const pNameClean = String(raw.product_name).trim().toLowerCase();
        const matchedProd = products.find(p => (p.name || '').trim().toLowerCase() === pNameClean || p.id === raw.product_name);
        if (matchedProd) prodId = matchedProd.id;
      }
      if (!prodId && products.length > 0) {
        prodId = products[0].id;
      }

      const accessType = (raw.access_type && String(raw.access_type).toUpperCase() === 'LINK') || raw.link ? 'LINK' : 'ACCOUNT';
      const isLink = accessType === 'LINK';
      const emailOrUser = String(raw.username_or_email || raw.email || raw.username || '').trim();
      const linkUrl = String(raw.link || (isLink ? emailOrUser : '')).trim();
      const rawPass = String(raw.password || '').trim();
      const duration = Number(raw.duration) || Number(options.defaultDuration) || 30;
      const durationUnit = String(raw.duration_unit || options.defaultDurationUnit || 'Hari').trim();
      const notes = String(raw.notes || '').trim();

      const mainIdentifier = isLink ? linkUrl.toLowerCase() : emailOrUser.toLowerCase();

      if (!mainIdentifier) {
        results.rejectedCount++;
        results.details.push({
          row: i + 1,
          identifier: '(Kosong)',
          status: 'REJECTED',
          reason: 'Email / Link Akses kosong'
        });
        continue;
      }

      // Cari apakah akun dengan email / link yang sama sudah ada di daftar akun
      const existingIndex = updatedAccounts.findIndex(acc => {
        const accIsLink = acc.access_type === 'LINK' || Boolean(acc.link);
        const accIdent = accIsLink
          ? (acc.link || acc.username_or_email || '').trim().toLowerCase()
          : (acc.username_or_email || '').trim().toLowerCase();
        return accIdent === mainIdentifier;
      });

      if (existingIndex !== -1) {
        const existingAcc = updatedAccounts[existingIndex];
        if (existingAcc.status === 'EXPIRED') {
          // ATURAN 1: Akun EXPIRED -> Ubah status menjadi TERSEDIA & perbarui data!
          let encPass = existingAcc.encrypted_password || '';
          if (rawPass && !isLink) {
            encPass = await CryptoUtil.encrypt(rawPass);
          }

          updatedAccounts[existingIndex] = {
            ...existingAcc,
            product_id: prodId || existingAcc.product_id,
            access_type: accessType,
            username_or_email: isLink ? linkUrl : emailOrUser,
            encrypted_password: isLink ? '' : (encPass || existingAcc.encrypted_password),
            link: linkUrl,
            status: 'TERSEDIA',
            customer_whatsapp: '',
            duration: duration,
            duration_unit: durationUnit,
            sent_at: null,
            expires_at: null,
            notes: notes || existingAcc.notes || '',
            updated_at: now
          };
          newOrUpdatedForSupabase.push(updatedAccounts[existingIndex]);
          results.updatedFromExpiredCount++;
          results.details.push({
            row: i + 1,
            identifier: isLink ? linkUrl : emailOrUser,
            status: 'UPDATED_EXPIRED',
            reason: 'Akun status EXPIRED diperbarui & diubah menjadi TERSEDIA'
          });
        } else {
          // ATURAN 2: Akun TERSEDIA atau TERKIRIM -> DITOLAK
          results.rejectedCount++;
          results.details.push({
            row: i + 1,
            identifier: isLink ? linkUrl : emailOrUser,
            status: 'REJECTED',
            reason: `Akun sudah ada dengan status ${existingAcc.status} (Ditolak)`
          });
        }
      } else {
        // ATURAN 3: Akun Baru -> Tambahkan ke stok dengan status TERSEDIA
        let encPass = '';
        if (rawPass && !isLink) {
          encPass = await CryptoUtil.encrypt(rawPass);
        }

        const newAcc = {
          id: this._generateId(),
          product_id: prodId,
          access_type: accessType,
          username_or_email: isLink ? linkUrl : emailOrUser,
          encrypted_password: encPass,
          link: linkUrl,
          status: 'TERSEDIA',
          customer_whatsapp: '',
          duration: duration,
          duration_unit: durationUnit,
          sent_at: null,
          expires_at: null,
          notes: notes,
          created_at: now,
          updated_at: now
        };

        updatedAccounts.unshift(newAcc);
        newOrUpdatedForSupabase.push(newAcc);
        results.addedCount++;
        results.details.push({
          row: i + 1,
          identifier: isLink ? linkUrl : emailOrUser,
          status: 'ADDED_NEW',
          reason: 'Akun baru ditambahkan ke stok TERSEDIA'
        });
      }
    }

    this._set(this.STORAGE_KEYS.ACCOUNTS, updatedAccounts);
    if (newOrUpdatedForSupabase.length > 0) {
      await upsertToSupabase(SUPABASE_TABLES.ACCOUNTS, newOrUpdatedForSupabase);
    }

    return results;
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
      // 1. Priority 1: Specific Product Template
      const prodTpl = tpls.find(t => t.type === 'PRODUCT' && t.product_id === productId);
      if (prodTpl) return prodTpl;

      // 2. Priority 2: Specific Version Template
      const prod = this.getProductById(productId);
      if (prod) {
        const prodVersion = this.getMainCategoryForProduct(prod);
        if (prodVersion) {
          const versionTpl = tpls.find(t => t.type === 'VERSION' && ((t.version && t.version === prodVersion) || t.product_id === prodVersion));
          if (versionTpl) return versionTpl;
        }
      }
    }
    // 3. Priority 3: Default / Global Template
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
    const txs = this._get(this.STORAGE_KEYS.TRANSACTIONS);
    return txs.sort((a, b) => {
      const dateA = a.sent_at ? new Date(a.sent_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const dateB = b.sent_at ? new Date(b.sent_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
      return dateB - dateA;
    });
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
