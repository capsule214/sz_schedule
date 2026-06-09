import { useState, useEffect } from 'react';
import DatePicker from './DatePicker';
import { TIME_SLOTS } from '../lib/spreadsheet';
import { apiArray, apiJson } from '../lib/api';
function toDateStr(dateStr, hm) {
  const d = dateStr.slice(0, 10);
  return `${d}T${hm}:00`;
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

export default function ScheduleDialog({ plan, resources = [], gridMode, initialData, onSave, onClose }) {
  const init = plan || {};
  const sd = parseDate(init.startDate || initialData?.startDate || '');
  const ed = parseDate(init.endDate || initialData?.endDate || '');

  const [startDate, setStartDate] = useState(sd.date || new Date().toISOString().slice(0, 10));
  const [startHm, setStartHm] = useState(TIME_SLOTS.some(s => s.start === sd.hm) ? sd.hm : TIME_SLOTS[0].start);
  const [endDate, setEndDate] = useState(ed.date || new Date().toISOString().slice(0, 10));
  const [endHm, setEndHm] = useState(TIME_SLOTS.some(s => s.end === ed.hm) ? ed.hm : TIME_SLOTS[TIME_SLOTS.length - 1].end);
  const [kisyuList, setKisyuList] = useState([]);
  const [serials, setSerials] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamList, setTeamList] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [dialogResources, setDialogResources] = useState(resources);
  const [serialId, setSerialId] = useState(init.serialId || initialData?.serialId || '');
  const [taskId, setTaskId] = useState(init.taskId || '');
  const [workerId, setWorkerId] = useState(init.workerId ?? initialData?.workerId ?? '');
  const [resourceId, setResourceId] = useState(init.resourceId || initialData?.resourceId || resources?.[0]?.resourceId || '');
  const [kisyuId, setKisyuId] = useState(init.kisyuId || initialData?.kisyuId || '');
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [serialLoading, setSerialLoading] = useState(false);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadInitialMasters() {
      setLoading(true);
      setError('');
      try {
        const requests = [
          apiArray('/serial/kisyu'),
        ];
        if (gridMode !== 'place') {
          requests.push(apiArray('/task'), apiArray('/worker/team'));
        } else if (!resources?.length) {
          requests.push(apiArray('/resource'));
        }
        const results = await Promise.all(requests);
        if (cancelled) return;
        setKisyuList(results[0]);
        if (gridMode !== 'place') {
          setTasks(results[1]);
          setTeamList(results[2]);
          if (!taskId && results[1]?.[0]) setTaskId(results[1][0].taskId);
        } else if (!resources?.length) {
          setDialogResources(results[1]);
          if (!resourceId && results[1]?.[0]) setResourceId(results[1][0].resourceId);
        }
        if (!kisyuId && results[0]?.[0]) setKisyuId(results[0][0].kisyuId);
      } catch {
        if (!cancelled) setError('入力に必要なマスタデータの取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInitialMasters();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    if (!kisyuId) {
      setSerials([]);
      return;
    }
    setSerialLoading(true);
    apiArray(`/serial/kisyu/${kisyuId}`)
      .then(data => {
        if (cancelled) return;
        setSerials(data);
        const current = init.serialId || initialData?.serialId || serialId;
        const selected = data.find(s => String(s.serialId) === String(current)) || data[0];
        setSerialId(selected?.serialId || '');
      })
      .catch(() => { if (!cancelled) setError('製番リストの取得に失敗しました'); })
      .finally(() => { if (!cancelled) setSerialLoading(false); });
    return () => { cancelled = true; };
  }, [kisyuId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    if (gridMode === 'place') return () => { cancelled = true; };
    const initialWorkerId = init.workerId ?? initialData?.workerId;
    if (!initialWorkerId) return () => { cancelled = true; };
    apiJson(`/worker/${initialWorkerId}`)
      .then(worker => {
        if (!cancelled && !teamId) setTeamId(worker.teamId || '');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    if (gridMode === 'place') return () => { cancelled = true; };
    if (teamId === '') {
      setWorkers([]);
      setWorkerId('');
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

  function handleKisyuChange(newKisyuId) {
    setKisyuId(newKisyuId);
    setSerialId('');
    setSerials([]);
  }

  function handleTeamChange(newTeamId) {
    setTeamId(newTeamId);
    if (newTeamId === '') {
      setWorkerId('');
    } else {
      setWorkerId('');
      setWorkers([]);
    }
  }

  function handleSave() {
    const sd2 = toDateStr(startDate, startHm);
    const ed2 = toDateStr(endDate, endHm);
    if (sd2 > ed2) { setError('開始日時が終了日時より後になっています'); return; }
    if (!serialId) { setError('製番を選択してください'); return; }
    if (gridMode !== 'place' && !taskId) { setError('工程を選択してください'); return; }
    if (gridMode === 'place' && !resourceId) { setError('場所を選択してください'); return; }
    setError('');
    if (gridMode === 'place') {
      onSave({ resourceId: Number(resourceId), serialId: Number(serialId), startDate: sd2, endDate: ed2 });
    } else {
      onSave({ serialId: Number(serialId), taskId: Number(taskId), workerId: workerId !== '' ? Number(workerId) : null, startDate: sd2, endDate: ed2 });
    }
  }

  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd   = startDate <= endDate ? endDate : startDate;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 10, padding: 24, width: 600,
        maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
          {plan ? '予定を編集' : '予定を追加'}
        </h2>

        <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>開始日</div>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {TIME_SLOTS.map(s => (
                <button
                  key={s.label}
                  onClick={() => setStartHm(s.start)}
                  style={{
                    padding: '3px 7px', fontSize: 13, borderRadius: 4,
                    border: `1px solid ${startHm === s.start ? '#2563eb' : '#d1d5db'}`,
                    background: startHm === s.start ? '#2563eb' : '#fff',
                    color: startHm === s.start ? '#fff' : '#374151',
                    cursor: 'pointer',
                  }}
                >{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>終了日</div>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {TIME_SLOTS.map(s => (
                <button
                  key={s.label}
                  onClick={() => setEndHm(s.end)}
                  style={{
                    padding: '3px 7px', fontSize: 13, borderRadius: 4,
                    border: `1px solid ${endHm === s.end ? '#2563eb' : '#d1d5db'}`,
                    background: endHm === s.end ? '#2563eb' : '#fff',
                    color: endHm === s.end ? '#fff' : '#374151',
                    cursor: 'pointer',
                  }}
                >{s.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {gridMode === 'place' ? (
            <>
              <div>
                <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 3 }}>場所</label>
                <input
                  readOnly
                  value={dialogResources?.find(r => r.resourceId == resourceId)?.resourceName || ''}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: '#f9fafb' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 3 }}>機種</label>
                <select
                  value={kisyuId}
                  onChange={e => handleKisyuChange(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                >
                  {loading && <option value="">取得中...</option>}
                  {kisyuList.map(k => (
                    <option key={k.kisyuId} value={k.kisyuId}>{k.kisyuName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 3 }}>整番</label>
                <select
                  value={serialId}
                  onChange={e => setSerialId(e.target.value)}
                  disabled={!kisyuId || serialLoading}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: !kisyuId || serialLoading ? '#f9fafb' : '' }}
                >
                  {serialLoading && <option value="">取得中...</option>}
                  {!serialLoading && serials.length === 0 && <option value="">（なし）</option>}
                  {serials.map(s => (
                    <option key={s.serialId} value={s.serialId}>{s.serialNo}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 3 }}>機種</label>
                <select
                  value={kisyuId}
                  onChange={e => handleKisyuChange(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                >
                  {loading && <option value="">取得中...</option>}
                  {kisyuList.map(k => (
                    <option key={k.kisyuId} value={k.kisyuId}>{k.kisyuName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 3 }}>製番</label>
                <select
                  value={serialId}
                  onChange={e => setSerialId(e.target.value)}
                  disabled={!kisyuId || serialLoading}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: !kisyuId || serialLoading ? '#f9fafb' : '' }}
                >
                  {serialLoading && <option value="">取得中...</option>}
                  {!serialLoading && serials.length === 0 && <option value="">（なし）</option>}
                  {serials.map(s => (
                    <option key={s.serialId} value={s.serialId}>{s.serialNo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 3 }}>工程</label>
                <select
                  value={taskId}
                  onChange={e => setTaskId(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                >
                  {loading && <option value="">取得中...</option>}
                  {tasks.map(t => (
                    <option key={t.taskId} value={t.taskId}>{t.taskName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 3 }}>チーム</label>
                <select
                  value={teamId}
                  onChange={e => handleTeamChange(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                >
                  <option value="">（未設定）</option>
                  {teamList.map(t => (
                    <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 3 }}>担当者</label>
                <select
                  value={workerId}
                  onChange={e => setWorkerId(e.target.value)}
                  disabled={teamId === '' || workerLoading}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: teamId === '' || workerLoading ? '#f9fafb' : '' }}
                >
                  <option value="">（未設定）</option>
                  {workerLoading && <option value="">取得中...</option>}
                  {workers.map(w => (
                    <option key={w.workerId} value={w.workerId}>{w.workerName}</option>
                  ))}
                </select>
              </div>
            </>
          )}
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
