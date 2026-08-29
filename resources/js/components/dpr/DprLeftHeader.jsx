import { CELL_SIZE, TOTAL_HDR_H } from '../../lib/spreadsheet';

export const DPR_LEFT_COLUMN_KEYS = ['main', 'sub1', 'sub2', 'staff'];

const HEADER_ROWS = [
  ['機種', '出荷形態', '数量', 'リーダー'],
  ['DPRNo', '種別', 'ステータス', 'メカ担当'],
  ['顧客名', '', '', 'エレキ担当'],
  ['件名', '', '', 'ソフト担当'],
];

const DELIVERY_TYPE_NAMES = { 1: '客先直送', 2: '機械組込' };

export function dprStatusColor(status) {
  const normalized = String(status || '').trim();
  if (normalized === '設計中') return '#fce7f3';
  if (normalized === 'オークション' || normalized === 'オークション中') return '#fef9c3';
  if (normalized === 'DPR-A完了' || normalized === 'A完了') return '#e0f2fe';
  if (normalized === '枝番発行済') return '#f5e6d3';
  if (normalized === '設計完了') return '#dcfce7';
  if (normalized === '中止') return '#e5e7eb';
  return '#fff';
}

export function deliveryTypeLabel(value) {
  return String(value || '').split(' / ').map(item => DELIVERY_TYPE_NAMES[item] || item).join(' / ');
}

function GridRows({ rows, colWidths, background = '#f3f4f6', showHorizontalLines = true }) {
  return rows.flatMap((row, rowIndex) => {
    let left = 0;
    let colIndex = 0;
    return row.map((entry) => {
      const mergedCell = entry !== null && typeof entry === 'object';
      const value = mergedCell ? entry.value : entry;
      const span = Math.max(1, Number(mergedCell ? entry.span : 1));
      const startColIndex = colIndex;
      const width = DPR_LEFT_COLUMN_KEYS
        .slice(startColIndex, startColIndex + span)
        .reduce((sum, key) => sum + colWidths[key], 0);
      const cell = (
        <div
          key={`${rowIndex}-${startColIndex}`}
          title={value || ''}
          style={{
            position: 'absolute', left, top: rowIndex * CELL_SIZE,
            width, height: CELL_SIZE, padding: '0 4px',
            borderRight: '1px solid #d1d5db', borderBottom: showHorizontalLines ? '1px solid #d1d5db' : 'none',
            boxSizing: 'border-box', display: 'flex', alignItems: 'center',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            fontSize: 12, color: '#374151', background,
          }}
        >
          {value}
        </div>
      );
      left += width;
      colIndex += span;
      return cell;
    });
  });
}

export function DprLeftHeaderCorner({ colWidths, onStartResize }) {
  const leftWidth = DPR_LEFT_COLUMN_KEYS.reduce((sum, key) => sum + colWidths[key], 0);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: leftWidth, height: TOTAL_HDR_H, overflow: 'hidden', borderRight: '1px solid #9ca3af', boxSizing: 'border-box', zIndex: 4 }}>
      <GridRows rows={HEADER_ROWS} colWidths={colWidths} />
      {DPR_LEFT_COLUMN_KEYS.map((key, index) => {
        const right = DPR_LEFT_COLUMN_KEYS.slice(0, index + 1).reduce((sum, columnKey) => sum + colWidths[columnKey], 0);
        return (
          <div
            key={key}
            title="ドラッグで列幅を変更"
            onPointerDown={event => onStartResize(key, event)}
            style={{ position: 'absolute', left: right - 3, top: 0, width: 6, height: '100%', cursor: 'col-resize', zIndex: 10, touchAction: 'none' }}
          />
        );
      })}
    </div>
  );
}

export default function DprLeftHeader({ layoutGroups, scrollTop, viewportHeight, colWidths, leftWidth, onGroupClick }) {
  return layoutGroups.flatMap(group => {
    const top = group.startRow * CELL_SIZE - scrollTop;
    const height = group.numRows * CELL_SIZE;
    if (top + height < 0 || top > viewportHeight) return [];
    const rows = [
      [group.machine, deliveryTypeLabel(group.deliveryType), group.qty, group.leaderUserNo],
      [group.dprNo, group.classification, group.status, group.mechanismUserNo],
      [{ value: group.customerName, span: 3 }, group.electricityUserNo],
      [{ value: group.subject, span: 3 }, group.softUserNo],
    ];
    return (
      <div
        key={group.dprNo}
        data-row-header="1"
        onClick={event => onGroupClick?.(group, event)}
        style={{ position: 'absolute', left: 0, top, width: leftWidth, height, background: dprStatusColor(group.status), borderBottom: '1px solid #9ca3af', boxSizing: 'border-box', cursor: 'pointer' }}
      >
        <GridRows rows={rows} colWidths={colWidths} background="transparent" showHorizontalLines={false} />
      </div>
    );
  });
}
