import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapZoomControls from './MapZoomControls';

export const MAP_WIDTH = 5318;
export const MAP_HEIGHT = 1860;
export const RESOURCE_ORIGIN_X = 3000;
export const RESOURCE_ORIGIN_Y = 0;
const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2.25];
const DEFAULT_ZOOM_INDEX = 4;
const FLOOR_IMAGES = {
  '3F': '/images/map/a-building-3f.svg',
  '4F': '/images/map/a-building-4f.svg',
  '5F': '/images/map/a-building-5f.svg',
};

function floorImage(locationTypeName) {
  const floorKey = Object.keys(FLOOR_IMAGES).find(key => String(locationTypeName).endsWith(key));
  return FLOOR_IMAGES[floorKey] ?? FLOOR_IMAGES['3F'];
}

function resourceStyle(resource) {
  const type = Number(resource.resourceTypeId);
  if (type >= 11 && type <= 20) {
    return { background: 'rgba(239, 68, 68, 0.28)', border: '3px dashed #b91c1c', color: '#7f1d1d' };
  }
  if (type === 1) {
    return { background: 'rgba(34, 197, 94, 0.22)', border: '3px solid #15803d', color: '#14532d' };
  }
  return { background: 'rgba(148, 163, 184, 0.24)', border: '2px solid #64748b', color: '#334155' };
}

export default function MapCanvas({ resources, locationTypeName, highlightSearch = '', searchVersion = 0 }) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const wheelAtRef = useRef(0);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const sceneBounds = useMemo(() => resources.reduce((bounds, resource) => {
    const x1 = RESOURCE_ORIGIN_X + Number(resource.x1 || 0);
    const x2 = RESOURCE_ORIGIN_X + Number(resource.x2 || 0);
    const y1 = RESOURCE_ORIGIN_Y + Number(resource.y1 || 0);
    const y2 = RESOURCE_ORIGIN_Y + Number(resource.y2 || 0);
    return {
      minX: Math.min(bounds.minX, x1, x2),
      minY: Math.min(bounds.minY, y1, y2),
      maxX: Math.max(bounds.maxX, x1, x2),
      maxY: Math.max(bounds.maxY, y1, y2),
    };
  }, { minX: 0, minY: 0, maxX: MAP_WIDTH, maxY: MAP_HEIGHT }), [resources]);

  const clampPan = useCallback((next, scale = ZOOM_LEVELS[zoomIndex]) => {
    const viewport = viewportRef.current;
    if (!viewport) return next;
    const scaledWidth = (sceneBounds.maxX - sceneBounds.minX) * scale;
    const scaledHeight = (sceneBounds.maxY - sceneBounds.minY) * scale;
    const x = scaledWidth <= viewport.clientWidth
      ? (viewport.clientWidth - scaledWidth) / 2 - sceneBounds.minX * scale
      : Math.max(viewport.clientWidth - sceneBounds.maxX * scale, Math.min(-sceneBounds.minX * scale, next.x));
    const y = scaledHeight <= viewport.clientHeight
      ? (viewport.clientHeight - scaledHeight) / 2 - sceneBounds.minY * scale
      : Math.max(viewport.clientHeight - sceneBounds.maxY * scale, Math.min(-sceneBounds.minY * scale, next.y));
    return {
      x,
      y,
    };
  }, [sceneBounds, zoomIndex]);

  useEffect(() => {
    const handleResize = () => setPan(current => clampPan(current));
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPan]);

  useEffect(() => {
    if (!highlightSearch) return;
    const target = resources.find(resource => (resource.reserves || []).length > 0);
    const viewport = viewportRef.current;
    if (!target || !viewport) return;

    const scale = ZOOM_LEVELS[zoomIndex];
    const centerX = RESOURCE_ORIGIN_X + (Number(target.x1) + Number(target.x2)) / 2;
    const centerY = RESOURCE_ORIGIN_Y + (Number(target.y1) + Number(target.y2)) / 2;
    setPan(clampPan({
      x: viewport.clientWidth / 2 - centerX * scale,
      y: viewport.clientHeight / 2 - centerY * scale,
    }, scale));
  }, [searchVersion]); // 検索結果が確定した時だけ該当場所へ移動する。

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan };
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan(clampPan({
      x: drag.pan.x + event.clientX - drag.x,
      y: drag.pan.y + event.clientY - drag.y,
    }));
  }

  function endDrag(event) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function changeZoom(nextIndex, pointer = null) {
    nextIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, nextIndex));
    if (nextIndex === zoomIndex) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = pointer ? pointer.x - rect.left : viewport.clientWidth / 2;
    const pointerY = pointer ? pointer.y - rect.top : viewport.clientHeight / 2;
    const oldScale = ZOOM_LEVELS[zoomIndex];
    const newScale = ZOOM_LEVELS[nextIndex];
    const worldX = (pointerX - pan.x) / oldScale;
    const worldY = (pointerY - pan.y) / oldScale;
    const nextPan = clampPan({
      x: pointerX - worldX * newScale,
      y: pointerY - worldY * newScale,
    }, newScale);

    setZoomIndex(nextIndex);
    setPan(nextPan);
  }

  function handleWheel(event) {
    if (event.target instanceof Element && event.target.closest('[data-map-zoom-controls]')) return;
    event.preventDefault();
    const now = performance.now();
    if (now - wheelAtRef.current < 120) return;
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, zoomIndex + direction));
    if (nextIndex === zoomIndex) return;
    wheelAtRef.current = now;
    changeZoom(nextIndex, { x: event.clientX, y: event.clientY });
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const wheelListener = event => handleWheel(event);
    viewport.addEventListener('wheel', wheelListener, { passive: false });
    return () => viewport.removeEventListener('wheel', wheelListener);
  }, [zoomIndex, pan, clampPan]);

  const scale = ZOOM_LEVELS[zoomIndex];
  const backgroundImage = floorImage(locationTypeName);

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', background: '#cbd5e1', cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: MAP_WIDTH, height: MAP_HEIGHT, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
        <img
          key={backgroundImage}
          src={backgroundImage}
          alt={`${locationTypeName} 建物図面`}
          draggable={false}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          style={{ position: 'absolute', left: 0, top: 0, width: MAP_WIDTH, height: MAP_HEIGHT, maxWidth: 'none', maxHeight: 'none', userSelect: 'none', pointerEvents: 'none' }}
        />
        <div style={{ position: 'absolute', top: 28, left: 40, padding: '10px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.88)', border: '2px solid #475569', color: '#0f172a', fontSize: 28, fontWeight: 700 }}>{locationTypeName}</div>
        {resources.map(resource => {
          const width = Math.max(0, Number(resource.x2) - Number(resource.x1));
          const height = Math.max(0, Number(resource.y2) - Number(resource.y1));
          if (width === 0 || height === 0) return null;
          const reserves = resource.reserves || [];
          const primary = reserves[0];
          const highlighted = highlightSearch !== '' && reserves.length > 0;
          return (
            <div
              key={resource.resourceId}
              title={[resource.resourceName, ...reserves.map(item => `${item.serialNo} ${item.kisyuName}`)].filter(Boolean).join('\n')}
              style={{
                position: 'absolute', left: RESOURCE_ORIGIN_X + Number(resource.x1), top: RESOURCE_ORIGIN_Y + Number(resource.y1), width, height,
                boxSizing: 'border-box', overflow: 'visible', borderRadius: 5,
              }}
            >
              {highlighted && (
                <>
                  <span className="map-sonar-ring" />
                  <span className="map-sonar-ring map-sonar-ring-delayed" />
                </>
              )}
              <div style={{
                position: 'absolute', inset: 0, boxSizing: 'border-box', padding: 8, overflow: 'hidden', borderRadius: 5,
                ...resourceStyle(resource),
                ...(primary ? { background: 'rgba(250, 204, 21, 0.52)', borderColor: '#a16207' } : {}),
              }}>
                <div style={{ fontSize: 18, lineHeight: 1.2, fontWeight: 700 }}>{resource.resourceName}</div>
                {primary && <div style={{ marginTop: 5, fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#111827' }}>{primary.serialNo || '製番未指定'}</div>}
                {primary?.kisyuName && <div style={{ marginTop: 2, fontSize: 15, color: '#374151' }}>{primary.kisyuName}</div>}
                {reserves.length > 1 && <div style={{ position: 'absolute', right: 6, bottom: 5, fontSize: 14, fontWeight: 700 }}>他{reserves.length - 1}件</div>}
              </div>
            </div>
          );
        })}
      </div>
      <MapZoomControls levels={ZOOM_LEVELS} zoomIndex={zoomIndex} onZoomChange={changeZoom} />
    </div>
  );
}
