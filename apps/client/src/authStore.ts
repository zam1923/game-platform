import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from './supabase';

export const OAUTH_REDIRECT_SCHEME = 'com.gameplatform.app://auth/callback';

interface AuthStore {
  user: User | null;
  session: Session | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  // Supabase未設定なら即 loading=false
  loading: supabase !== null,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setLoading: (loading) => set({ loading }),

  signInWithGoogle: async () => {
    if (!supabase) return;

    if (Capacitor.isNativePlatform()) {
      // Android: カスタムURLスキームでOAuthリダイレクトを処理
      const { data } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: OAUTH_REDIRECT_SCHEME,
          skipBrowserRedirect: true,
        },
      });
      if (data?.url) {
        await Browser.open({ url: data.url });
      }
    } else {
      // Web: 通常のリダイレクト
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
    }
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));

// Supabase Auth の変更を監視
if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session);
    useAuthStore.getState().setLoading(false);
  });

  // 初回ロード時のセッション取得
  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session);
    useAuthStore.getState().setLoading(false);
  });
}
