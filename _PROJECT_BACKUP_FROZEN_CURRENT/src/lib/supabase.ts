import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};
const rawUrl = metaEnv.VITE_SUPABASE_URL || 'https://evhwqlnymvoduclmzshz.supabase.co';
export const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const formatSupabaseUrl = (url: string): string => {
  if (!url) return 'https://evhwqlnymvoduclmzshz.supabase.co';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // If user provided project ref ID (e.g. evhwqlnymvoduclmzshz)
  if (/^[a-z0-9-]+$/i.test(trimmed)) {
    return `https://${trimmed}.supabase.co`;
  }
  return 'https://evhwqlnymvoduclmzshz.supabase.co';
};

export const supabaseUrl = formatSupabaseUrl(rawUrl);

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder')
);

let client: any = null;
if (isSupabaseConfigured) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('Failed to initialize client-side Supabase:', err);
    client = null;
  }
}

export const supabase = client;

/**
 * Checks if an error returned by Supabase indicates that the database table, RPC function,
 * or relation has not been created yet in the Supabase schema cache.
 */
export const isTableMissingError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  return (
    code === 'PGRST205' || // Could not find table in schema cache
    code === 'PGRST202' || // Could not find function in schema cache
    code === '42P01' || // relation does not exist
    code === 'PGRST116' || // not found or schema cache issue
    code === '42883' || // function does not exist
    code === 'PGRST204' || // columns not found in schema cache
    code === 'PGRST200' ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the function') ||
    msg.includes('in the schema cache') ||
    msg.includes('relation') ||
    msg.includes('does not exist') ||
    details.includes('schema cache') ||
    details.includes('could not find')
  );
};

