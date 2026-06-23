import { CELL_SIZE } from '../lib/spreadsheet';
import { getColor } from '../lib/colors';

function isSerialBadgeActive(group, badge) {
  if (group.isMorder) return true;
  if (badge.key === 'flgsyoyo') return Number(group.flgSyoyo) === 1;
  if (badge.key === 'flggoso') return Number(group.flgGoso) === 1;
  return true;
}

function badgeStyle(group, badge) {
  const active = isSerialBadgeActive(group, badge);
  return {
    fontSize: 10,
    lineHeight: 1.4,
    padding: '0 4px',
    borderRadius: 3,
    color: active ? '#fff' : '#c4c9d1',
    background: active ? badge.color : 'transparent',
    whiteSpace: 'nowrap',
  };
}

export default function SpreadsheetGridLeftHeader({
  layoutGroups,
  scrollTop,
  containerH,
  leftHdrW,
  mode,
  colWidths = {},
  rowBadges = [],
  onGroupClick,
  showShippingDate = false,
  showResponsible  = false,
}) {
  const lcw = (key) => colWidths[key] ?? 80;
  const items = [];
  for (const g of layoutGroups) {
    const gTop = g.startRow * CELL_SIZE;
    if (gTop + g.numRows * CELL_SIZE <= scrollTop || gTop >= scrollTop + containerH) continue;

    const hasLocRow = g.locationRowIdx >= 0;
    const mainH = hasLocRow ? g.locationRowIdx * CELL_SIZE : g.numRows * CELL_SIZE;
    const mainY = gTop - scrollTop;

    items.push(
      <div key={g.id} style={{
        position: 'absolute', left: 0, top: mainY, width: leftHdrW, height: mainH,
        borderBottom: hasLocRow ? '1px solid #93c5fd' : '1px solid #9ca3af',
        borderRight: '1px solid #d1d5db',
        background: g.isUnassigned ? '#fef9c3' : '#f9fafb',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden',
        cursor: 'pointer',
      }}
      data-row-header="1"
      onClick={(e) => onGroupClick?.(g, e)}>
        {mode === 'device' ? (g.isMorder ? (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <div style={{ width: lcw('main'), borderRight: '1px solid #d1d5db', display: 'grid', gridTemplateRows: 'repeat(3, 1fr)', boxSizing: 'border-box' }}>
                {[g.partsNo || '-', g.morderNo || '-', g.publicRemark || '-'].map((value, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: i < 2 ? '1px solid #e5e7eb' : 'none', fontSize: 13, fontWeight: i === 1 ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', color: '#374151' }}>
                    {value}
                  </div>
                ))}
              </div>
              <div style={{ width: lcw('sub'), display: 'grid', gridTemplateRows: 'repeat(3, 1fr)', boxSizing: 'border-box' }}>
                {['', g.shippingDate || '-', ''].map((value, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: i < 2 ? '1px solid #e5e7eb' : 'none', fontSize: 13, fontWeight: i === 1 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', color: i === 1 ? '#374151' : '#9ca3af' }}>
                    {value}
                  </div>
                ))}
              </div>
            </div>
            {rowBadges.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: CELL_SIZE, padding: '0 4px', borderTop: '1px solid #e5e7eb', boxSizing: 'border-box', overflow: 'hidden' }}>
                {rowBadges.map(b => (
                  <span key={b.label} style={badgeStyle(g, b)}>{b.label}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <div style={{ width: lcw('device'), borderRight: '1px solid #d1d5db', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 4px', overflow: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.kisyuName}</div>
                <div style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.serialNo}</div>
              </div>
              <div style={{ width: lcw('receipt'), borderRight: (showShippingDate || showResponsible) ? '1px solid #d1d5db' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#374151', padding: '0 4px', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {g.receiptNo ?? '-'}
              </div>
              {showShippingDate && (
                <div style={{ width: lcw('shipping'), borderRight: showResponsible ? '1px solid #d1d5db' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#374151', padding: '0 4px', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.shippingDate ?? '-'}
                </div>
              )}
              {showResponsible && (
                <div style={{ width: lcw('responsible'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#374151', padding: '0 4px', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.responsible ?? '-'}
                </div>
              )}
            </div>
            {rowBadges.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: CELL_SIZE, padding: '0 4px', borderTop: '1px solid #e5e7eb', boxSizing: 'border-box', overflow: 'hidden' }}>
                {rowBadges.map(b => (
                  <span key={b.label} style={badgeStyle(g, b)}>{b.label}</span>
                ))}
              </div>
            )}
          </div>
        )) : mode === 'task' ? (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ width: lcw('process'), borderRight: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', color: '#374151' }}>
              {g.processName}
            </div>
            <div style={{ width: lcw('task'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', color: '#111827' }}>
              {g.taskName}
            </div>
          </div>
        ) : mode === 'worker' ? (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ width: lcw('team'), borderRight: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box' }}>
              {g.isUnassigned ? g.kisyuName : (g.teamName || '-')}
            </div>
            <div style={{ width: lcw('name'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box' }}>
              {g.isUnassigned ? g.serialNo : g.workerName}
            </div>
          </div>
        ) : mode === 'place' ? (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ width: lcw('floor'), borderRight: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', color: '#374151' }}>
              {g.locationTypeName || '-'}
            </div>
            <div style={{ width: lcw('place'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', background: getColor(g.backColor), color: getColor(g.fontColor) }}>
              {g.resourceName}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{g.serialNo || g.workerName || g.resourceName || ''}</div>
        )}
      </div>
    );

    if (hasLocRow) {
      const locY = (gTop + g.locationRowIdx * CELL_SIZE) - scrollTop;
      const locH = (g.locationNumRows || 1) * CELL_SIZE;
      items.push(
        <div key={`${g.id}-loc`} style={{
          position: 'absolute', left: 0, top: locY, width: leftHdrW, height: locH,
          borderBottom: '1px solid #9ca3af', borderRight: '1px solid #d1d5db',
          background: '#dbeafe', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: '#1d4ed8', fontWeight: 700, letterSpacing: '0.05em',
        }}>
          場所
        </div>
      );
    }
  }
  return items;
}
