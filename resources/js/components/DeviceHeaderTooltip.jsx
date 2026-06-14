import { useLayoutEffect, useRef, useState } from 'react';

export default function DeviceHeaderTooltip({ detail, onClose }) {
  if (!detail) return null;
  const rootRef = useRef(null);
  const [pos, setPos] = useState({ left: 8, top: detail.y + 10, arrow: 'top' });
  const rows = detail.isMorder ? [
    ['手配区分', detail.orderTypeName],
    ['M番', detail.morderNo],
    ['品番', detail.partsNo],
    ['要求納期', detail.requiredDate],
    ['検査日', detail.inspectionDate],
    ['出荷日', detail.shippingDate],
    ['工程担当', detail.kouteiPicNo],
    ['備考', detail.publicRemark],
  ] : [
    ['機種', detail.kisyuName],
    ['製番', detail.serialNo],
    ['表示予定件数', detail.planCount],
    ...(detail.locationPlanCount != null ? [['場所予定件数', detail.locationPlanCount]] : []),
  ];

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const margin = 8;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const maxTop = window.innerHeight - rect.height - margin;
    const nextLeft = margin;
    const anchorTop = detail.anchorRect?.top ?? detail.y;
    const anchorBottom = detail.anchorRect?.bottom ?? detail.y;

    const topCandidate = anchorTop - rect.height - gap;
    const bottomCandidate = anchorBottom + gap;

    let nextTop = bottomCandidate;
    let arrow = 'top';

    if (topCandidate >= margin) {
      nextTop = topCandidate;
      arrow = 'bottom';
    } else if (bottomCandidate <= maxTop) {
      nextTop = bottomCandidate;
      arrow = 'top';
    } else {
      const clampedTop = Math.min(Math.max(margin, bottomCandidate), Math.max(margin, maxTop));
      nextTop = clampedTop;
      arrow = clampedTop <= anchorTop ? 'bottom' : 'top';
    }

    setPos({ left: nextLeft, top: nextTop, arrow });
  }, [detail]);

  return (
    <div
      ref={rootRef}
      data-device-tooltip="1"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 120,
        width: 280,
        background: 'rgba(255,255,255,0.86)',
        backdropFilter: 'blur(2px)',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        boxShadow: '0 10px 24px rgba(0,0,0,0.15)',
        padding: 10,
        fontSize: 13,
      }}
    >
      {pos.arrow === 'top' ? (
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: -8,
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid rgba(255,255,255,0.86)',
            filter: 'drop-shadow(0 -1px 0 #d1d5db)',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 18,
            bottom: -8,
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid rgba(255,255,255,0.86)',
            filter: 'drop-shadow(0 1px 0 #d1d5db)',
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{detail.isMorder ? 'M番詳細' : '装置詳細'}</div>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1 }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'grid', gridTemplateColumns: '76px 1fr', columnGap: 8 }}>
            <span style={{ color: '#6b7280' }}>{label}</span>
            <span style={{ color: '#111827', overflowWrap: 'anywhere' }}>{value || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
