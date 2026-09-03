/**
 * Centralized API Client & Routing Helper
 * 
 * Enforces that all Express backend API requests are directed to the deployed Cloud Run backend
 * (https://power-bank-3ib3vyvgja-as.a.run.app)
 * and NEVER resolve to relative /api/* paths or against the Hostinger origin (https://gainpower-top-1.com/api/*).
 */

export const CLOUD_RUN_BACKEND_URL = 'https://power-bank-3ib3vyvgja-as.a.run.app';

/**
 * Resolves and validates the backend base URL.
 * Throws if an invalid origin (such as Hostinger or relative /api) is configured.
 */
export function getApiBaseUrl(): string {
  // Read VITE_API_BASE_URL injected at build time
  const envVal = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).trim()
    : '').trim();

  // If set to an empty string, relative /api, or Hostinger domain, it is strictly forbidden
  if (
    envVal === '/api' ||
    envVal.startsWith('/') ||
    envVal.includes('gainpower-top-1.com')
  ) {
    throw new Error(
      `[API Client Error] Invalid VITE_API_BASE_URL configured: "${envVal}". Production backend requests MUST NOT target Hostinger or relative /api.`
    );
  }

  // If old ais-dev development URL is present, ignore it and use authoritative Cloud Run backend
  if (envVal.includes('ais-dev-')) {
    return CLOUD_RUN_BACKEND_URL;
  }

  // Use configured environment variable if valid, or default to the authoritative Cloud Run backend
  const raw = envVal && !envVal.includes('MY_') ? envVal : CLOUD_RUN_BACKEND_URL;

  // Clean trailing slashes
  let clean = raw.replace(/\/+$/, '');

  // Strip trailing /api if inadvertently included in the env variable
  if (clean.endsWith('/api')) {
    clean = clean.slice(0, -4);
  }

  if (!clean) {
    throw new Error('[API Client Error] VITE_API_BASE_URL is not configured');
  }

  return clean;
}

export const API_BASE_URL: string = getApiBaseUrl();

/**
 * Builds a fully qualified backend API URL.
 * Example: apiUrl('/api/auth/register') => 'https://power-bank-3ib3vyvgja-as.a.run.app/api/auth/register'
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Standardized fetch wrapper for backend Express APIs.
 * Automatically resolves endpoint with apiUrl(), inspects responses for HTML,
 * and guards against network failures or bad endpoints.
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const url = path.startsWith('http://') || path.startsWith('https://') ? path : apiUrl(path);
  const { timeoutMs = 20000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal,
    });
    clearTimeout(timer);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error(
        `Backend returned HTML instead of JSON (${response.status} ${response.statusText}). Request to "${url}" did not reach an active API endpoint.`
      );
    }

    return response;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`API request to ${url} timed out after ${timeoutMs}ms.`);
    }
    throw err;
  }
}

/**
 * Standardized helper to fetch and parse JSON safely from Express backend APIs.
 * Handles HTTP 4xx/5xx, invalid JSON, and HTML responses.
 */
export async function apiFetchJson<T = any>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, options);
  const text = await res.text();

  if (!text || !text.trim()) {
    if (!res.ok) {
      throw new Error(`API error (${res.status}): Empty response from server.`);
    }
    return {} as T;
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON received from ${apiUrl(path)} (${res.status}): ${text.slice(0, 100)}`);
  }

  if (!res.ok) {
    const errMsg = json?.error || json?.message || `API error with status ${res.status}`;
    const error: any = new Error(errMsg);
    error.status = res.status;
    error.data = json;
    throw error;
  }

  return json as T;
}
