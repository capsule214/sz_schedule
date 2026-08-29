import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiArray } from '../../lib/api';
import { deliveryTypeLabel } from './DprLeftHeader';

export default function DprHeaderTooltip({ detail, onClose }) {
  const rootRef = useRef(null);
  const [serials, setSerials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pos, setPos] = useState({ left: 8, top: 8, arrow: 'top' });

  useEffect(() => {
    if (!detail?.group?.dprNo) return undefined;
    let cancelled = false;
    setSerials([]);
    setLoadError(false);
    setLoading(true);
    apiArray('/dpr/related-serials', {
      method: 'POST',
      body: JSON.stringify({ dprNo: detail.group.dprNo }),
    })
      .then(rows => { if (!cancelled) setSerials(rows); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [detail?.group?.dprNo]);

  useLayoutEffect(() => {
    if (!detail || !rootRef.current) return;
    const margin = 8;
    const gap = 6;
    const rect = rootRef.current.getBoundingClientRect();
    const anchor = detail.anchorRect;
    const anchorTop = anchor?.top ?? detail.y ?? margin;
    const anchorBottom = anchor?.bottom ?? detail.y ?? margin;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const left = Math.min(Math.max(margin, anchor?.left ?? detail.x ?? margin), maxLeft);
    const above = anchorTop - rect.height - gap;
    const below = anchorBottom + gap;
    if (above >= margin) setPos({ left, top: above, arrow: 'bottom' });
    else setPos({ left, top: Math.min(Math.max(margin, below), maxTop), arrow: 'top' });
  }, [detail, loading, loadError, serials.length]);

  if (!detail) return null;
  const group = detail.group;
  const rows = [
    ['機種名', group.machine],
    ['DPR No', group.dprNo],
    ['種別', group.classification],
    ['出荷形態', deliveryTypeLabel(group.deliveryType)],
    ['ステータス', group.status],
    ['顧客名', group.customerName],
    ['件名', group.subject],
  ];

  return (
    <div
      ref={rootRef}
      data-header-tooltip="1"
      style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 120, width: 390,
        maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 16px)', overflow: 'auto',
        padding: 10, boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 8,
        background: 'rgba(255,255,255,0.96)', boxShadow: '0 10px 24px rgba(0,0,0,0.15)', fontSize: 13,
      }}
    >
      <div style={{
        position: 'absolute', left: 18, ...(pos.arrow === 'top' ? { top: -8, borderBottom: '8px solid #fff' } : { bottom: -8, borderTop: '8px solid #fff' }),
        width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <strong>DPR詳細</strong>
        <button type="button" aria-label="閉じる" onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 17, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr)', columnGap: 8 }}>
            <span style={{ color: '#6b7280' }}>{label}</span>
            <span style={{ color: '#111827', overflowWrap: 'anywhere' }}>{value || '-'}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, borderTop: '1px solid #d1d5db', paddingTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 5 }}>関連製番</div>
        {loading ? <div style={{ color: '#6b7280' }}>読み込み中...</div> : loadError ? (
          <div style={{ color: '#b91c1c' }}>関連製番を取得できませんでした</div>
        ) : serials.length === 0 ? (
          <div style={{ color: '#6b7280' }}>関連製番はありません</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr><th style={headerStyle}>製番</th><th style={headerStyle}>受付No</th></tr>
            </thead>
            <tbody>
              {serials.map((serial, index) => (
                <tr key={`${serial.serialNo}-${serial.receiptNo}-${index}`}>
                  <td style={cellStyle}>{serial.serialNo || '-'}</td>
                  <td style={cellStyle}>{serial.receiptNo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const headerStyle = { padding: '4px 6px', border: '1px solid #d1d5db', background: '#f3f4f6', textAlign: 'left' };
const cellStyle = { padding: '4px 6px', border: '1px solid #d1d5db', overflowWrap: 'anywhere' };
