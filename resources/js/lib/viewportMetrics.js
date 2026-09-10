function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/** iPad SafariのツールバーやSplit Viewを含め、現在実際に見えている領域を返す。 */
export function getViewportMetrics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      displayWidth: 0,
      displayHeight: 0,
      viewportWidth: 0,
      viewportHeight: 0,
      pageWidth: 0,
      pageHeight: 0,
    };
  }

  const visualViewport = window.visualViewport;
  const viewportWidth = positiveNumber(visualViewport?.width, positiveNumber(window.innerWidth, 1));
  const viewportHeight = positiveNumber(visualViewport?.height, positiveNumber(window.innerHeight, 1));
  const root = document.documentElement;
  const body = document.body;

  return {
    displayWidth: Math.round(positiveNumber(window.screen?.width, viewportWidth)),
    displayHeight: Math.round(positiveNumber(window.screen?.height, viewportHeight)),
    // 小数ピクセルを切り上げると1pxだけ表示領域外へ出るため、内側へ丸める。
    viewportWidth: Math.floor(viewportWidth),
    viewportHeight: Math.floor(viewportHeight),
    pageWidth: Math.round(Math.max(viewportWidth, root?.scrollWidth ?? 0, body?.scrollWidth ?? 0)),
    pageHeight: Math.round(Math.max(viewportHeight, root?.scrollHeight ?? 0, body?.scrollHeight ?? 0)),
  };
}

/** 計測値をレイアウト用CSS変数とデバッグ可能なdata属性へ反映する。 */
export function applyViewportMetrics() {
  const metrics = getViewportMetrics();
  if (typeof document === 'undefined') return metrics;

  const root = document.documentElement;
  root.style.setProperty('--device-display-width', `${metrics.displayWidth}px`);
  root.style.setProperty('--device-display-height', `${metrics.displayHeight}px`);
  root.style.setProperty('--web-viewport-width', `${metrics.viewportWidth}px`);
  root.style.setProperty('--web-viewport-height', `${metrics.viewportHeight}px`);
  root.style.setProperty('--web-page-width', `${metrics.pageWidth}px`);
  root.style.setProperty('--web-page-height', `${metrics.pageHeight}px`);
  root.dataset.deviceDisplayWidth = String(metrics.displayWidth);
  root.dataset.deviceDisplayHeight = String(metrics.displayHeight);
  root.dataset.webViewportWidth = String(metrics.viewportWidth);
  root.dataset.webViewportHeight = String(metrics.viewportHeight);
  root.dataset.webPageWidth = String(metrics.pageWidth);
  root.dataset.webPageHeight = String(metrics.pageHeight);
  return metrics;
}

export function observeViewportMetrics() {
  if (typeof window === 'undefined') return () => {};
  let frameId = null;
  const update = () => {
    if (frameId != null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(() => {
      frameId = null;
      applyViewportMetrics();
    });
  };
  const viewport = window.visualViewport;
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  window.screen?.orientation?.addEventListener?.('change', update);
  resizeObserver?.observe(document.documentElement);
  if (document.body) resizeObserver?.observe(document.body);
  applyViewportMetrics();

  return () => {
    if (frameId != null) cancelAnimationFrame(frameId);
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
    window.screen?.orientation?.removeEventListener?.('change', update);
    resizeObserver?.disconnect();
  };
}
