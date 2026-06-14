import { useState } from 'react';
import DatePickerDialog from './DatePickerDialog';

export default function SpreadsheetGridToolbar({
  startDate,
  onStartDateChange,
  onShiftMonth,
  displayMonths,
  onDisplayMonthsChange,
  deviceCount,
  onDeviceCountChange,
  onSeedApply,
  mode,
  viewMode,
  onViewModeChange,
  serialSearchText,
  onSerialSearchTextChange,
  onSerialSearch,
  serialSearchPlaceholder = '製番検索',
  pllocation,
  onPlLocationChange,
  resources,
}) {
  const [dateDialogOpen, setDateDialogOpen] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setDateDialogOpen(true)}
          style={{ fontSize: 13, padding: '3px 10px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
        >
          {startDate}
        </button>
        <DatePickerDialog
          open={dateDialogOpen}
          value={startDate}
          title="表示開始日"
          onCancel={() => setDateDialogOpen(false)}
          onConfirm={(date) => {
            setDateDialogOpen(false);
            if (date && date !== startDate) onStartDateChange(date);
          }}
        />
      </div>
      {[['◀◀', -2], ['◀', -1], ['▶', 1], ['▶▶', 2]].map(([label, months]) => (
        <button
          key={label}
          onClick={() => onShiftMonth(months)}
          style={{ padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          {label}
        </button>
      ))}
      <select value={displayMonths} onChange={e => onDisplayMonthsChange(Number(e.target.value))} style={{ fontSize: 13, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}>
        {Array.from({ length: 24 }, (_, i) => i + 1).map(n => (
          <option key={n} value={n}>{n}ヶ月</option>
        ))}
      </select>
      {mode !== 'place' && mode !== 'task' && (
        <>
          <select value={deviceCount} onChange={e => onDeviceCountChange(Number(e.target.value))} style={{ fontSize: 13, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}>
            {[100, 200, 500, 1000, 2000, 5000, 10000, 20000].map(n => (
              <option key={n} value={n}>{n}件</option>
            ))}
          </select>
          <button onClick={onSeedApply} style={{ padding: '3px 10px', border: '1px solid #d1d5db', borderRadius: 4, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>適用</button>
        </>
      )}
      <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }} />
      {mode === 'place' && (() => {
        // Extract unique location types from the locations data
        const seen = new Set();
        const locationTypes = [];
        for (const loc of (resources || [])) {
          if (loc.locationTypeId != null && !seen.has(loc.locationTypeId)) {
            seen.add(loc.locationTypeId);
            locationTypes.push({ id: loc.locationTypeId, name: loc.locationTypeName ?? String(loc.locationTypeId) });
          }
        }
        return (
          <select
            value={pllocation ?? ''}
            onChange={e => onPlLocationChange?.(e.target.value === '' ? null : Number(e.target.value))}
            style={{ fontSize: 13, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
          >
            <option value="">全て</option>
            {locationTypes.map(lt => (
              <option key={lt.id} value={lt.id}>{lt.name}</option>
            ))}
          </select>
        );
      })()}
      <button onClick={() => onViewModeChange('day')} style={{ padding: '3px 8px', border: `1px solid ${viewMode === 'day' ? '#2563eb' : '#d1d5db'}`, borderRadius: 4, background: viewMode === 'day' ? '#eff6ff' : '#fff', color: viewMode === 'day' ? '#2563eb' : '#374151', cursor: 'pointer', fontSize: 13 }}>日単位</button>
      <button onClick={() => onViewModeChange('slot')} style={{ padding: '3px 8px', border: `1px solid ${viewMode === 'slot' ? '#2563eb' : '#d1d5db'}`, borderRadius: 4, background: viewMode === 'slot' ? '#eff6ff' : '#fff', color: viewMode === 'slot' ? '#2563eb' : '#374151', cursor: 'pointer', fontSize: 13 }}>時間割</button>
      {mode === 'device' && (
        <>
          <input
            type="text"
            value={serialSearchText}
            onChange={e => onSerialSearchTextChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSerialSearch();
            }}
            placeholder={serialSearchPlaceholder}
            style={{ fontSize: 13, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 140 }}
          />
          <button onClick={onSerialSearch} style={{ padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 13 }}>検索</button>
        </>
      )}
    </div>
  );
}
