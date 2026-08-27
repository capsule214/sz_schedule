import { getColor } from '../../lib/colors';
import { CELL_SIZE, planToEndCol, planToStartCol } from '../../lib/spreadsheet';

export default function DprBars({ layoutGroups, startDate, viewMode, colW, totalCols, scrollLeft, viewportWidth, visRowStart, visRowEnd }) {
  const contentRight = totalCols * colW;
  const bars = [];
  for (const group of layoutGroups) {
    for (const plan of group.plans || []) {
      const startCol = planToStartCol(plan, startDate, viewMode);
      const endCol = planToEndCol(plan, startDate, viewMode);
      const row = group.startRow + plan.rowIdx;
      const left = startCol * colW;
      const width = Math.min(Math.max(colW, (endCol - startCol + 1) * colW), contentRight - left);
      if (left + width < scrollLeft || left > scrollLeft + viewportWidth || row < visRowStart || row > visRowEnd) continue;
      const label = `${plan.taskName || ''}${plan.userNo ? ` ${plan.userNo}` : ''}${plan.remark ? `＜${plan.remark}＞` : ''}`;
      bars.push(
        <div
          key={plan.planId}
          title={label}
          style={{
            position: 'absolute', left, top: row * CELL_SIZE, width, height: CELL_SIZE,
            boxSizing: 'border-box', border: '1px solid rgba(0,0,0,0.15)',
            background: getColor(plan.taskBackColor), color: getColor(plan.taskFontColor),
            display: 'flex', alignItems: 'center', padding: '0 4px', overflow: 'hidden',
            whiteSpace: 'nowrap', fontSize: 13, zIndex: 2,
          }}
        >
          {label}
        </div>
      );
    }
  }
  return bars;
}
