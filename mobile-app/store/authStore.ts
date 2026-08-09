import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { apiRequest, setAccessTokenGetter } from '@/services/apiClient';

const SESSION_KEY = 'learniq_session_user';

export type LearniqRole = 'student' | 'teacher' | string;

/** Shape of `safe_user` from POST /login (backend/main.py serialize_public_profile + tokens). */
export type AuthUser = {
  id: string;
  id_number: string;
  lrn: string;
  email: string;
  role: LearniqRole;
  display_name: string;
  first_name: string;
  last_name: string;
  grade_level?: string | null;
  strand?: string | null;
  section?: string | null;
  avatar_data?: string;
  access_token: string;
  refresh_token: string;
};

type AuthState = {
  user: AuthUser | null;
  /** True while restoring a persisted session on app boot. */
  isHydrating: boolean;
  isLoggingIn: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isHydrating: true,
  isLoggingIn: false,
  error: null,

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (raw) {
        set({ user: JSON.parse(raw) as AuthUser });
      }
    } catch {
      // Corrupt/unreadable session — treat as logged out.
    } finally {
      set({ isHydrating: false });
    }
  },

  login: async (identifier, password) => {
    set({ isLoggingIn: true, error: null });
    try {
      const res = await apiRequest<{ user: AuthUser }>('/login', {
        method: 'POST',
        body: { identifier, password },
        skipAuth: true,
      });
      const user = res.user;
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(user));
      set({ user, isLoggingIn: false });
      return user;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed.';
      set({ isLoggingIn: false, error: message });
      throw e;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    set({ user: null });
  },
}));

// Wire apiClient's Authorization header to whatever user is currently signed in,
// without apiClient importing this store directly (avoids an import cycle).
setAccessTokenGetter(() => useAuthStore.getState().user?.access_token ?? null);
