import { getColor } from '../../lib/colors';
import { CELL_SIZE, HANDLE_W, planToEndCol, planToStartCol } from '../../lib/spreadsheet';

const DELIVERY_TYPE_BACKGROUNDS = {
  1: '#f9a8d4', // 客先直送: ピンク
  2: '#bef264', // 機械組込: 黄緑
};

function planBackground(plan, group, colorMode) {
  if (Number(colorMode) !== 2) return getColor(plan.taskBackColor);
  const deliveryTypes = String(group.deliveryType || '')
    .split('/')
    .map(value => Number(value.trim()))
    .filter(Number.isFinite);
  // 同じDPR Noに両方が含まれる場合は、客先直送を優先する。
  if (deliveryTypes.includes(1)) return DELIVERY_TYPE_BACKGROUNDS[1];
  if (deliveryTypes.includes(2)) return DELIVERY_TYPE_BACKGROUNDS[2];
  return getColor(plan.taskBackColor);
}

export default function DprBars({ layoutGroups, startDate, dateWidth, colW, totalCols, scrollLeft, viewportWidth, visRowStart, visRowEnd, onBarPointerDown, onBarRightClick, selected = new Set(), editedPlanIds = new Set(), dragRef, ghostDrag, interactionReadOnly = false, colorMode = 0 }) {
  const contentRight = totalCols * colW;
  const bars = [];
  for (const group of layoutGroups) {
    for (const plan of group.plans || []) {
      const startCol = planToStartCol(plan, startDate, dateWidth);
      const endCol = planToEndCol(plan, startDate, dateWidth);
      let drawStartCol = startCol;
      let drawEndCol = endCol;
      const isDragging = dragRef?.current?.dragPlans?.some(item => Number(item.planId) === Number(plan.planId));
      const ghost = !!ghostDrag && isDragging;
      if (ghost) {
        if (ghostDrag.type === 'move') {
          drawStartCol += ghostDrag.deltaCol;
          drawEndCol += ghostDrag.deltaCol;
        } else if (ghostDrag.type === 'resize-left') {
          drawStartCol = Math.min(drawEndCol, drawStartCol + ghostDrag.deltaCol);
        } else {
          drawEndCol = Math.max(drawStartCol, drawEndCol + ghostDrag.deltaCol);
        }
        drawStartCol = Math.max(0, Math.min(drawStartCol, totalCols - 1));
        drawEndCol = Math.max(drawStartCol, Math.min(drawEndCol, totalCols - 1));
      }
      const row = group.startRow + plan.rowIdx + (ghost && ghostDrag.type === 'move' ? ghostDrag.deltaRow : 0);
      const left = drawStartCol * colW;
      const width = Math.min(Math.max(colW, (drawEndCol - drawStartCol + 1) * colW), contentRight - left);
      if (left + width < scrollLeft || left > scrollLeft + viewportWidth || row < visRowStart || row > visRowEnd) continue;
      const label = `${plan.taskName || ''}${plan.remark ? `＜${plan.remark}＞` : ''}`;
      const isSelected = selected.has(plan.planId);
      const isEdited = editedPlanIds.has(Number(plan.planId));
      bars.push(
        <div
          key={plan.planId}
          data-dpr-plan-bar="1"
          title={label}
          onPointerDown={event => {
            if (!interactionReadOnly && event.button === 0) onBarPointerDown?.(event, plan, 'move');
          }}
          onContextMenu={event => onBarRightClick?.(event, plan, group)}
          onClick={event => {
            event.stopPropagation();
            if (interactionReadOnly) onBarRightClick?.(event, plan, group);
          }}
          style={{
            position: 'absolute', left, top: row * CELL_SIZE, width, height: CELL_SIZE,
            boxSizing: 'border-box', border: isSelected ? '1px solid transparent' : '1px solid rgba(0,0,0,0.15)',
            boxShadow: isSelected ? '0 0 0 2px #ef4444' : 'none',
            outline: isEdited ? '2px dashed #2563eb' : 'none', outlineOffset: '-2px',
            background: planBackground(plan, group, colorMode),
            color: Number(colorMode) === 2 ? '#000' : getColor(plan.taskFontColor),
            display: 'flex', alignItems: 'center', padding: '0 4px', overflow: 'hidden',
            whiteSpace: 'nowrap', fontSize: 13, zIndex: isSelected || isEdited || ghost ? 4 : 2,
            opacity: ghost ? 0.55 : 1, cursor: interactionReadOnly ? 'pointer' : 'grab', userSelect: 'none',
          }}
        >
          <div
            style={{ position: 'absolute', left: 0, top: 0, width: HANDLE_W, height: '100%', cursor: interactionReadOnly ? 'inherit' : 'ew-resize', zIndex: 3 }}
            onPointerDown={event => {
              event.stopPropagation();
              if (!interactionReadOnly && event.button === 0) onBarPointerDown?.(event, plan, 'resize-left');
            }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'clip', pointerEvents: 'none' }}>{label}</span>
          <div
            style={{ position: 'absolute', right: 0, top: 0, width: HANDLE_W, height: '100%', cursor: interactionReadOnly ? 'inherit' : 'ew-resize', zIndex: 3 }}
            onPointerDown={event => {
              event.stopPropagation();
              if (!interactionReadOnly && event.button === 0) onBarPointerDown?.(event, plan, 'resize-right');
            }}
          />
        </div>
      );
    }
  }
  return bars;
}

const SERIAL_PLAN_COLORS = {
  標準: 'rgba(132, 204, 22, 0.58)',
  客先: 'rgba(244, 114, 182, 0.58)',
  検査: 'rgba(250, 204, 21, 0.58)',
  出荷: 'rgba(239, 68, 68, 0.58)',
};

/** 集約済み製番予定。選択・編集・コンテキストメニューの対象外。 */
export function DprSerialPlanBars({ layoutGroups, startDate, dateWidth, colW, totalCols, scrollLeft, viewportWidth, visRowStart, visRowEnd }) {
  const contentRight = totalCols * colW;
  const bars = [];
  for (const group of layoutGroups) {
    for (const plan of group.serialPlans || []) {
      const startCol = planToStartCol(plan, startDate, dateWidth);
      const endCol = planToEndCol(plan, startDate, dateWidth);
      const row = group.startRow + group.serialPlanRowIdx + plan.rowIdx;
      // 表示期間外の予定もレイアウト行には残すが、バーと予定名は描画しない。
      if (endCol < 0 || startCol >= totalCols) continue;
      // 表示開始日より前から続く予定は0列目で切り取り、予定名を画面左端へ表示する。
      const visibleStartCol = Math.max(0, startCol);
      const visibleEndCol = Math.min(totalCols - 1, endCol);
      const left = visibleStartCol * colW;
      const width = Math.min((visibleEndCol - visibleStartCol + 1) * colW, contentRight - left);
      if (left + width < scrollLeft || left > scrollLeft + viewportWidth || row < visRowStart || row > visRowEnd) continue;
      const label = `${plan.serialNo}:${plan.shikakariTypeName}`;
      bars.push(
        <div
          key={`${group.dprNo}:${plan.serialNo}:${plan.shikakariTypeName}`}
          data-dpr-serial-plan-bar="1"
          title={label}
          onClick={event => event.stopPropagation()}
          onContextMenu={event => {
            event.preventDefault();
            event.stopPropagation();
          }}
          style={{
            position: 'absolute', left, top: row * CELL_SIZE, width, height: CELL_SIZE,
            boxSizing: 'border-box', border: '1px solid rgba(0,0,0,0.14)',
            background: SERIAL_PLAN_COLORS[plan.shikakariTypeName] || 'rgba(156, 163, 175, 0.58)',
            color: '#000', display: 'flex', alignItems: 'center', padding: '0 4px',
            overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 16, zIndex: 2,
            cursor: 'default', userSelect: 'none',
          }}
        >
          {label}
        </div>
      );
    }
  }
  return bars;
}
