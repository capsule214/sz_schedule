import { useEffect, useRef, useState } from 'react';
import { getColor } from '../../lib/colors';

function parseDateTime(value) {
  if (!value) return null;
  const text = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T00:00:00`
    : text.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = parseDateTime(value);
  if (!date) return String(value || '');
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function durationDays(start, end) {
  const startDate = parseDateTime(start);
  const endDate = parseDateTime(end);
  if (!startDate || !endDate) return '';
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);
}

export default function DprBarTooltip({ plan, anchorX, anchorY, onClose }) {
  const rootRef = useRef(null);
  const [position, setPosition] = useState({ left: anchorX + 12, top: anchorY + 12 });

  useEffect(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    let left = anchorX + 12;
    let top = anchorY + 12;
    if (left + rect.width > window.innerWidth - 8) left = anchorX - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = anchorY - rect.height - 8;
    setPosition({ left, top });
  }, [anchorX, anchorY]);

  useEffect(() => {
    const handleOutsideClick = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) onClose();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  const days = durationDays(plan.startDate, plan.endDate);
  const detailRows = [
    ['機種', plan.machine || plan.kisyuName],
    ['DPR No', plan.dprNo],
    ['担当者', plan.userNo || plan.workerName],
    ['開始', formatDateTime(plan.startDate)],
    ['終了', formatDateTime(plan.endDate)],
    ['日数', days ? `${days}日` : ''],
  ];

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed', left: position.left, top: position.top, zIndex: 9998,
        background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)', padding: 12, minWidth: 220, fontSize: 13,
        userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ background: getColor(plan.taskBackColor), color: getColor(plan.taskFontColor), padding: '2px 8px', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>
          {plan.taskName}
        </span>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {detailRows.map(([label, value]) => (
            <tr key={label}>
              <td style={{ color: '#6b7280', padding: '2px 8px 2px 0', whiteSpace: 'nowrap' }}>{label}</td>
              <td style={{ padding: '2px 0', fontWeight: 500 }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={onClose}
        style={{ position: 'absolute', top: 6, right: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#6b7280', userSelect: 'none' }}
      >×</button>
    </div>
  );
}
