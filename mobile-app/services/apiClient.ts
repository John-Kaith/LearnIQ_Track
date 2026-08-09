import { API_BASE_URL } from '@/constants/api';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Lazily resolved so apiClient never has to import the auth store directly (would create a cycle). */
let getAccessToken: (() => string | null) | null = null;

export function setAccessTokenGetter(fn: () => string | null) {
  getAccessToken = fn;
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Pass a FormData instance to send multipart/form-data (e.g. photo uploads). */
  formData?: FormData;
  /** Skip attaching the Authorization header for this call (e.g. /login itself). */
  skipAuth?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
};

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Generic request helper shared by every service module.
 * Mirrors the web frontend's `readApiJson` pattern (js/core/api.js): normalized
 * error messages pulled from the backend's `{error: string}` shape, thrown as ApiError.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, formData, skipAuth, query } = options;

  const headers: Record<string, string> = {};
  if (!skipAuth && getAccessToken) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let requestBody: BodyInit | undefined;
  if (formData) {
    requestBody = formData;
    // Do NOT set Content-Type — fetch sets the multipart boundary automatically.
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: requestBody,
    });
  } catch {
    throw new ApiError(
      'Could not reach the LearnIQ server. Check your connection and the API address in settings.',
      0,
    );
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data && String((data as any).error)) ||
      `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return (data ?? ({} as T)) as T;
}
