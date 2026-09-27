import { apiJson } from './api';

const STORAGE_KEY = 'sz_schedule_dpr_master_options_v2';
const loadingPromises = new Map();

function normalizeFilters(filters = {}) {
  const sorted = values => [...new Set((values || []).map(String))].sort();
  return {
    formtype: sorted(filters.formtype).map(Number),
    deliverytype: sorted(filters.deliverytype).map(Number),
    classification: sorted(filters.classification),
    status: sorted(filters.status),
  };
}

function cacheKey(filters) {
  return JSON.stringify(normalizeFilters(filters));
}

function normalizeOptions(value) {
  if (!value || !Array.isArray(value.machines) || !Array.isArray(value.locations) || !Array.isArray(value.years)) {
    return null;
  }

  return {
    machines: value.machines.map(String),
    locations: value.locations.map(String),
    years: value.years.map(String),
  };
}

function readCache(key) {
  try {
    const raw = window.sessionStorage?.getItem(STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) : {};
    return normalizeOptions(entries?.[key]);
  } catch {
    return null;
  }
}

function writeCache(key, options) {
  try {
    const raw = window.sessionStorage?.getItem(STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) : {};
    entries[key] = options;
    window.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // sessionStorageを利用できない環境ではAPI取得結果だけを使用する。
  }
}

export async function loadDprMasterOptions(filters = {}) {
  const normalizedFilters = normalizeFilters(filters);
  const key = cacheKey(normalizedFilters);
  const cached = readCache(key);
  if (cached) return cached;

  if (!loadingPromises.has(key)) {
    loadingPromises.set(key, (async () => {
      const options = normalizeOptions(await apiJson('/dpr/options', {
        method: 'POST',
        body: JSON.stringify(normalizedFilters),
      }));
      if (!options) throw new Error('Invalid DPR master options');
      writeCache(key, options);
      return options;
    })());
  }

  try {
    return await loadingPromises.get(key);
  } finally {
    loadingPromises.delete(key);
  }
}

export function clearDprMasterOptionsCache() {
  try {
    window.sessionStorage?.removeItem(STORAGE_KEY);
    window.sessionStorage?.removeItem('sz_schedule_dpr_master_options');
  } catch {
    // noop
  }
}
