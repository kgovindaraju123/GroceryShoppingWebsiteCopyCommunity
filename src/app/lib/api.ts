import { projectId } from '../../../utils/supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-6cfb8b21`;

const TOKEN_KEY = 'tgm_access_token';
const REFRESH_KEY = 'tgm_refresh_token';

export function storeTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function apiSignup(name: string, email: string, password: string) {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: name, email, password }),
  });
  return res.json();
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function apiGetMe(token: string) {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders(token) });
  if (!res.ok) return null;
  return res.json();
}

export async function apiRefresh(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) { clearTokens(); return null; }
  const data = await res.json();
  storeTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export async function fetchCart(token: string): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}/cart`, { headers: authHeaders(token) });
    if (!res.ok) return [];
    return (await res.json()).items ?? [];
  } catch { return []; }
}

export async function saveCart(token: string, items: any[]): Promise<void> {
  try {
    await fetch(`${BASE}/cart`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ items }),
    });
  } catch { /* best-effort */ }
}

// ── Wishlist ─────────────────────────────────────────────────────────────────

export async function fetchWishlist(token: string): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}/wishlist`, { headers: authHeaders(token) });
    if (!res.ok) return [];
    return (await res.json()).items ?? [];
  } catch { return []; }
}

export async function saveWishlist(token: string, items: any[]): Promise<void> {
  try {
    await fetch(`${BASE}/wishlist`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ items }),
    });
  } catch { /* best-effort */ }
}
