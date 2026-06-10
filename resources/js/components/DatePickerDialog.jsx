import { useEffect, useState } from 'react';
import DatePicker from './DatePicker';
import { apiArray } from '../lib/api';

const TODAY = new Date().toISOString().slice(0, 10);

export default function DatePickerDialog({ open, value, title = '日付を選択', onCancel, onConfirm }) {
  const [draft, setDraft] = useState(value);
  const [calendarData, setCalendarData] = useState(new Map());

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  // ダイアログを開いたとき、基準日±1年のカレンダーデータを取得
  useEffect(() => {
    if (!open) return;
    const base = value || TODAY;
    const baseDate = new Date(base + 'T00:00:00');
    const from = new Date(baseDate);
    from.setFullYear(from.getFullYear() - 1);
    const to = new Date(baseDate);
    to.setFullYear(to.getFullYear() + 1);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr   = to.toISOString().slice(0, 10);

    apiArray('/calendar/search', {
      method: 'POST',
      body: JSON.stringify({ from: fromStr, to: toStr }),
    }).then(data => {
      const map = new Map();
      for (const c of data) map.set(c.date, { dayType: c.dayType });
      setCalendarData(map);
    }).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 10000,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 8, padding: 16,
        border: '1px solid #d1d5db',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</div>
        <DatePicker
          value={draft}
          calendarData={calendarData}
          onChange={(date) => {
            setDraft(date);
            onConfirm(date);
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ padding: '7px 18px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            キャンセル
          </button>
          <button
            onClick={() => onConfirm(TODAY)}
            style={{ padding: '7px 18px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            今日
          </button>
        </div>
      </div>
    </div>
  );
}
