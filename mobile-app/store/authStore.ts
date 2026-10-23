import { create } from 'zustand';

import { ApiError, apiRequest, setAccessTokenGetter, setAccessTokenRefresher } from '@/services/apiClient';
import { secondsUntilExpiry } from '@/utils/jwt';
import { deleteItem, getItem, setItem } from '@/utils/secureStorage';

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
  /** New access token from the refresh token; signs out when the session is over. */
  refreshSession: () => Promise<string | null>;
  /** The current access token, refreshed first if it has less than `minSeconds` left. */
  ensureFreshSession: (minSeconds?: number) => Promise<string | null>;
  /** Tokens refreshed elsewhere (a game page in the app's WebView). */
  updateTokens: (accessToken: string, refreshToken?: string) => Promise<void>;
};

/** One refresh at a time: Supabase refresh tokens are single use. */
let refreshInFlight: Promise<string | null> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isHydrating: true,
  isLoggingIn: false,
  error: null,

  hydrate: async () => {
    try {
      const raw = await getItem(SESSION_KEY);
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
      await setItem(SESSION_KEY, JSON.stringify(user));
      set({ user, isLoggingIn: false });
      return user;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed.';
      set({ isLoggingIn: false, error: message });
      throw e;
    }
  },

  logout: async () => {
    await deleteItem(SESSION_KEY);
    set({ user: null });
  },

  refreshSession: () => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      const current = get().user;
      if (!current?.refresh_token) return null;
      try {
        const res = await apiRequest<{ access_token?: string; refresh_token?: string }>('/auth/refresh', {
          method: 'POST',
          body: { refresh_token: current.refresh_token },
          skipAuth: true,
          noRefresh: true,
        });
        if (!res.access_token) throw new ApiError('Your session expired. Please sign in again.', 401);
        // Signed out (or someone else signed in) while this was in flight.
        if (get().user?.id_number !== current.id_number) return null;
        const next: AuthUser = {
          ...current,
          access_token: res.access_token,
          refresh_token: res.refresh_token || current.refresh_token,
        };
        await setItem(SESSION_KEY, JSON.stringify(next));
        set({ user: next });
        return next.access_token;
      } catch (e) {
        // The server said the session is over: sign out. A network error keeps
        // the session so the app still works once the connection is back.
        if (e instanceof ApiError && (e.status === 400 || e.status === 401)) {
          await get().logout();
        }
        return null;
      }
    })();
    return refreshInFlight.finally(() => {
      refreshInFlight = null;
    });
  },

  ensureFreshSession: async (minSeconds = 300) => {
    const token = get().user?.access_token ?? null;
    if (!token) return null;
    const left = secondsUntilExpiry(token);
    if (left != null && left > minSeconds) return token;
    return (await get().refreshSession()) ?? (left != null && left > 0 ? token : null);
  },

  updateTokens: async (accessToken, refreshToken) => {
    const current = get().user;
    if (!current || !accessToken || accessToken === current.access_token) return;
    const next: AuthUser = {
      ...current,
      access_token: accessToken,
      refresh_token: refreshToken || current.refresh_token,
    };
    await setItem(SESSION_KEY, JSON.stringify(next));
    set({ user: next });
  },
}));

// Wire apiClient's Authorization header to whatever user is currently signed in,
// without apiClient importing this store directly (avoids an import cycle).
setAccessTokenGetter(() => useAuthStore.getState().user?.access_token ?? null);
setAccessTokenRefresher(() => useAuthStore.getState().refreshSession());
// .
