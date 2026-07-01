import { useEffect, useState } from 'react';
import DatePicker from './DatePicker';
import useCalendarData from '../lib/useCalendarData';
import { apiArray, apiJson } from '../lib/api';
import { TIME_SLOTS } from '../lib/spreadsheet';
import { loadExcludedDays, saveExcludedDays, splitScheduleByExcludedDays } from '../lib/scheduleExclusions';

function toDateStr(dateStr, hm) {
  return `${dateStr.slice(0, 10)}T${hm}:00`;
}

function parseDate(s) {
  if (!s) return { date: '', hm: TIME_SLOTS[0].start };
  const d = s.slice(0, 10);
  if (s.includes('T')) {
    const parts = s.slice(11).split(':');
    return { date: d, hm: `${parts[0]}:${parts[1]}` };
  }
  return { date: d, hm: TIME_SLOTS[0].start };
}

const ORDER_TYPE_NAMES = { 11: '直送DPR', 21: '加工オーダー' };
const fieldStyle = { width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' };
const labelStyle = { fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 3 };
const sectionStyle = { border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, minWidth: 0 };
const sectionTitleStyle = { margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#111827' };
const formGridStyle = { display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr)', gap: '8px 10px', alignItems: 'center' };
const timeButtonStyle = active => ({
  padding: '3px 7px', fontSize: 13, borderRadius: 4,
  border: `1px solid ${active ? '#2563eb' : '#d1d5db'}`,
  background: active ? '#2563eb' : '#fff',
  color: active ? '#fff' : '#374151',
  cursor: 'pointer',
});

export default function MorderScheduleDialog({ plan, gridMode, initialData, onSave, onClose }) {
  const init = plan || {};
  const sd = parseDate(init.startDate || initialData?.startDate || '');
  const ed = parseDate(init.endDate || initialData?.endDate || '');
  const orderTypeId = Number(init.morderOrderTypeId || initialData?.morderOrderTypeId || 21);
  const [startDate, setStartDate] = useState(sd.date || new Date().toISOString().slice(0, 10));
  const [startHm, setStartHm] = useState(TIME_SLOTS.some(s => s.start === sd.hm) ? sd.hm : TIME_SLOTS[0].start);
  const [endDate, setEndDate] = useState(ed.date || new Date().toISOString().slice(0, 10));
  const [endHm, setEndHm] = useState(TIME_SLOTS.some(s => s.end === ed.hm) ? ed.hm : TIME_SLOTS[TIME_SLOTS.length - 1].end);
  const [tasks, setTasks] = useState([]);
  const [teamList, setTeamList] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [morders, setMorders] = useState([]);
  const [morderId, setMorderId] = useState(init.morderId || initialData?.morderId || '');
  const [taskId, setTaskId] = useState(init.taskId || '');
  const [taskTypeFilter, setTaskTypeFilter] = useState('');
  const [workerId, setWorkerId] = useState(init.workerId ?? initialData?.workerId ?? '');
  const [teacherId, setTeacherId] = useState(init.teacherId ?? initialData?.teacherId ?? '');
  const [plannedMinutes, setPlannedMinutes] = useState(init.plannedMinutes ?? initialData?.plannedMinutes ?? 0);
  const [price, setPrice] = useState(init.price ?? initialData?.price ?? 0);
  const [remark, setRemark] = useState(init.remark ?? initialData?.remark ?? '');
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [error, setError] = useState('');
  const [excludedDays, setExcludedDays] = useState(loadExcludedDays);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      apiArray('/task'),
      apiArray('/worker/team'),
      apiArray(`/morder?order_type_id=${orderTypeId}`),
    ])
      .then(([taskData, teamData, morderData]) => {
        if (cancelled) return;
        setTasks(taskData);
        setTeamList(teamData);
        setMorders(morderData);
        if (!taskId && taskData?.[0]) setTaskId(taskData[0].taskId);
        if (!morderId && morderData?.[0]) setMorderId(morderData[0].morderId);
      })
      .catch(() => { if (!cancelled) setError('入力に必要なマスタデータの取得に失敗しました'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const initialWorkerId = init.workerId ?? initialData?.workerId;
    if (!initialWorkerId) return () => { cancelled = true; };
    apiJson(`/worker/${initialWorkerId}`)
      .then(worker => { if (!cancelled && !teamId) setTeamId(worker.teamId || ''); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const initialWorkerId = init.workerId ?? initialData?.workerId;
    if (teamId === '') {
      setWorkers([]);
      if (!initialWorkerId) setWorkerId('');
      return () => { cancelled = true; };
    }
    setWorkerLoading(true);
    apiArray(`/worker/team/${teamId}`)
      .then(data => {
        if (cancelled) return;
        setWorkers(data);
        const current = init.workerId ?? initialData?.workerId ?? workerId;
        const selected = data.find(w => String(w.workerId) === String(current)) || data[0];
        setWorkerId(selected?.workerId || '');
      })
      .catch(() => { if (!cancelled) setError('担当者リストの取得に失敗しました'); })
      .finally(() => { if (!cancelled) setWorkerLoading(false); });
    return () => { cancelled = true; };
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTeamChange(newTeamId) {
    setTeamId(newTeamId);
    setWorkerId('');
    setWorkers([]);
  }

  function handleTaskTypeChange(newTaskType) {
    setTaskTypeFilter(newTaskType);
    const matchedTasks = newTaskType === '' ? tasks : tasks.filter(t => String(t.taskTypeId) === String(newTaskType));
    if (matchedTasks.length && !matchedTasks.some(t => String(t.taskId) === String(taskId))) {
      setTaskId(matchedTasks[0].taskId);
    }
  }

  function handleExcludedDayChange(key, checked) {
    const next = { ...excludedDays, [key]: checked };
    setExcludedDays(next);
    saveExcludedDays(next);
  }

  function handleSave() {
    const sd2 = toDateStr(startDate, startHm);
    const ed2 = toDateStr(endDate, endHm);
    const selectedWorkerId = workerId !== '' ? workerId : (init.workerId ?? initialData?.workerId ?? '');
    if (sd2 > ed2) { setError('開始日時が終了日時より後になっています'); return; }
    if (!morderId) { setError('M番を選択してください'); return; }
    if (!taskId) { setError('工程を選択してください'); return; }
    const segments = enableExcludedDays && !plan ? splitScheduleByExcludedDays(sd2, ed2, excludedDays, calendarData) : [{ startDate: sd2, endDate: ed2 }];
    if (segments.length === 0) { setError('登録対象の日付がありません'); return; }
    setError('');
    onSave({
      serialId: -1,
      morderId: Number(morderId),
      taskId: Number(taskId),
      workerId: selectedWorkerId !== '' ? Number(selectedWorkerId) : null,
      teacherId: teacherId !== '' ? Number(teacherId) : null,
      startDate: sd2,
      endDate: ed2,
      plannedMinutes: Number(plannedMinutes || 0),
      price: Number(price || 0),
      remark,
      segments,
    });
  }

  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;
  const calendarData = useCalendarData(startDate);
  const enableExcludedDays = gridMode === 'device';
  const taskTypeOptions = gridMode === 'worker'
    ? [{ value: '', label: 'すべて' }, { value: '1', label: '作業予定' }, { value: '3', label: '個人予定' }]
    : [{ value: '', label: 'すべて' }, { value: '1', label: '作業予定' }, { value: '2', label: '製番予定' }];
  const filteredTasks = taskTypeFilter === '' ? tasks : tasks.filter(t => String(t.taskTypeId) === String(taskTypeFilter));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 1000, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{plan ? '予定を編集' : '予定を追加'}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: 'auto auto', gap: 14 }}>
          <div style={{ ...sectionStyle, display: 'grid', gridTemplateRows: 'auto auto', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <section>
                <h3 style={sectionTitleStyle}>タスク</h3>
                <div style={formGridStyle}>
                  <label style={labelStyle}>区分</label>
                  <select value={taskTypeFilter} onChange={e => handleTaskTypeChange(e.target.value)} disabled={loading} style={fieldStyle}>
                    {taskTypeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <label style={labelStyle}>タスク名</label>
                  <select value={taskId} onChange={e => setTaskId(e.target.value)} disabled={loading} style={fieldStyle}>
                    {loading && <option value="">取得中...</option>}
                    {!loading && filteredTasks.length === 0 && <option value="">（なし）</option>}
                    {filteredTasks.map(t => <option key={t.taskId} value={t.taskId}>{`${t.taskTypeName || '(未設定)'} ${t.taskName}`}</option>)}
                  </select>
                </div>
              </section>
              <section>
                <h3 style={sectionTitleStyle}>M番</h3>
                <div style={formGridStyle}>
                  <label style={labelStyle}>手配区分</label>
                  <input value={ORDER_TYPE_NAMES[orderTypeId] || ''} readOnly style={{ ...fieldStyle, background: '#f9fafb' }} />
                  <label style={labelStyle}>M番</label>
                  <select value={morderId} onChange={e => setMorderId(e.target.value)} disabled={loading} style={fieldStyle}>
                    {loading && <option value="">取得中...</option>}
                    {!loading && morders.length === 0 && <option value="">（なし）</option>}
                    {morders.map(m => <option key={m.morderId} value={m.morderId}>{m.morderNo}</option>)}
                  </select>
                </div>
              </section>
            </div>
            <section>
              <h3 style={sectionTitleStyle}>リソース</h3>
              <div style={formGridStyle}>
                <label style={labelStyle}>チーム</label>
                <select value={teamId} onChange={e => handleTeamChange(e.target.value)} disabled={loading} style={fieldStyle}>
                  <option value="">（未設定）</option>
                  {teamList.map(t => <option key={t.teamId} value={t.teamId}>{t.teamName}</option>)}
                </select>
                <label style={labelStyle}>担当者</label>
                <select value={workerId} onChange={e => setWorkerId(e.target.value)} disabled={teamId === '' || workerLoading} style={{ ...fieldStyle, background: teamId === '' || workerLoading ? '#f9fafb' : '' }}>
                  <option value="">（未設定）</option>
                  {workerLoading && <option value="">取得中...</option>}
                  {workers.map(w => <option key={w.workerId} value={w.workerId}>{w.workerName}</option>)}
                </select>
                <label style={labelStyle}>教育者</label>
                <select value={teacherId} onChange={e => setTeacherId(e.target.value)} disabled={teamId === '' || workerLoading} style={{ ...fieldStyle, background: teamId === '' || workerLoading ? '#f9fafb' : '' }}>
                  <option value="">（未設定）</option>
                  {workerLoading && <option value="">取得中...</option>}
                  {workers.map(w => <option key={w.workerId} value={w.workerId}>{w.workerName}</option>)}
                </select>
              </div>
            </section>
          </div>

          <div style={sectionStyle}><h3 style={sectionTitleStyle}>TBD</h3></div>

          <div style={sectionStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={labelStyle}>開始日</div>
                  <DatePicker value={startDate} onChange={setStartDate} rangeStart={rangeStart} rangeEnd={rangeEnd} calendarData={calendarData} />
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {TIME_SLOTS.map(s => <button key={s.label} onClick={() => setStartHm(s.start)} style={timeButtonStyle(startHm === s.start)}>{s.label}</button>)}
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>終了日</div>
                  <DatePicker value={endDate} onChange={setEndDate} rangeStart={rangeStart} rangeEnd={rangeEnd} calendarData={calendarData} />
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {TIME_SLOTS.map(s => <button key={s.label} onClick={() => setEndHm(s.end)} style={timeButtonStyle(endHm === s.end)}>{s.label}</button>)}
                  </div>
                </div>
              </div>
              {enableExcludedDays && (
              <div>
                <div style={labelStyle}>予定登録除外する曜日</div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {[
                    ['saturday', '土曜'],
                    ['sunday', '日曜'],
                    ['holiday', '祝日'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!excludedDays[key]} onChange={e => handleExcludedDayChange(key, e.target.checked)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              )}
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={labelStyle}>予定工数(分)</label><input type="number" min="0" value={plannedMinutes} onChange={e => setPlannedMinutes(e.target.value)} style={fieldStyle} /></div>
              <div><label style={labelStyle}>価格</label><input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} style={fieldStyle} /></div>
              <div><label style={labelStyle}>備考</label><textarea value={remark} onChange={e => setRemark(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} /></div>
            </div>
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '7px 18px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSave} style={{ padding: '7px 18px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>保存</button>
        </div>
      </div>
    </div>
  );
}
