/**
 * AccExpress Supabase Client & Remote Sync Module
 */

const SUPABASE_URL = 'https://znfoalvfqwkbenvxbyri.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZm9hbHZmcXdrYmVudnhieXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjQ5NTQsImV4cCI6MjEwMzUwMDk1NH0.6TP0sD8YT51luiB_NZrrHhSWWseoL3NWGJuxGYATEts';

let supabaseClient = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  }
  return null;
}

export const SUPABASE_TABLES = {
  PRODUCTS: 'accexpress_products',
  ACCOUNTS: 'accexpress_accounts',
  TEMPLATES: 'accexpress_templates',
  TRANSACTIONS: 'accexpress_transactions',
  ACTIVITY_LOGS: 'accexpress_activity_logs',
  SETTINGS: 'accexpress_settings',
  ADMIN_USERS: 'accexpress_admin_users',
  ID_KEYS: 'accexpress_id_keys'
};

export async function fetchAllFromSupabase(tableName) {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    let allData = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await sb
        .from(tableName)
        .select('*')
        .range(from, from + step - 1);

      if (error) {
        console.warn(`[Supabase] Fetch error for table ${tableName}:`, error);
        break;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < step) {
          keepFetching = false;
        } else {
          from += step;
        }
      } else {
        keepFetching = false;
      }
    }
    return allData;
  } catch (err) {
    console.warn(`[Supabase] Network/Fetch exception for table ${tableName}:`, err);
    return null;
  }
}

const KNOWN_TABLE_COLUMNS = {
  [SUPABASE_TABLES.ACCOUNTS]: [
    'id', 'product_id', 'product_name', 'version', 'access_type', 'username_or_email', 'encrypted_password',
    'link', 'status', 'customer_whatsapp', 'duration', 'duration_unit',
    'sent_at', 'expires_at', 'notes', 'created_at', 'updated_at'
  ],
  [SUPABASE_TABLES.PRODUCTS]: [
    'id', 'name', 'description', 'default_duration', 'duration_unit', 'status', 'version', 'created_at', 'updated_at'
  ],
  [SUPABASE_TABLES.TEMPLATES]: [
    'id', 'name', 'type', 'product_id', 'content', 'is_default', 'created_at', 'updated_at'
  ],
  [SUPABASE_TABLES.ID_KEYS]: [
    'id', 'category', 'id_key', 'class_id', 'assignment', 'status', 'created_at', 'updated_at'
  ],
  [SUPABASE_TABLES.TRANSACTIONS]: [
    'id', 'account_id', 'product_id', 'customer_whatsapp', 'delivery_method', 'duration', 'duration_unit', 'sent_at', 'expires_at', 'status', 'created_at'
  ]
};

export async function upsertToSupabase(tableName, records) {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const rawPayload = Array.isArray(records) ? records : [records];
    if (!rawPayload || rawPayload.length === 0) return true;

    let validProdIds = null;
    let fallbackProdId = null;

    if (tableName === SUPABASE_TABLES.ACCOUNTS) {
      const { data: validProducts } = await sb.from(SUPABASE_TABLES.PRODUCTS).select('id');
      if (validProducts && validProducts.length > 0) {
        validProdIds = new Set(validProducts.map(p => p.id));
        fallbackProdId = validProducts[0].id;
      }
    }

    const allowedColumns = KNOWN_TABLE_COLUMNS[tableName];

    const payload = rawPayload.map(item => {
      const cleanItem = {};

      if (allowedColumns && Array.isArray(allowedColumns)) {
        allowedColumns.forEach(col => {
          if (Object.prototype.hasOwnProperty.call(item, col) && item[col] !== undefined) {
            cleanItem[col] = item[col];
          }
        });
      } else {
        Object.assign(cleanItem, item);
      }

      if (tableName === SUPABASE_TABLES.ACCOUNTS) {
        if (!cleanItem.product_id) {
          if (fallbackProdId) {
            cleanItem.product_id = fallbackProdId;
          }
        }
      }

      return cleanItem;
    });

    const { error } = await sb.from(tableName).upsert(payload);
    if (error) {
      console.error(`[Supabase] Upsert error on ${tableName}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Supabase] Upsert exception on ${tableName}:`, err);
    return false;
  }
}

export async function deleteFromSupabase(tableName, id) {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from(tableName).delete().eq('id', id);
    if (error) {
      console.error(`[Supabase] Delete error on ${tableName} (id: ${id}):`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Supabase] Delete exception on ${tableName}:`, err);
    return false;
  }
}
