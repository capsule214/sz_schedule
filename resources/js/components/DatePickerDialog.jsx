import { useEffect, useState } from 'react';
import DatePicker from './DatePicker';

const TODAY = new Date().toISOString().slice(0, 10);

export default function DatePickerDialog({ open, value, title = '日付を選択', onCancel, onConfirm }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

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
