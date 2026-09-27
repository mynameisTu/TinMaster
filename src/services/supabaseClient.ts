import { createClient } from '@supabase/supabase-js';
import { supabaseAuthStorage } from './authStorage';

const environment = import.meta.env ?? {};
const supabaseUrl = environment.VITE_SUPABASE_URL;
const supabaseAnonKey = environment.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurationError =
  'Cấu hình Supabase chưa đầy đủ. Hãy thiết lập VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: supabaseAuthStorage,
      },
    })
  : null;
