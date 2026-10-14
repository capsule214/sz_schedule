const zoomPercent = level => Number((level * 100).toFixed(2));

export default function MapZoomControls({ levels, zoomIndex, onZoomChange }) {
  const maxIndex = levels.length - 1;

  return (
    <div
      aria-label="マップズーム目盛り"
      data-map-zoom-controls
      onPointerDown={event => event.stopPropagation()}
      onWheel={event => event.stopPropagation()}
      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: 74, borderRadius: 7, overflow: 'hidden', background: 'rgba(255,255,255,0.96)', border: '1px solid #94a3b8', boxShadow: '0 2px 8px rgba(15,23,42,0.3)' }}
    >
      <button
        type="button"
        aria-label="ズームイン"
        disabled={zoomIndex === maxIndex}
        onClick={() => onZoomChange(zoomIndex + 1)}
        style={{ height: 38, border: 'none', borderBottom: '1px solid #cbd5e1', background: '#fff', color: zoomIndex === maxIndex ? '#cbd5e1' : '#0f172a', fontSize: 26, lineHeight: 1, cursor: zoomIndex === maxIndex ? 'default' : 'pointer' }}
      >＋</button>
      {[...levels].reverse().map((level, reversedIndex) => {
        const index = maxIndex - reversedIndex;
        const selected = index === zoomIndex;
        return (
          <button
            type="button"
            key={level}
            aria-label={`ズーム${zoomPercent(level)}%`}
            aria-pressed={selected}
            onClick={() => onZoomChange(index)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, height: 25, padding: '0 6px', border: 'none', borderBottom: '1px solid #e2e8f0', background: selected ? '#dbeafe' : '#fff', color: selected ? '#1d4ed8' : '#475569', cursor: 'pointer', fontSize: 10, fontWeight: selected ? 700 : 400 }}
          >
            <span style={{ width: selected ? 20 : 12, height: selected ? 3 : 1, background: selected ? '#2563eb' : '#64748b' }} />
            <span>{zoomPercent(level)}%</span>
          </button>
        );
      })}
      <button
        type="button"
        aria-label="ズームアウト"
        disabled={zoomIndex === 0}
        onClick={() => onZoomChange(zoomIndex - 1)}
        style={{ height: 38, border: 'none', background: '#fff', color: zoomIndex === 0 ? '#cbd5e1' : '#0f172a', fontSize: 26, lineHeight: 1, cursor: zoomIndex === 0 ? 'default' : 'pointer' }}
      >−</button>
    </div>
  );
}
