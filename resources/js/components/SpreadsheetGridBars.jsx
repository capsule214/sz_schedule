import { getColor } from '../lib/colors';
import { CELL_SIZE, HANDLE_W, TODAY_STR } from '../lib/spreadsheet';

const syoyoCornerBase = {
  position: 'absolute',
  width: 7,
  height: 7,
  borderColor: '#000',
  pointerEvents: 'none',
  zIndex: 7,
  boxSizing: 'border-box',
};

function syoyoCornerStyle(position) {
  const border = '2px solid #000';
  if (position === 'top-left') return { ...syoyoCornerBase, top: 1, left: 1, borderTop: border, borderLeft: border };
  if (position === 'top-right') return { ...syoyoCornerBase, top: 1, right: 1, borderTop: border, borderRight: border };
  if (position === 'bottom-left') return { ...syoyoCornerBase, bottom: 1, left: 1, borderBottom: border, borderLeft: border };
  return { ...syoyoCornerBase, bottom: 1, right: 1, borderBottom: border, borderRight: border };
}

export default function SpreadsheetGridBars({
  layoutGroups,
  startDate,
  viewMode,
  colW,
  totalCols,
  scrollLeft,
  containerW,
  visRowStart,
  visRowEnd,
  selected,
  groupMoveHighlightIds = new Set(),
  dragRef,
  ghostDrag,
  mode,
  planToStartCol,
  planToEndCol,
  onBarPointerDown,
  onBarRightClick,
  flgdiff = false,
  flgsyoyo = false,
}) {
  const bars = [];
  const labels = [];
  const rowStartXMap = new Map();

  for (const g of layoutGroups) {
    if (!g.plans) continue;
    for (const plan of g.plans) {
      const sx = planToStartCol(plan, startDate, viewMode) * colW;
      const absRow = g.startRow + plan.rowIdx;
      if (!rowStartXMap.has(absRow)) rowStartXMap.set(absRow, []);
      rowStartXMap.get(absRow).push({ startX: sx, planId: plan.planId });
    }
  }
  for (const arr of rowStartXMap.values()) arr.sort((a, b) => a.startX - b.startX);

  const contentRight = totalCols * colW;

  for (const g of layoutGroups) {
    if (!g.plans) continue;
    for (const plan of g.plans) {
      const startCol = planToStartCol(plan, startDate, viewMode);
      const endCol = planToEndCol(plan, startDate, viewMode);

      let drawStartCol = startCol;
      let drawEndCol = endCol;

      const isDragging = dragRef.current?.dragPlans?.some(p => p.planId === plan.planId);
      const ghost = ghostDrag && isDragging;
      if (ghost) {
        if (ghostDrag.type === 'move') {
          drawStartCol = startCol + ghostDrag.deltaCol;
          drawEndCol = endCol + ghostDrag.deltaCol;
        } else if (ghostDrag.type === 'resize-left') {
          drawStartCol = Math.min(endCol, startCol + ghostDrag.deltaCol);
        } else if (ghostDrag.type === 'resize-right') {
          drawEndCol = Math.max(startCol, endCol + ghostDrag.deltaCol);
        }

        drawStartCol = Math.max(0, Math.min(drawStartCol, totalCols - 1));
        drawEndCol = Math.max(drawStartCol, Math.min(drawEndCol, totalCols - 1));
      }

      const x = drawStartCol * colW;
      if (x >= contentRight) continue;

      const w = Math.min(Math.max(colW, (drawEndCol - drawStartCol + 1) * colW), contentRight - x);
      const absRow = g.startRow + plan.rowIdx;
      const y = absRow * CELL_SIZE;

      if (x + w < scrollLeft || x > scrollLeft + containerW) continue;
      if (absRow < visRowStart || absRow > visRowEnd) continue;

      const bg = getColor(mode === 'place' ? plan.backColor : plan.taskBackColor);
      const fg = getColor(mode === 'place' ? plan.fontColor : plan.taskFontColor);
      const isSel = selected.has(plan.planId);
      const isGroupMoveHighlighted = groupMoveHighlightIds.has(plan.planId);
      const isLocked = (mode !== 'place' && Number(plan.taskId) === 1) || (mode === 'worker' && plan.workerId == null);
      const barX = x;
      const barY = ghost && ghostDrag.type === 'move' ? y + ghostDrag.deltaRow * CELL_SIZE : y;
      const showStar = flgdiff && plan.updatedAt === TODAY_STR;

      const rowArr = rowStartXMap.get(absRow) || [];
      const myIdx = rowArr.findIndex(r => r.planId === plan.planId);
      const nextBarX = (myIdx >= 0 && myIdx + 1 < rowArr.length) ? rowArr[myIdx + 1].startX : null;
      const labelLeft = Math.max(barX + 1);
      const maxWToNextBar = nextBarX !== null ? Math.max(0, nextBarX - labelLeft) : Infinity;
      const maxWToContent = Math.max(0, contentRight - labelLeft);
      const labelWidth = Math.min(maxWToNextBar, maxWToContent);

      bars.push(
        <div
          key={plan.planId}
          style={{
            position: 'absolute', left: barX, top: barY, width: w, height: CELL_SIZE, background: bg,
            display: 'flex', alignItems: 'center',
            // 選択時は内側ボーダーを消し、外枠の赤いリングのみを表示する（フォーカス枠の2重表示を防止）
            border: isSel ? '1px solid transparent' : '1px solid rgba(0,0,0,0.15)',
            boxShadow: isGroupMoveHighlighted ? '0 0 0 4px #dc2626' : isSel ? '0 0 0 2px #ef4444' : 'none',
            boxSizing: 'border-box', zIndex: isGroupMoveHighlighted ? 6 : isSel ? 4 : ghost ? 10 : 2,
            opacity: ghost ? 0.5 : 1, cursor: isLocked ? 'default' : 'grab', overflow: 'hidden', userSelect: 'none',
          }}
          onPointerDown={e => { if (e.button === 0) onBarPointerDown(e, plan, 'move'); }}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => onBarRightClick(e, plan)}
        >
          <div style={{ width: HANDLE_W, height: '100%', cursor: isLocked ? 'default' : 'ew-resize', flexShrink: 0, zIndex: 3 }} onPointerDown={e => { e.stopPropagation(); if (!isLocked) onBarPointerDown(e, plan, 'resize-left'); }} />
          <div style={{ flex: 1 }} />
          <div style={{ width: HANDLE_W, height: '100%', cursor: isLocked ? 'default' : 'ew-resize', flexShrink: 0, zIndex: 3 }} onPointerDown={e => { e.stopPropagation(); if (!isLocked) onBarPointerDown(e, plan, 'resize-right'); }} />
          {showStar && (
            <div style={{
              position: 'absolute', right: 2, top: 1,
              width: 10, height: 10,
              fontSize: 10, lineHeight: '10px',
              pointerEvents: 'none', zIndex: 6,
              userSelect: 'none',
            }}>⭐</div>
          )}
          {flgsyoyo && plan.isSyoyoTask && (
            <>
              <span style={syoyoCornerStyle('top-left')} />
              <span style={syoyoCornerStyle('top-right')} />
              <span style={syoyoCornerStyle('bottom-left')} />
              <span style={syoyoCornerStyle('bottom-right')} />
            </>
          )}
        </div>
      );

      const label = mode === 'place'
        ? (plan.serialNo ? `${plan.kisyuName} ${plan.serialNo}` : '')
        : (plan.workerName ? `${plan.taskName} ${plan.workerName}` : plan.taskName);

      labels.push(
        <div
          key={`lbl-${plan.planId}`}
          style={{
            position: 'absolute', left: labelLeft, top: barY, width: labelWidth, height: CELL_SIZE,
            display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
            fontSize: 13, color: fg, pointerEvents: 'none', zIndex: 5, paddingLeft: 1, userSelect: 'none',
          }}
        >
          {label}
        </div>
      );
    }
  }

  return [...bars, ...labels];
}
