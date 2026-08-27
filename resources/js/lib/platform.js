export function isIPadOS() {
  if (typeof navigator === 'undefined') return false;

  // iPadOS 13以降はデスクトップ向けサイトでMacとして通知される場合がある。
  return /iPad/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
