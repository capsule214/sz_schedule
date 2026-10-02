import { apiArray } from './api';

const KISYU_MASTER_STORAGE_KEY = 'sz_schedule_kisyu_master';
const KISYU_MASTER_CACHE_VERSION = 2;

function hasColorFields(kisyu) {
  return Object.prototype.hasOwnProperty.call(kisyu, 'backColor')
    && Object.prototype.hasOwnProperty.call(kisyu, 'fontColor');
}

function readCachedKisyus() {
  try {
    const raw = window.sessionStorage?.getItem(KISYU_MASTER_STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const data = Array.isArray(cached)
      ? cached
      : cached?.version === KISYU_MASTER_CACHE_VERSION ? cached.data : null;
    return Array.isArray(data) && data.every(hasColorFields) ? data : null;
  } catch {
    return null;
  }
}

function writeCachedKisyus(kisyus) {
  try {
    window.sessionStorage?.setItem(KISYU_MASTER_STORAGE_KEY, JSON.stringify({
      version: KISYU_MASTER_CACHE_VERSION,
      data: kisyus,
    }));
  } catch {
    // sessionStorage が使えない環境では通常のAPI取得だけで動かす。
  }
}

export async function loadKisyuMaster() {
  const cached = readCachedKisyus();
  if (cached) return cached;

  const kisyus = await apiArray('/serial/kisyu');
  writeCachedKisyus(kisyus);
  return kisyus;
}

export function clearKisyuMasterCache() {
  try {
    window.sessionStorage?.removeItem(KISYU_MASTER_STORAGE_KEY);
  } catch {
    // noop
  }
}
