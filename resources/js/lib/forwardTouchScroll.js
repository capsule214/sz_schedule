/**
 * スクロール領域の外に固定表示したヘッダー上の縦スワイプを、
 * 実際のスクロール要素へ転送する。移動後に発生する click も抑止する。
 */
export function attachForwardedVerticalTouchScroll(source, getScrollTarget) {
  if (!source) return () => {};

  let gesture = null;
  let suppressClick = false;

  const onTouchStart = (event) => {
    if (event.touches.length !== 1) {
      gesture = null;
      return;
    }
    const target = getScrollTarget();
    if (!target) return;
    gesture = {
      startY: event.touches[0].clientY,
      startScrollTop: target.scrollTop,
      moved: false,
    };
  };

  const onTouchMove = (event) => {
    if (!gesture || event.touches.length !== 1) return;
    const target = getScrollTarget();
    if (!target) return;
    const deltaY = gesture.startY - event.touches[0].clientY;
    if (Math.abs(deltaY) > 3) gesture.moved = true;
    if (!gesture.moved) return;
    event.preventDefault();
    target.scrollTop = gesture.startScrollTop + deltaY;
  };

  const onTouchEnd = () => {
    suppressClick = !!gesture?.moved;
    gesture = null;
    // Safariでtouchend後のclickが遅れて発火する場合にも、行詳細を誤表示しない。
    if (suppressClick) setTimeout(() => { suppressClick = false; }, 500);
  };

  const onClickCapture = (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  };

  source.addEventListener('touchstart', onTouchStart, { passive: true });
  source.addEventListener('touchmove', onTouchMove, { passive: false });
  source.addEventListener('touchend', onTouchEnd, { passive: true });
  source.addEventListener('touchcancel', onTouchEnd, { passive: true });
  source.addEventListener('click', onClickCapture, true);

  return () => {
    source.removeEventListener('touchstart', onTouchStart);
    source.removeEventListener('touchmove', onTouchMove);
    source.removeEventListener('touchend', onTouchEnd);
    source.removeEventListener('touchcancel', onTouchEnd);
    source.removeEventListener('click', onClickCapture, true);
  };
}
