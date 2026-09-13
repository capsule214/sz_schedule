import { useState } from 'react';
import DatePickerDialog from './DatePickerDialog';

export default function SpreadsheetGridToolbar({
  startDate,
  onStartDateChange,
  onShiftMonth,
  deviceCount,
  onDeviceCountChange,
  onSeedApply,
  mode,
  dateWidth,
  onDateWidthChange,
  serialSearchText,
  onSerialSearchTextChange,
  onSerialSearch,
  onSerialSearchClear,
  serialSearchPlaceholder = '製番検索',
  workerSearchText = '',
  onWorkerSearchTextChange,
  onWorkerSearch,
  onWorkerSearchClear,
  onRefresh,
  lastUpdatedAt,
  pllocation,
  onPlLocationChange,
  resources,
}) {
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const updatedAtLabel = lastUpdatedAt
    ? new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(lastUpdatedAt)
    : '未更新';

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
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
        日付幅
        <select
          value={dateWidth}
          onChange={e => onDateWidthChange(Number(e.target.value))}
          style={{ fontSize: 13, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
        >
          {[20, 40, 60, 80, 100, 120].map(width => (
            <option key={width} value={width}>{width}px</option>
          ))}
        </select>
      </label>
      {mode === 'worker' && (
        <>
          <div style={{ position: 'relative', minWidth: 170 }}>
            <input
              type="text"
              value={workerSearchText}
              onChange={e => onWorkerSearchTextChange?.(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onWorkerSearch?.();
              }}
              placeholder="担当者名/user_no検索"
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: `3px ${workerSearchText ? 28 : 6}px 3px 6px`, border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            {workerSearchText && (
              <button
                type="button"
                aria-label="担当者検索をクリア"
                title="検索をクリア"
                onClick={onWorkerSearchClear}
                style={{ position: 'absolute', top: '50%', right: 3, transform: 'translateY(-50%)', width: 22, height: 22, padding: 0, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >×</button>
            )}
          </div>
          <button onClick={onWorkerSearch} style={{ padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 13 }}>検索</button>
        </>
      )}
      {mode === 'device' && (
        <>
          <div style={{ position: 'relative', minWidth: 140 }}>
            <input
              type="text"
              value={serialSearchText}
              onChange={e => onSerialSearchTextChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onSerialSearch();
              }}
              placeholder={serialSearchPlaceholder}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: `3px ${serialSearchText ? 28 : 6}px 3px 6px`, border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            {serialSearchText && (
              <button
                type="button"
                aria-label="装置検索をクリア"
                title="検索をクリア"
                onClick={onSerialSearchClear}
                style={{ position: 'absolute', top: '50%', right: 3, transform: 'translateY(-50%)', width: 22, height: 22, padding: 0, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >×</button>
            )}
          </div>
          <button onClick={onSerialSearch} style={{ padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 13 }}>検索</button>
        </>
      )}
      <button onClick={onRefresh} style={{ padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 13 }}>再描画</button>
      <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>表示更新 {updatedAtLabel}</span>
    </div>
  );
}
