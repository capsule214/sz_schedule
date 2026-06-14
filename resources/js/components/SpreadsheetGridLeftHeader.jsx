import { CELL_SIZE, DEV_HDR_W, ASGN_HDR_W } from '../lib/spreadsheet';
import { getColor } from '../lib/colors';

export default function SpreadsheetGridLeftHeader({
  layoutGroups,
  scrollTop,
  containerH,
  leftHdrW,
  mode,
  onGroupClick,
  showShippingDate = false,
  showResponsible  = false,
}) {
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
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 4px', overflow: 'hidden',
        cursor: mode === 'device' ? 'pointer' : 'default',
      }}
      data-device-header={mode === 'device' ? '1' : undefined}
      onClick={(e) => {
        if (mode === 'device') onGroupClick?.(g, e);
      }}>
        {mode === 'device' ? (g.isMorder ? (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ width: 80, borderRight: '1px solid #d1d5db', display: 'grid', gridTemplateRows: 'repeat(4, 1fr)', boxSizing: 'border-box' }}>
              {[g.label1 || '-', g.label2 || '-', g.label3 || '-', ''].map((value, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: i < 3 ? '1px solid #e5e7eb' : 'none', fontSize: 13, fontWeight: i === 1 ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', color: i === 3 ? '#9ca3af' : '#374151' }}>
                  {value}
                </div>
              ))}
            </div>
            <div style={{ width: 80, display: 'grid', gridTemplateRows: 'repeat(4, 1fr)', boxSizing: 'border-box' }}>
              {['', g.label4 || '-', '', ''].map((value, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: i < 3 ? '1px solid #e5e7eb' : 'none', fontSize: 13, fontWeight: i === 1 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', color: i === 1 ? '#374151' : '#9ca3af' }}>
                  {value}
                </div>
              ))}
            </div>
          </div>
        ) : (showShippingDate || showResponsible ? (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ width: DEV_HDR_W, borderRight: '1px solid #d1d5db', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 4px', overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label1}</div>
              <div style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label2}</div>
            </div>
            {showShippingDate && (
              <div style={{ width: ASGN_HDR_W, borderRight: showResponsible ? '1px solid #d1d5db' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#374151', padding: '0 4px', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {g.label3 ?? '-'}
              </div>
            )}
            {showResponsible && (
              <div style={{ width: ASGN_HDR_W, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#374151', padding: '0 4px', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {g.label4 ?? '-'}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label1}</div>
            <div style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label2}</div>
          </>
        ))) : mode === 'task' ? (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ width: 80, borderRight: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', color: '#374151' }}>
              {g.label1}
            </div>
            <div style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', color: '#111827' }}>
              {g.label2}
            </div>
          </div>
        ) : mode === 'worker' ? (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ width: 80, borderRight: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box' }}>
              {g.isUnassigned ? g.label1 : (g.teamName || '-')}
            </div>
            <div style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box' }}>
              {g.isUnassigned ? g.label2 : g.label1}
            </div>
          </div>
        ) : mode === 'place' ? (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ width: 80, borderRight: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', color: '#374151' }}>
              {g.label2 || '-'}
            </div>
            <div style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', boxSizing: 'border-box', background: getColor(g.backColor), color: getColor(g.fontColor) }}>
              {g.label1}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{g.label1}</div>
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
