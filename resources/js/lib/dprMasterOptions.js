import { apiJson } from './api';

const STORAGE_KEY = 'sz_schedule_dpr_master_options';
let loadingPromise = null;

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

function readCache() {
  try {
    const raw = window.sessionStorage?.getItem(STORAGE_KEY);
    return raw ? normalizeOptions(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(options) {
  try {
    window.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // sessionStorageを利用できない環境ではAPI取得結果だけを使用する。
  }
}

export async function loadDprMasterOptions() {
  const cached = readCache();
  if (cached) return cached;

  if (!loadingPromise) {
    loadingPromise = (async () => {
      const options = normalizeOptions(await apiJson('/dpr/options'));
      if (!options) throw new Error('Invalid DPR master options');
      writeCache(options);
      return options;
    })();
  }

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

export function clearDprMasterOptionsCache() {
  try {
    window.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
