import { createClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env as Record<string, string | undefined>;
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

/** Supabase未設定の場合は null（ゲームライブラリ機能が無効になる） */
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const isSupabaseEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export interface LibraryGame {
  id: string;
  user_id: string;
  name: string;
  html: string;
  provider: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}
