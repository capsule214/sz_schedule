import { useEffect, useState } from 'react';
import DatePicker from '../DatePicker';
import { apiArray } from '../../lib/api';
import useCalendarData from '../../lib/useCalendarData';

const DPR_TASKS = [
  { taskId: 20001, taskName: 'DPRメカ設計' },
  { taskId: 20002, taskName: 'DPRエレキ設計' },
  { taskId: 20003, taskName: 'DPRソフト設計' },
  { taskId: 20004, taskName: 'DPR他' },
];

const fieldStyle = {
  width: '100%', padding: '6px 10px', border: '1px solid #d1d5db',
  borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
};
const labelStyle = { fontSize: 13, color: '#6b7280' };
const valueStyle = { fontSize: 13, color: '#111827', overflowWrap: 'anywhere' };
const sectionStyle = { border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, minWidth: 0 };

export default function DprScheduleDialog({ plan = null, initialData, onSave, onClose }) {
  const dprNo = plan?.dprNo ?? initialData.dprNo;
  const [taskId, setTaskId] = useState(Number(plan?.taskId ?? 20001));
  const [workerNo, setWorkerNo] = useState(plan?.userNo ?? '');
  const [startDate, setStartDate] = useState(String(plan?.startDate ?? initialData.startDate).slice(0, 10));
  const [endDate, setEndDate] = useState(String(plan?.endDate ?? initialData.endDate).slice(0, 10));
  const [remark, setRemark] = useState(plan?.remark ?? '');
  const [serials, setSerials] = useState([]);
  const [serialLoading, setSerialLoading] = useState(true);
  const [serialError, setSerialError] = useState(false);
  const calendarData = useCalendarData(startDate);
  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;

  useEffect(() => {
    let cancelled = false;
    setSerialLoading(true);
    setSerialError(false);
    apiArray('/dpr/related-serials', {
      method: 'POST',
      body: JSON.stringify({ dprNo }),
    })
      .then(rows => { if (!cancelled) setSerials(rows); })
      .catch(() => { if (!cancelled) setSerialError(true); })
      .finally(() => { if (!cancelled) setSerialLoading(false); });
    return () => { cancelled = true; };
  }, [dprNo]);

  function handleSave() {
    if (startDate > endDate) return;
    onSave({
      dprNo,
      taskId,
      userNo: workerNo ? workerNo.padStart(5, '0') : null,
      startDate: `${startDate}T08:30:00`,
      endDate: `${endDate}T21:25:00`,
      remark,
    });
  }

  const serialLabel = serialLoading
    ? '取得中...'
    : serialError
      ? '製番情報を取得できませんでした'
      : serials.length > 0
        ? serials.map(serial => serial.serialNo).filter(Boolean).join(', ')
        : '（なし）';

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div style={{ width: 1000, maxWidth: 'calc(100vw - 24px)', maxHeight: '92vh', overflowY: 'auto', padding: 24, boxSizing: 'border-box', borderRadius: 10, background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{plan ? 'DPR予定を編集' : 'DPR予定を追加'}</h2>
          <button type="button" aria-label="閉じる" onClick={onClose} style={{ border: 0, background: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: 'auto auto', gap: 14 }}>
          <section style={sectionStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(120px, 1fr) 72px minmax(180px, 1.4fr)', gap: '8px 10px', alignItems: 'center' }}>
              <span style={labelStyle}>DPR No</span>
              <strong style={valueStyle}>{dprNo}</strong>
              <label style={labelStyle}>タスク名</label>
              <select value={taskId} onChange={event => setTaskId(Number(event.target.value))} style={fieldStyle}>
                {DPR_TASKS.map(task => <option key={task.taskId} value={task.taskId}>{task.taskName}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: '8px 10px', alignItems: 'center', marginTop: 14 }}>
              <span style={labelStyle}>機種</span>
              <span style={valueStyle}>{initialData.machine || '-'}</span>
              <span style={labelStyle}>製番</span>
              <span style={valueStyle}>{serialLabel}</span>
              <label style={labelStyle}>担当者</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={workerNo}
                onChange={event => setWorkerNo(event.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="担当者番号"
                style={{ ...fieldStyle, maxWidth: 220 }}
              />
            </div>
          </section>

          <section aria-label="右上領域" style={{ ...sectionStyle, minHeight: 150 }} />

          <section style={sectionStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ ...labelStyle, marginBottom: 4 }}>開始日</div>
                <DatePicker value={startDate} onChange={setStartDate} rangeStart={rangeStart} rangeEnd={rangeEnd} calendarData={calendarData} />
              </div>
              <div>
                <div style={{ ...labelStyle, marginBottom: 4 }}>終了日</div>
                <DatePicker value={endDate} onChange={setEndDate} rangeStart={rangeStart} rangeEnd={rangeEnd} calendarData={calendarData} />
              </div>
            </div>
          </section>

          <section style={sectionStyle}>
            <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>備考</label>
            <textarea
              value={remark}
              onChange={event => setRemark(event.target.value)}
              rows={10}
              style={{ ...fieldStyle, resize: 'vertical', minHeight: 210 }}
            />
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ padding: '7px 18px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>キャンセル</button>
          <button type="button" onClick={handleSave} style={{ padding: '7px 18px', border: 0, borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>保存</button>
        </div>
      </div>
    </div>
  );
}
