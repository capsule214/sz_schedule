import { useEffect, useMemo, useState } from 'react';
import DatePicker from './DatePicker';
import useCalendarData from '../lib/useCalendarData';
import { apiArray } from '../lib/api';
import { TIME_SLOTS } from '../lib/spreadsheet';

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

const timeButtonStyle = active => ({
  padding: '3px 7px', fontSize: 13, borderRadius: 4,
  border: `1px solid ${active ? '#2563eb' : '#d1d5db'}`,
  background: active ? '#2563eb' : '#fff',
  color: active ? '#fff' : '#374151',
  cursor: 'pointer',
});

function normalizeCandidateText(value) {
  return String(value || '').trim().toLowerCase();
}

export default function PlaceScheduleDialog({ plan, resources = [], initialData, onSave, onClose }) {
  const init = plan || {};
  const sd = parseDate(init.startDate || initialData?.startDate || '');
  const ed = parseDate(init.endDate || initialData?.endDate || '');
  const [startDate, setStartDate] = useState(sd.date || new Date().toISOString().slice(0, 10));
  const [startHm, setStartHm] = useState(TIME_SLOTS.some(s => s.start === sd.hm) ? sd.hm : TIME_SLOTS[0].start);
  const [endDate, setEndDate] = useState(ed.date || new Date().toISOString().slice(0, 10));
  const [endHm, setEndHm] = useState(TIME_SLOTS.some(s => s.end === ed.hm) ? ed.hm : TIME_SLOTS[TIME_SLOTS.length - 1].end);
  const [dialogResources, setDialogResources] = useState(resources);
  const [resourceId, setResourceId] = useState(init.resourceId || initialData?.resourceId || resources?.[0]?.resourceId || '');
  const initialResource = resources?.find(r => String(r.resourceId) === String(init.resourceId || initialData?.resourceId));
  const [floorId, setFloorId] = useState(initialResource?.locationTypeId || '');
  const [resourceQuery, setResourceQuery] = useState(initialResource?.resourceName || init.resourceName || initialData?.resourceName || '');
  const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
  const [serialId, setSerialId] = useState(init.serialId || initialData?.serialId || '');
  const [kisyuId, setKisyuId] = useState(init.kisyuId || initialData?.kisyuId || '');
  const [kisyuName, setKisyuName] = useState(init.kisyuName ?? initialData?.kisyuName ?? '');
  const [serialNo, setSerialNo] = useState(init.serialNo ?? initialData?.serialNo ?? '');
  const [kisyuQuery, setKisyuQuery] = useState(init.kisyuName ?? initialData?.kisyuName ?? '');
  const [serialQuery, setSerialQuery] = useState(init.serialNo ?? initialData?.serialNo ?? '');
  const [kisyuList, setKisyuList] = useState([]);
  const [serials, setSerials] = useState([]);
  const [loading, setLoading] = useState(!resources?.length);
  const [error, setError] = useState('');
  const [remark, setRemark] = useState(init.remark ?? initialData?.remark ?? '');

  useEffect(() => {
    if (resources?.length) {
      const selected = resources.find(r => String(r.resourceId) === String(resourceId));
      if (selected) {
        if (floorId === '') setFloorId(selected.locationTypeId || '');
        if (!resourceQuery) setResourceQuery(selected.resourceName || '');
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiArray('/resource')
      .then(data => {
        if (cancelled) return;
        setDialogResources(data);
        const selected = data.find(r => String(r.resourceId) === String(resourceId)) || data[0];
        if (selected) {
          if (!resourceId) setResourceId(selected.resourceId);
          setFloorId(selected.locationTypeId || '');
          setResourceQuery(selected.resourceName || '');
        }
      })
      .catch(() => { if (!cancelled) setError('入力に必要なマスタデータの取得に失敗しました'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiArray('/serial/kisyu'), apiArray('/serial')])
      .then(([kisyus, serialData]) => {
        if (cancelled) return;
        setKisyuList(kisyus);
        setSerials(serialData);
      })
      .catch(() => { if (!cancelled) setError('機種・製番リストの取得に失敗しました'); });
    return () => { cancelled = true; };
  }, []);

  function handleFloorChange(newFloorId) {
    setFloorId(newFloorId);
    const nextResource = dialogResources.find(r => String(r.locationTypeId) === String(newFloorId));
    setResourceId(nextResource?.resourceId || '');
    setResourceQuery(nextResource?.resourceName || '');
    setResourcePickerOpen(false);
  }

  function handleResourceChange(newResourceId) {
    const r = dialogResources.find(r => String(r.resourceId) === String(newResourceId));
    setResourceId(newResourceId);
    setResourceQuery(r?.resourceName || '');
    setResourcePickerOpen(false);
  }

  function handleResourceInputChange(value) {
    setResourceQuery(value);
    setResourcePickerOpen(true);
    const selected = dialogResources.find(r => String(r.resourceId) === String(resourceId));
    if (value !== (selected?.resourceName || '')) setResourceId('');
  }

  function handleKisyuChange(newKisyuId) {
    const k = kisyuList.find(k => String(k.kisyuId) === String(newKisyuId));
    setKisyuId(newKisyuId);
    setKisyuName(k?.kisyuName ?? '');
    setKisyuQuery(newKisyuId ? (k?.kisyuName ?? '') : '');
    setSerialId('');
    setSerialNo('');
    setSerialQuery('');
  }

  function handleKisyuInputChange(value) {
    setKisyuQuery(value);
    if (value !== kisyuName || value === '') {
      setKisyuId('');
      setKisyuName('');
      setSerialId('');
      setSerialNo('');
      setSerialQuery('');
    }
  }

  function handleSerialChange(newSerialId) {
    const s = serials.find(s => String(s.serialId) === String(newSerialId));
    setSerialId(newSerialId);
    setSerialNo(s?.serialNo ?? '');
    if (newSerialId) {
      setSerialQuery(s?.serialNo ?? '');
      setKisyuId(s?.kisyuId || '');
      setKisyuName(s?.kisyuName || '');
      setKisyuQuery(s?.kisyuName || '');
    } else {
      setSerialQuery('');
    }
  }

  function handleSerialInputChange(value) {
    setSerialQuery(value);
    if (value !== serialNo || value === '') {
      setSerialId('');
      setSerialNo('');
    }
  }

  function handleSave() {
    const sd2 = toDateStr(startDate, startHm);
    const ed2 = toDateStr(endDate, endHm);
    if (sd2 > ed2) { setError('開始日時が終了日時より後になっています'); return; }
    const resourceText = normalizeCandidateText(resourceQuery);
    const resourceMatch = filteredResources.find(r => normalizeCandidateText(r.resourceName) === resourceText);
    if (!resourceText || !resourceMatch) {
      setError('場所は候補から選択してください');
      setResourcePickerOpen(true);
      return;
    }

    let selectedSerialId = 0;
    if (serialId) {
      selectedSerialId = Number(serialId);
    } else if (serialQuery.trim()) {
      setError('製番はリストから選択してください');
      return;
    }

    setError('');
    onSave({ resourceId: Number(resourceMatch.resourceId), serialId: selectedSerialId, startDate: sd2, endDate: ed2, remark });
  }

  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;
  const calendarData = useCalendarData(startDate);
  const labelStyle = { fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 3 };
  const fieldStyle = { width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' };
  const floorOptions = [...new Map(dialogResources.map(r => [r.locationTypeId, {
    locationTypeId: r.locationTypeId,
    locationTypeName: r.locationTypeName || '',
  }])).values()].filter(f => f.locationTypeId);
  const filteredResources = floorId === ''
    ? dialogResources
    : dialogResources.filter(r => String(r.locationTypeId) === String(floorId));
  const visibleResources = useMemo(() => {
    const q = resourceQuery.trim().toLowerCase();
    const source = q
      ? filteredResources.filter(r => String(r.resourceName || '').toLowerCase().includes(q))
      : filteredResources;
    return source.slice(0, 80);
  }, [filteredResources, resourceQuery]);
  const filteredKisyus = useMemo(() => {
    const q = kisyuQuery.trim().toLowerCase();
    const source = q
      ? kisyuList.filter(k => String(k.kisyuName || '').toLowerCase().includes(q))
      : kisyuList;
    const selected = kisyuId ? kisyuList.find(k => String(k.kisyuId) === String(kisyuId)) : null;
    const list = selected && !source.some(k => String(k.kisyuId) === String(selected.kisyuId))
      ? [selected, ...source]
      : source;
    return list.slice(0, 80);
  }, [kisyuList, kisyuQuery, kisyuId]);
  const filteredSerials = useMemo(() => {
    const q = serialQuery.trim().toLowerCase();
    const byText = q
      ? serials.filter(s => String(s.serialNo || '').toLowerCase().includes(q))
      : serials;
    const source = kisyuId
      ? byText.filter(s => String(s.kisyuId) === String(kisyuId))
      : byText;
    const selected = serialId ? serials.find(s => String(s.serialId) === String(serialId)) : null;
    const list = selected && !source.some(s => String(s.serialId) === String(selected.serialId))
      ? [selected, ...source]
      : source;
    return list.slice(0, 80);
  }, [serials, serialQuery, kisyuId, serialId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 600, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{plan ? '予定を編集' : '予定を追加'}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>フロア</label>
              <select value={floorId} onChange={e => handleFloorChange(e.target.value)} disabled={loading} style={fieldStyle}>
                {floorOptions.length === 0 && <option value="">（なし）</option>}
                {floorOptions.map(f => <option key={f.locationTypeId} value={f.locationTypeId}>{f.locationTypeName}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>場所</label>
              <div style={{ position: 'relative' }}>
                <input
                  value={resourceQuery}
                  onChange={e => handleResourceInputChange(e.target.value)}
                  onFocus={() => setResourcePickerOpen(true)}
                  onBlur={() => setTimeout(() => setResourcePickerOpen(false), 120)}
                  disabled={loading || filteredResources.length === 0}
                  placeholder="場所検索"
                  style={{ ...fieldStyle, background: loading || filteredResources.length === 0 ? '#f9fafb' : '' }}
                />
                {resourcePickerOpen && !loading && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 'calc(100% + 2px)',
                    zIndex: 10001,
                    maxHeight: 220,
                    overflowY: 'auto',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                  }}>
                    {visibleResources.length === 0 ? (
                      <div style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280' }}>候補なし</div>
                    ) : visibleResources.map(r => (
                      <button
                        key={r.resourceId}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); handleResourceChange(r.resourceId); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '7px 10px',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          background: String(resourceId) === String(r.resourceId) ? '#eff6ff' : '#fff',
                          color: '#111827',
                          textAlign: 'left',
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        {r.resourceName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>機種</label>
              <input
                value={kisyuQuery}
                onChange={e => handleKisyuInputChange(e.target.value)}
                placeholder="機種検索"
                style={{ ...fieldStyle, marginBottom: 6 }}
              />
              <select
                value={kisyuId}
                onChange={e => handleKisyuChange(e.target.value)}
                size={6}
                style={{ ...fieldStyle, height: 136, padding: 0 }}
              >
                <option value="">（未選択）</option>
                {filteredKisyus.length === 0 && <option value="" disabled>候補なし</option>}
                {filteredKisyus.map(k => <option key={k.kisyuId} value={k.kisyuId}>{k.kisyuName}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>製番</label>
              <input
                value={serialQuery}
                onChange={e => handleSerialInputChange(e.target.value)}
                placeholder="製番検索"
                style={{ ...fieldStyle, marginBottom: 6 }}
              />
              <select
                value={serialId}
                onChange={e => handleSerialChange(e.target.value)}
                size={6}
                style={{ ...fieldStyle, height: 136, padding: 0 }}
              >
                <option value="">（製番なし）</option>
                {filteredSerials.length === 0 && <option value="" disabled>候補なし</option>}
                {filteredSerials.map(s => <option key={s.serialId} value={s.serialId}>{`${s.serialNo}${s.kisyuName ? ` / ${s.kisyuName}` : ''}`}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>開始日</div>
              <DatePicker value={startDate} onChange={setStartDate} rangeStart={rangeStart} rangeEnd={rangeEnd} calendarData={calendarData} />
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {TIME_SLOTS.map(s => <button key={s.label} onClick={() => setStartHm(s.start)} style={timeButtonStyle(startHm === s.start)}>{s.label}</button>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>終了日</div>
              <DatePicker value={endDate} onChange={setEndDate} rangeStart={rangeStart} rangeEnd={rangeEnd} calendarData={calendarData} />
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {TIME_SLOTS.map(s => <button key={s.label} onClick={() => setEndHm(s.end)} style={timeButtonStyle(endHm === s.end)}>{s.label}</button>)}
              </div>
            </div>
          </div>
          <div>
            <label style={labelStyle}>備考</label>
            <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '7px 18px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSave} disabled={loading} style={{ padding: '7px 18px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>保存</button>
        </div>
      </div>
    </div>
  );
}
