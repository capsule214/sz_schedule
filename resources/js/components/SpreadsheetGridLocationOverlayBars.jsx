import { CELL_SIZE, HANDLE_W } from '../lib/spreadsheet';

export default function SpreadsheetGridLocationOverlayBars({
  extraLocationRow,
  layoutGroups,
  startDate,
  viewMode,
  planToStartCol,
  planToEndCol,
  visRowStart,
  visRowEnd,
  colW,
  totalCols,
  scrollLeft,
  containerW,
  selected = new Set(),
  editedPlanIds = new Set(),
  dragRef,
  ghostDrag,
  onBarPointerDown,
  onBarRightClick,
}) {
  if (!extraLocationRow) return [];
  const bars = [];

  for (const g of layoutGroups) {
    if (g.locationRowIdx < 0 || !g.locationPlans?.length) continue;
    for (const plan of g.locationPlans) {
      const startCol = planToStartCol(plan, startDate, viewMode);
      const endCol = planToEndCol(plan, startDate, viewMode);
      let drawStartCol = startCol;
      let drawEndCol = endCol;
      const isDragging = dragRef?.current?.dragPlans?.some(p => p.planId === plan.planId);
      const ghost = ghostDrag && isDragging;
      if (ghost) {
        if (ghostDrag.type === 'move') {
          drawStartCol += ghostDrag.deltaCol;
          drawEndCol += ghostDrag.deltaCol;
        } else if (ghostDrag.type === 'resize-left') {
          drawStartCol = Math.min(endCol, startCol + ghostDrag.deltaCol);
        } else {
          drawEndCol = Math.max(startCol, endCol + ghostDrag.deltaCol);
        }
        drawStartCol = Math.max(0, Math.min(drawStartCol, totalCols - 1));
        drawEndCol = Math.max(drawStartCol, Math.min(drawEndCol, totalCols - 1));
      }
      const absRow = g.startRow + g.locationRowIdx + plan.rowIdx;

      if (absRow < visRowStart || absRow > visRowEnd) continue;

      const x = drawStartCol * colW;
      if (x >= totalCols * colW) continue;
      const w = Math.min(Math.max(colW, (drawEndCol - drawStartCol + 1) * colW), totalCols * colW - x);
      const y = (absRow + (ghost && ghostDrag.type === 'move' ? ghostDrag.deltaRow : 0)) * CELL_SIZE;

      if (x + w < scrollLeft || x > scrollLeft + containerW) continue;

      const pad = 3;
      const locLabelLeft = Math.max(x + pad, 0);
      const locLabelWidth = Math.max(0, Math.min(x + w - pad - locLabelLeft, totalCols * colW - locLabelLeft));

      bars.push(
        <div
          key={`loc-ov-${plan.planId}`}
          title={plan.resourceName}
          style={{
            position: 'absolute', left: x, top: y, width: w, height: CELL_SIZE,
            background: '#93c5fd', border: '1px solid #3b82f6',
            outline: editedPlanIds.has(plan.planId) ? '2px dashed #2563eb' : 'none',
            outlineOffset: editedPlanIds.has(plan.planId) ? '-2px' : 0,
            boxShadow: selected.has(plan.planId) ? '0 0 0 2px #ef4444' : 'none',
            opacity: ghost ? 0.5 : 1,
            boxSizing: 'border-box', zIndex: ghost ? 10 : selected.has(plan.planId) ? 4 : 2,
            cursor: 'grab', userSelect: 'none', overflow: 'hidden',
          }}
          onPointerDown={e => { if (e.button === 0) onBarPointerDown?.(e, plan, 'move'); }}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => onBarRightClick?.(e, plan)}
        >
          <div
            style={{ position: 'absolute', left: 0, top: 0, width: HANDLE_W, height: '100%', cursor: 'ew-resize', zIndex: 3 }}
            onPointerDown={e => { e.stopPropagation(); onBarPointerDown?.(e, plan, 'resize-left'); }}
          />
          <div
            style={{ position: 'absolute', right: 0, top: 0, width: HANDLE_W, height: '100%', cursor: 'ew-resize', zIndex: 3 }}
            onPointerDown={e => { e.stopPropagation(); onBarPointerDown?.(e, plan, 'resize-right'); }}
          />
        </div>
      );
      bars.push(
        <div
          key={`loc-ov-lbl-${plan.planId}`}
          style={{
            position: 'absolute', left: locLabelLeft, top: y,
            width: locLabelWidth, height: CELL_SIZE,
            display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
            fontSize: 13, color: '#1e3a5f', pointerEvents: 'none', zIndex: 5, userSelect: 'none',
          }}
        >
          {plan.resourceName}
        </div>
      );
    }
  }
  return bars;
}
