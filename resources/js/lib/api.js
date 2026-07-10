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
let unauthorizedDispatched = false;
let lastErrorDispatchedAt = 0;

function isLoginRedirectResponse(res) {
  const contentType = res.headers.get('Content-Type') || '';
  return res.redirected || (res.ok && contentType.includes('text/html') && res.url.includes('/login'));
}

function dispatchUnauthorized() {
  if (unauthorizedDispatched) return;
  unauthorizedDispatched = true;
  csrfInitialized = false;
  window.dispatchEvent(new CustomEvent('api:unauthorized'));
}

function shouldDispatchUnauthorized(path) {
  return path !== '/me' && path !== '/login';
}

function dispatchApiError(message = '処理ができませんでした') {
  const now = Date.now();
  if (now - lastErrorDispatchedAt < 500) return;
  lastErrorDispatchedAt = now;
  window.dispatchEvent(new CustomEvent('api:error', { detail: { message } }));
}

function createApiError(message, status = null, data = null) {
  const error = new Error(message);
  error.status = status;
  error.data = data;
  return error;
}

export function resetUnauthorizedState() {
  unauthorizedDispatched = false;
}

export async function initCsrf() {
  if (csrfInitialized) return;
  try {
    const res = await fetch('/csrf-cookie', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      const error = createApiError(`CSRF initialization failed: ${res.status}`, res.status);
      if (res.status === 401 || res.status === 419 || isLoginRedirectResponse(res)) {
        dispatchUnauthorized();
      } else {
        dispatchApiError();
      }
      throw error;
    }
    csrfInitialized = true;
  } catch (e) {
    if (e?.status !== 401 && e?.status !== 419) dispatchApiError();
    throw e;
  }
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

  let res;
  try {
    res = await sendApiRequest(path, options);
  } catch (e) {
    dispatchApiError();
    throw e;
  }
  if (res.status === 419) {
    csrfInitialized = false;
    await initCsrf();
    try {
      res = await sendApiRequest(path, options);
    } catch (e) {
      dispatchApiError();
      throw e;
    }
  }

  if (shouldDispatchUnauthorized(path) && (res.status === 401 || res.status === 419 || isLoginRedirectResponse(res))) {
    dispatchUnauthorized();
  }
  return res;
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  if (res.status === 401 || res.status === 419 || isLoginRedirectResponse(res)) {
    throw createApiError('ログインが必要です', res.status === 419 ? 419 : 401);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = createApiError(data?.message ?? `API request failed: ${res.status}`, res.status, data);
    dispatchApiError();
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
