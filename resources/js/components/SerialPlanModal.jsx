import { useState, useEffect, useRef } from 'react';
import { apiArray } from '../lib/api';
import { getColor } from '../lib/colors';
import {
  CELL_SIZE, HANDLE_W,
  addDays, daysBetween, planToStartCol, planToEndCol,
} from '../lib/spreadsheet';

const HDR_H    = 18;  // 月ヘッダーの高さ
const PAD_DAYS = 3;   // 両端の余白日数

export default function SerialPlanModal({ plan, onClose }) {
  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [colW,    setColW]    = useState(8);
  const panelRef     = useRef(null);
  const timelineRef  = useRef(null);

  /* ── 製番IDで予定を直接取得 ── */
  useEffect(() => {
    let cancelled = false;
    apiArray(`/plan/by-serial/${plan.serialId}`)
      .then(data => { if (!cancelled) setPlans(data || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [plan.serialId]);

  /* ── 日付レンジ ── */
  const sorted = [...plans].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const rangeStart = sorted.length ? addDays(sorted[0].startDate, -PAD_DAYS) : null;
  const rangeEnd   = sorted.length ? addDays(sorted[sorted.length - 1].endDate, PAD_DAYS) : null;
  const totalDays  = rangeStart && rangeEnd
    ? Math.max(1, daysBetween(rangeStart, addDays(rangeEnd, 1)))
    : 1;

  /* ── タイムライン幅に合わせて colW を決定 ── */
  useEffect(() => {
    if (!loading && timelineRef.current && rangeStart) {
      const availW = timelineRef.current.clientWidth;
      setColW(Math.max(3, Math.min(20, availW / totalDays)));
    }
  }, [loading, totalDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalW = totalDays * colW;

  /* ── バー描画（SpreadsheetGridBars と同ロジック・読み取り専用） ── */
  const bars   = [];
  const labels = [];

  if (!loading && rangeStart && sorted.length > 0) {
    const rowXArr = sorted.map(p => ({
      planId: p.planId,
      startX: planToStartCol(p, rangeStart, 'day') * colW,
    })).sort((a, b) => a.startX - b.startX);

    for (const p of sorted) {
      const startCol = planToStartCol(p, rangeStart, 'day');
      const endCol   = planToEndCol(p, rangeStart, 'day');
      const x = startCol * colW;
      const w = Math.max(colW, (endCol - startCol + 1) * colW);
      const bg = getColor(p.taskBackColor);
      const fg = getColor(p.taskFontColor);
      const isCurrent = p.planId === plan.planId;

      const myIdx    = rowXArr.findIndex(r => r.planId === p.planId);
      const nextX    = myIdx >= 0 && myIdx + 1 < rowXArr.length ? rowXArr[myIdx + 1].startX : null;
      const labelLeft = x + HANDLE_W;
      const labelW   = Math.min(
        nextX !== null ? Math.max(0, nextX - labelLeft) : Infinity,
        Math.max(0, totalW - labelLeft),
      );

      bars.push(
        <div key={p.planId} style={{
          position: 'absolute', left: x, top: 0, width: w, height: CELL_SIZE,
          background: bg,
          border: isCurrent ? '2px solid #1d4ed8' : '1px solid rgba(0,0,0,0.15)',
          boxShadow: isCurrent ? 'inset 0 0 0 2px #1d4ed8, 0 0 0 2px #93c5fd' : 'none',
          boxSizing: 'border-box', zIndex: isCurrent ? 4 : 2,
          overflow: 'hidden', userSelect: 'none',
        }} />
      );

      labels.push(
        <div key={`lbl-${p.planId}`} style={{
          position: 'absolute', left: labelLeft, top: 0,
          width: labelW, height: CELL_SIZE,
          display: 'flex', alignItems: 'center',
          overflow: 'hidden', whiteSpace: 'nowrap',
          fontSize: 13, color: fg,
          pointerEvents: 'none', zIndex: 5, paddingLeft: 2, userSelect: 'none',
        }}>
          {p.taskName}
        </div>
      );
    }
  }

  /* ── 月ヘッダー ── */
  const monthMarkers = [];
  if (!loading && rangeStart) {
    let cur = rangeStart.slice(0, 7) + '-01'; // 月初に揃える
    while (cur <= rangeEnd) {
      const col = Math.max(0, daysBetween(rangeStart, cur));
      const d   = new Date(cur + 'T00:00:00');
      monthMarkers.push(
        <div key={cur} style={{
          position: 'absolute', left: col * colW, top: 0,
          fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap',
          borderLeft: '1px solid #e5e7eb', paddingLeft: 3,
          lineHeight: `${HDR_H}px`,
        }}>
          {d.getFullYear()}/{d.getMonth() + 1}
        </div>
      );
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      cur = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
    }
  }

  /* ── オーバーレイクリックで閉じる ── */
  function handleOverlayClick(e) {
    if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
  }

  return (
    <div onClick={handleOverlayClick} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.35)',
      zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div ref={panelRef} style={{
        background: '#fff', borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        padding: '12px 16px',
        maxWidth: '90vw', minWidth: 300,
      }}>
        {loading ? (
          <div style={{ fontSize: 13, color: '#6b7280' }}>読み込み中...</div>
        ) : sorted.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b7280' }}>予定がありません</div>
        ) : (
          <div ref={timelineRef} style={{ overflowX: 'auto' }}>
            <div style={{ width: totalW, position: 'relative' }}>
              {/* 月ヘッダー */}
              <div style={{ position: 'relative', height: HDR_H, borderBottom: '1px solid #e5e7eb' }}>
                {monthMarkers}
              </div>
              {/* バー行 */}
              <div style={{ position: 'relative', height: CELL_SIZE }}>
                {bars}
                {labels}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
