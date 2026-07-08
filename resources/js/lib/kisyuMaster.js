import { apiArray } from './api';

const KISYU_MASTER_STORAGE_KEY = 'sz_schedule_kisyu_master';

function readCachedKisyus() {
  try {
    const raw = window.sessionStorage?.getItem(KISYU_MASTER_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function writeCachedKisyus(kisyus) {
  try {
    window.sessionStorage?.setItem(KISYU_MASTER_STORAGE_KEY, JSON.stringify(kisyus));
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
