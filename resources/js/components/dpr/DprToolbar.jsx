import { useState } from 'react';
import DatePickerDialog from '../DatePickerDialog';

const CONTROL_STYLE = {
  fontSize: 13,
  padding: '3px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
};

export default function DprToolbar({
  startDate,
  onStartDateChange,
  onShiftMonth,
  dprSearchText,
  onDprSearchTextChange,
  onDprSearch,
  onDprSearchClear,
  dateWidth,
  onDateWidthChange,
  onGenerate,
  generating = false,
}) {
  const [dateDialogOpen, setDateDialogOpen] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setDateDialogOpen(true)}
          title="表示開始日"
          style={{ ...CONTROL_STYLE, padding: '3px 10px', cursor: 'pointer' }}
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

      {[
        ['◀◀', -2, '2ヶ月前'],
        ['◀', -1, '1ヶ月前'],
        ['▶', 1, '1ヶ月後'],
        ['▶▶', 2, '2ヶ月後'],
      ].map(([label, months, title]) => (
        <button
          type="button"
          key={label}
          title={title}
          onClick={() => onShiftMonth(months)}
          style={{ ...CONTROL_STYLE, cursor: 'pointer' }}
        >
          {label}
        </button>
      ))}

      <input
        type="text"
        value={dprSearchText}
        onChange={event => onDprSearchTextChange(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') onDprSearch(); }}
        placeholder="DPR No検索"
        style={{ ...CONTROL_STYLE, minWidth: 145 }}
      />
      <button type="button" onClick={onDprSearch} style={{ ...CONTROL_STYLE, cursor: 'pointer' }}>検索</button>
      <button
        type="button"
        onClick={onDprSearchClear}
        disabled={!dprSearchText}
        style={{
          ...CONTROL_STYLE,
          background: dprSearchText ? '#fff' : '#f3f4f6',
          color: dprSearchText ? '#374151' : '#9ca3af',
          cursor: dprSearchText ? 'pointer' : 'not-allowed',
        }}
      >
        クリア
      </button>

      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
        日付幅
        <select
          value={dateWidth}
          onChange={e => onDateWidthChange(Number(e.target.value))}
          style={{ ...CONTROL_STYLE, padding: '3px 6px' }}
        >
          {[20, 40, 60, 80, 100, 120].map(width => (
            <option key={width} value={width}>{width}px</option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        style={{
          ...CONTROL_STYLE,
          marginLeft: 4,
          padding: '3px 10px',
          borderColor: generating ? '#93c5fd' : '#2563eb',
          background: generating ? '#93c5fd' : '#2563eb',
          color: '#fff',
          cursor: generating ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        {generating ? '生成中...' : 'm_dpr生成'}
      </button>
    </div>
  );
}
