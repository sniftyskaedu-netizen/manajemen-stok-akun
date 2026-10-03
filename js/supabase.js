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

export async function upsertToSupabase(tableName, records) {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    let payload = Array.isArray(records) ? records : [records];

    if (tableName === SUPABASE_TABLES.ACCOUNTS && payload.length > 0) {
      const { data: validProducts } = await sb.from(SUPABASE_TABLES.PRODUCTS).select('id');
      const validProdList = validProducts || [];
      const validProdIds = new Set(validProdList.map(p => p.id));
      const fallbackProdId = validProdList.length > 0 ? validProdList[0].id : null;

      payload = payload.map(acc => {
        const cleanAcc = { ...acc };
        if (!cleanAcc.product_id || !validProdIds.has(cleanAcc.product_id)) {
          if (!cleanAcc.product_name) cleanAcc.product_name = cleanAcc.product_id || 'Produk Digital';
          if (fallbackProdId) {
            cleanAcc.product_id = fallbackProdId;
          }
        }
        return cleanAcc;
      });
    }

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
