-- ============================================================
-- ACCEXPRESS SELLER HUB - SUPABASE DATABASE SCHEMA MIGRATION
-- ============================================================

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS accexpress_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  default_duration INT DEFAULT 30,
  duration_unit TEXT DEFAULT 'Hari',
  status TEXT DEFAULT 'Aktif',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ACCOUNTS / INVENTORY TABLE
CREATE TABLE IF NOT EXISTS accexpress_accounts (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES accexpress_products(id) ON DELETE CASCADE,
  product_name TEXT,
  version TEXT,
  access_type TEXT DEFAULT 'ACCOUNT',
  username_or_email TEXT,
  encrypted_password TEXT,
  link TEXT,
  status TEXT DEFAULT 'TERSEDIA',
  customer_whatsapp TEXT,
  duration INT DEFAULT 30,
  duration_unit TEXT DEFAULT 'Hari',
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MESSAGE TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS accexpress_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'GLOBAL',
  product_id TEXT,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS accexpress_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accexpress_accounts(id) ON DELETE SET NULL,
  product_name TEXT,
  customer_whatsapp TEXT,
  amount NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'QRIS',
  status TEXT DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS accexpress_activity_logs (
  id TEXT PRIMARY KEY,
  admin_user TEXT DEFAULT 'staff',
  action TEXT NOT NULL,
  target_type TEXT,
  details TEXT,
  target_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS accexpress_settings (
  id TEXT PRIMARY KEY DEFAULT 'main_settings',
  web_name TEXT DEFAULT 'AccExpress Hub',
  shop_name TEXT DEFAULT 'AccExpress Official Store',
  shop_wa TEXT DEFAULT '081234567890',
  auto_copy BOOLEAN DEFAULT TRUE,
  dark_mode BOOLEAN DEFAULT TRUE,
  notify_expiring BOOLEAN DEFAULT TRUE,
  notify_sound BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS accexpress_admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  pin TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  status TEXT DEFAULT 'Aktif',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ENROLLMENT KEYS / ID KEYS TABLE (DENGAN KOLOM KATEGORI, ASSIGNMENT, & STATUS)
CREATE TABLE IF NOT EXISTS accexpress_id_keys (
  id TEXT PRIMARY KEY,
  category TEXT DEFAULT 'Turnitin No Repository',
  id_key TEXT,
  class_id TEXT,
  assignment TEXT DEFAULT '-',
  enrollment_key TEXT NOT NULL,
  duration INT DEFAULT 1,
  status TEXT DEFAULT 'AKTIF',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- AUTOMATIC MIGRATION: ADD CATEGORY, ASSIGNMENT & STATUS COLUMNS IF NOT EXISTS
-- ------------------------------------------------------------
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='accexpress_id_keys' AND column_name='category'
  ) THEN
    ALTER TABLE accexpress_id_keys ADD COLUMN category TEXT DEFAULT 'Turnitin No Repository';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='accexpress_accounts' AND column_name='product_name'
  ) THEN
    ALTER TABLE accexpress_accounts ADD COLUMN product_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='accexpress_accounts' AND column_name='version'
  ) THEN
    ALTER TABLE accexpress_accounts ADD COLUMN version TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='accexpress_id_keys' AND column_name='assignment'
  ) THEN
    ALTER TABLE accexpress_id_keys ADD COLUMN assignment TEXT DEFAULT '-';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='accexpress_id_keys' AND column_name='status'
  ) THEN
    ALTER TABLE accexpress_id_keys ADD COLUMN status TEXT DEFAULT 'AKTIF';
  END IF;
END $$;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES FOR PUBLIC ANON ACCESS
-- ------------------------------------------------------------
ALTER TABLE accexpress_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE accexpress_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accexpress_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE accexpress_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accexpress_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE accexpress_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE accexpress_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accexpress_id_keys ENABLE ROW LEVEL SECURITY;

-- Create ALL Access Policies for Anonymous Client Sync
DROP POLICY IF EXISTS "Public access products" ON accexpress_products;
CREATE POLICY "Public access products" ON accexpress_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access accounts" ON accexpress_accounts;
CREATE POLICY "Public access accounts" ON accexpress_accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access templates" ON accexpress_templates;
CREATE POLICY "Public access templates" ON accexpress_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access transactions" ON accexpress_transactions;
CREATE POLICY "Public access transactions" ON accexpress_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access activity logs" ON accexpress_activity_logs;
CREATE POLICY "Public access activity logs" ON accexpress_activity_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access settings" ON accexpress_settings;
CREATE POLICY "Public access settings" ON accexpress_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access admin users" ON accexpress_admin_users;
CREATE POLICY "Public access admin users" ON accexpress_admin_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access id keys" ON accexpress_id_keys;
CREATE POLICY "Public access id keys" ON accexpress_id_keys FOR ALL USING (true) WITH CHECK (true);
