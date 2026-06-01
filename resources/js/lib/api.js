/**
 * Laravel セッション認証用の fetch ラッパー
 * - GET /csrf-cookie で XSRF-TOKEN Cookie を取得
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
  const res = await fetch('/csrf-cookie', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`CSRF initialization failed: ${res.status}`);
  csrfInitialized = true;
}

function buildHeaders(options = {}) {
  const xsrf = getCookie('XSRF-TOKEN');
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
    ...(options.headers ?? {}),
  };
}

async function sendApiRequest(path, options = {}) {
  return fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(options),
  });
}

export async function apiFetch(path, options = {}) {
  await initCsrf();

  let res = await sendApiRequest(path, options);
  if (res.status === 419) {
    csrfInitialized = false;
    await initCsrf();
    res = await sendApiRequest(path, options);
  }

  if (res.status === 401 || res.status === 419) {
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

export async function apiArray(path, options = {}) {
  const data = await apiJson(path, options);
  if (!Array.isArray(data)) {
    throw new Error(`API response must be an array: ${path}`);
  }
  return data;
}
