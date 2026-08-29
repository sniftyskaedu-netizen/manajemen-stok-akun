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
  ADMIN_USERS: 'accexpress_admin_users'
};

export async function fetchAllFromSupabase(tableName) {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from(tableName).select('*');
    if (error) {
      console.warn(`[Supabase] Fetch error for table ${tableName}:`, error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn(`[Supabase] Network/Fetch exception for table ${tableName}:`, err);
    return null;
  }
}

export async function upsertToSupabase(tableName, records) {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const payload = Array.isArray(records) ? records : [records];
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
