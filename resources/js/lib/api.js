/**
 * Laravel セッション認証用の fetch ラッパー
 * - GET /sanctum/csrf-cookie で XSRF-TOKEN Cookie を取得
 * - 以降の POST/PUT/DELETE に X-XSRF-TOKEN ヘッダーを付与
 */

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

let csrfInitialized = false;

export async function initCsrf() {
  if (csrfInitialized) return;
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  csrfInitialized = true;
}

export async function apiFetch(path, options = {}) {
  const xsrf = getCookie('XSRF-TOKEN');
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
    ...(options.headers ?? {}),
  };
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('api:unauthorized'));
  }
  return res;
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.message ?? `API request failed: ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}
