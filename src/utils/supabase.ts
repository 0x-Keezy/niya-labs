import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors when env vars aren't set
let _supabase: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    return null;
  }
  
  if (!_supabase) {
    _supabase = createClient(url, key);
  }
  
  return _supabase;
};

// Legacy export for compatibility - returns null if not configured
export const supabase = typeof window !== 'undefined' 
  ? getSupabase() 
  : null;
