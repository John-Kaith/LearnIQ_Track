import Constants from 'expo-constants';

/**
 * Real backend base URL.
 *
 * A physical device (or a simulator talking to a laptop-hosted backend) can't
 * use "localhost" — it needs the host machine's real LAN IP, or the current
 * Cloudflare quick-tunnel URL when testing against the Ubuntu deployment.
 *
 * Configure it in app.json under `expo.extra.apiBaseUrl`, or override per-run
 * with `EXPO_PUBLIC_API_BASE_URL` (e.g. `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8000 npx expo start`).
 * Falls back to localhost for web/simulator-only testing.
 */
const FALLBACK_API_BASE_URL = 'http://localhost:8000';

function readConfiguredApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };
  if (extra.apiBaseUrl && extra.apiBaseUrl.trim()) return extra.apiBaseUrl.trim();

  return FALLBACK_API_BASE_URL;
}

export const API_BASE_URL = readConfiguredApiBase().replace(/\/+$/, '');
