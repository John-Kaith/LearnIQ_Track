/**
 * Reads the expiry (`exp`, seconds since epoch) of a JWT access token without
 * verifying it — the server does that. Only used to refresh the session a
 * little before it runs out.
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBinary(input: string): string {
  if (typeof globalThis.atob === 'function') return globalThis.atob(input);
  // Fallback for runtimes without atob.
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const ch of input.replace(/=+$/, '')) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}

export function jwtExpiry(token: string | null | undefined): number | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    // The payload may hold non-ASCII names; `exp` is plain digits, so a regex
    // on the raw bytes is enough and avoids a UTF-8 decoder.
    const match = /"exp"\s*:\s*(\d+)/.exec(base64ToBinary(padded));
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

/** Seconds until the token expires (negative once expired), or null if unknown. */
export function secondsUntilExpiry(token: string | null | undefined): number | null {
  const exp = jwtExpiry(token);
  return exp == null ? null : exp - Math.floor(Date.now() / 1000);
}
// .
