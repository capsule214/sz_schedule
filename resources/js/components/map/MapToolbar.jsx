const CONTROL_STYLE = {
  fontSize: 13,
  padding: '4px 9px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  boxSizing: 'border-box',
};

export default function MapToolbar({
  startDate,
  onStartDateChange,
  onShiftMonth,
  floor,
  onFloorChange,
  serialSearchText,
  onSerialSearchTextChange,
  onSearch,
  onSearchClear,
  onRefresh,
  loading,
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}>
      <button type="button" onClick={() => onShiftMonth(-2)} style={{ ...CONTROL_STYLE, cursor: 'pointer', flexShrink: 0 }}>2ヶ月前</button>
      <button type="button" onClick={() => onShiftMonth(-1)} style={{ ...CONTROL_STYLE, cursor: 'pointer', flexShrink: 0 }}>1ヶ月前</button>
      <input
        type="date"
        aria-label="マップ表示開始日"
        value={startDate}
        onChange={event => onStartDateChange(event.target.value)}
        style={{ ...CONTROL_STYLE, flexShrink: 0 }}
      />
      <button type="button" onClick={() => onShiftMonth(1)} style={{ ...CONTROL_STYLE, cursor: 'pointer', flexShrink: 0 }}>1ヶ月後</button>
      <button type="button" onClick={() => onShiftMonth(2)} style={{ ...CONTROL_STYLE, cursor: 'pointer', flexShrink: 0 }}>2ヶ月後</button>

      <select value={floor} onChange={event => onFloorChange(event.target.value)} aria-label="マップ表示フロア" style={{ ...CONTROL_STYLE, marginLeft: 4, flexShrink: 0 }}>
        {['A棟3F', 'A棟4F', 'A棟5F'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>

      <div style={{ position: 'relative', width: 150, marginLeft: 4, flexShrink: 0 }}>
        <input
          type="text"
          value={serialSearchText}
          onChange={event => onSerialSearchTextChange(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') onSearch(); }}
          placeholder="製番入力"
          aria-label="マップ製番検索"
          style={{ ...CONTROL_STYLE, width: '100%', paddingRight: serialSearchText ? 30 : 9 }}
        />
        {serialSearchText && (
          <button
            type="button"
            onClick={onSearchClear}
            aria-label="マップ製番検索をクリア"
            title="検索をクリア"
            style={{ position: 'absolute', top: '50%', right: 3, transform: 'translateY(-50%)', width: 24, height: 24, padding: 0, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >×</button>
        )}
      </div>
      <button type="button" onClick={onSearch} disabled={loading} style={{ ...CONTROL_STYLE, cursor: loading ? 'wait' : 'pointer', flexShrink: 0 }}>検索</button>
      <button type="button" onClick={onRefresh} disabled={loading} style={{ ...CONTROL_STYLE, cursor: loading ? 'wait' : 'pointer', flexShrink: 0 }}>再描画</button>
      {loading && <span style={{ color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>データ取得中...</span>}
    </div>
  );
}
