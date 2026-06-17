// 左ヘッダ各列の幅（最低幅・最大幅）と cookie 永続化を扱うユーティリティ。
// 各列は最低 80px・最大 160px。cookie に値が無ければ最低幅で描画する。

export const MIN_LEFT_COL_W = 80;
export const MAX_LEFT_COL_W = 160;

export function clampLeftColW(w) {
  if (!Number.isFinite(w)) return MIN_LEFT_COL_W;
  return Math.max(MIN_LEFT_COL_W, Math.min(MAX_LEFT_COL_W, Math.round(w)));
}

// mode ごとに存在しうる全列キー（cookie 読み込み対象）
const COLUMN_KEYS = {
  device: ['device', 'receipt', 'shipping', 'responsible', 'main', 'sub'],
  worker: ['team', 'name'],
  task: ['process', 'task'],
  place: ['floor', 'place'],
};

function cookieName(mode, key) {
  return `lhcw_${mode}_${key}`;
}

function readCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// mode の全列幅を cookie から読み込む。値が無ければ最低幅。
export function loadLeftColWidths(mode) {
  const keys = COLUMN_KEYS[mode] || COLUMN_KEYS.device;
  const widths = {};
  for (const key of keys) {
    const raw = readCookie(cookieName(mode, key));
    const n = raw != null ? Number(raw) : NaN;
    widths[key] = Number.isFinite(n) ? clampLeftColW(n) : MIN_LEFT_COL_W;
  }
  return widths;
}

export function saveLeftColWidth(mode, key, width) {
  const expires = new Date(Date.now() + 365 * 86400000).toUTCString();
  document.cookie = `${cookieName(mode, key)}=${clampLeftColW(width)}; expires=${expires}; path=/; SameSite=Lax`;
}

// 表示中の列キーを左から順に返す
export function visibleLeftColumns(mode, opts = {}) {
  const { isMorderDevice, showShippingDate, showResponsible } = opts;
  if (mode === 'device') {
    if (isMorderDevice) return ['main', 'sub'];
    // 装置・受付No は常時表示、出荷日・責任者は表示設定で切替
    const cols = ['device', 'receipt'];
    if (showShippingDate) cols.push('shipping');
    if (showResponsible) cols.push('responsible');
    return cols;
  }
  if (mode === 'worker') return ['team', 'name'];
  if (mode === 'task') return ['process', 'task'];
  if (mode === 'place') return ['floor', 'place'];
  return ['device'];
}
