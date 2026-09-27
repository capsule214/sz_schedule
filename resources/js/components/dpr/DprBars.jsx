import { getColor } from '../../lib/colors';
import { CELL_SIZE, planToEndCol, planToStartCol } from '../../lib/spreadsheet';

export default function DprBars({ layoutGroups, startDate, dateWidth, colW, totalCols, scrollLeft, viewportWidth, visRowStart, visRowEnd, onBarRightClick, interactionReadOnly = false }) {
  const contentRight = totalCols * colW;
  const bars = [];
  for (const group of layoutGroups) {
    for (const plan of group.plans || []) {
      const startCol = planToStartCol(plan, startDate, dateWidth);
      const endCol = planToEndCol(plan, startDate, dateWidth);
      const row = group.startRow + plan.rowIdx;
      const left = startCol * colW;
      const width = Math.min(Math.max(colW, (endCol - startCol + 1) * colW), contentRight - left);
      if (left + width < scrollLeft || left > scrollLeft + viewportWidth || row < visRowStart || row > visRowEnd) continue;
      const label = `${plan.taskName || ''}${plan.remark ? `＜${plan.remark}＞` : ''}`;
      bars.push(
        <div
          key={plan.planId}
          data-dpr-plan-bar="1"
          title={label}
          onContextMenu={event => onBarRightClick?.(event, plan, group)}
          onClick={event => {
            if (!interactionReadOnly) return;
            event.stopPropagation();
            onBarRightClick?.(event, plan, group);
          }}
          style={{
            position: 'absolute', left, top: row * CELL_SIZE, width, height: CELL_SIZE,
            boxSizing: 'border-box', border: '1px solid rgba(0,0,0,0.15)',
            background: getColor(plan.taskBackColor), color: getColor(plan.taskFontColor),
            display: 'flex', alignItems: 'center', padding: '0 4px', overflow: 'hidden',
            whiteSpace: 'nowrap', fontSize: 13, zIndex: 2, cursor: 'pointer',
          }}
        >
          {label}
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
      const left = startCol * colW;
      const width = Math.min(Math.max(colW, (endCol - startCol + 1) * colW), contentRight - left);
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
