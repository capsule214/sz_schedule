import { useState } from 'react';

const TODAY = new Date().toISOString().slice(0, 10);

function fmt(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function DatePicker({ value, onChange, minDate, maxDate, rangeStart, rangeEnd, calendarData }) {
  const init = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth() + 1);

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  // 2026年8月のように6週にまたがる月でもレイアウトが崩れないよう、常に6行（42セル）固定で表示する。
  // 当月の1日が含まれる週の日曜から42日分を並べ、前後の月の日付は薄く（opacity 0.5）表現する。
  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(viewYear, viewMonth - 1, 1 - firstDay + i);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const day = dt.getDate();
    cells.push({ y, m, day, ds: fmt(y, m, day), inMonth: m === viewMonth && y === viewYear });
  }

  function cellStyle(cell) {
    const { ds, inMonth } = cell;
    const dow = new Date(ds + 'T00:00:00').getDay();
    const disabled = (minDate && ds < minDate) || (maxDate && ds > maxDate);
    const isSelected = ds === value;
    const isToday = ds === TODAY;
    const inRange = rangeStart && rangeEnd && ds >= rangeStart && ds <= rangeEnd;

    const dayType = calendarData?.get(ds)?.dayType;
    const isHoliday = dayType === 3 || dayType === 4;

    let bg = 'transparent', color = '#111', cursor = 'pointer';
    let opacity = inMonth ? 1 : 0.5;
    if (disabled) { opacity = 0.35; cursor = 'default'; }
    if (dow === 0 || isHoliday) color = '#ef4444';
    if (dow === 6 && !isHoliday) color = '#3b82f6';
    if (inRange) bg = '#bfdbfe';
    if (isToday) { bg = '#ef4444'; color = '#fff'; }
    if (isSelected) { bg = '#2563eb'; color = '#fff'; }

    return { background: bg, color, cursor, opacity, borderRadius: 4, padding: '2px 0' };
  }

  return (
    <div style={{ userSelect: 'none', width: 210 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <button onClick={prevMonth} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 6px' }}>◀</button>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{viewYear}年{viewMonth}月</span>
        <button onClick={nextMonth} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 6px' }}>▶</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', textAlign: 'center', fontSize: 13, gap: 1 }}>
        {['日','月','火','水','木','金','土'].map((d, i) => (
          <div key={d} style={{ color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '#555', fontWeight: 600, padding: '2px 0' }}>{d}</div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            style={cellStyle(cell)}
            onClick={() => {
              const { ds, day, y, m, inMonth } = cell;
              const disabled = (minDate && ds < minDate) || (maxDate && ds > maxDate);
              if (disabled) return;
              // 当月外の日付を選んだ場合は表示月もその月へ移動する
              if (!inMonth) { setViewYear(y); setViewMonth(m); }
              onChange(ds);
            }}
          >
            {cell.day}
          </div>
        ))}
      </div>
    </div>
  );
}
