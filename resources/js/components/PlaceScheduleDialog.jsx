import { useEffect, useMemo, useRef, useState } from 'react';
import DatePicker from './DatePicker';
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
  const [kisyuPickerOpen, setKisyuPickerOpen] = useState(false);
  const [serialQuery, setSerialQuery] = useState(init.serialNo ?? initialData?.serialNo ?? '');
  const [serialPickerOpen, setSerialPickerOpen] = useState(false);
  const [kisyuList, setKisyuList] = useState([]);
  const [serials, setSerials] = useState([]);
  const [kisyuListFetched, setKisyuListFetched] = useState(false);
  const [serialLoading, setSerialLoading] = useState(false);
  const [loading, setLoading] = useState(!resources?.length);
  const [error, setError] = useState('');
  const [remark, setRemark] = useState(init.remark ?? initialData?.remark ?? '');
  const serialFetchedKisyuRef = useRef(null);
  const serialSelectRef = useRef(null);

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

  async function ensureKisyuList() {
    if (kisyuListFetched) return;
    setKisyuListFetched(true);
    try {
      setKisyuList(await apiArray('/serial/kisyu'));
    } catch {
      setKisyuListFetched(false);
      setError('機種リストの取得に失敗しました');
    }
  }

  async function fetchSerialList(nextKisyuId) {
    if (!nextKisyuId) return;
    serialFetchedKisyuRef.current = String(nextKisyuId);
    setSerialLoading(true);
    try {
      const data = await apiArray(`/serial/kisyu/${nextKisyuId}`);
      setSerials(data);
      const selected = data.find(s => String(s.serialId) === String(serialId));
      if (selected) {
        setSerialNo(selected.serialNo);
      } else if (serialId) {
        setSerialId('');
        setSerialNo('');
      }
    } catch {
      serialFetchedKisyuRef.current = null;
      setError('製番リストの取得に失敗しました');
    } finally {
      setSerialLoading(false);
    }
  }

  async function ensureSerialList() {
    if (!kisyuId || serialFetchedKisyuRef.current === String(kisyuId)) return;
    await fetchSerialList(kisyuId);
  }

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
    setKisyuQuery(k?.kisyuName ?? '');
    setKisyuPickerOpen(false);
    setSerialId('');
    setSerialNo('');
    setSerialQuery('');
    setSerials([]);
    serialFetchedKisyuRef.current = null;
    fetchSerialList(newKisyuId);
  }

  function handleKisyuInputChange(value) {
    setKisyuQuery(value);
    setKisyuPickerOpen(true);
    if (value !== kisyuName) {
      setKisyuId('');
      setKisyuName('');
      setSerialId('');
      setSerialNo('');
      setSerialQuery('');
      setSerials([]);
      serialFetchedKisyuRef.current = null;
    }
  }

  function handleSerialChange(newSerialId) {
    const s = serials.find(s => String(s.serialId) === String(newSerialId));
    setSerialId(newSerialId);
    setSerialNo(s?.serialNo ?? '');
    setSerialQuery(s?.serialNo ?? '');
    setSerialPickerOpen(false);
  }

  function handleSerialInputChange(value) {
    setSerialQuery(value);
    setSerialPickerOpen(true);
    if (value !== serialNo) {
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

    const kisyuText = normalizeCandidateText(kisyuQuery);
    if (kisyuText) {
      const currentKisyuMatches = kisyuId && normalizeCandidateText(kisyuName) === kisyuText;
      const kisyuMatch = currentKisyuMatches
        ? { kisyuId, kisyuName }
        : kisyuList.find(k => normalizeCandidateText(k.kisyuName) === kisyuText);
      if (!kisyuMatch) {
        setError('機種は候補から選択してください');
        setKisyuPickerOpen(true);
        return;
      }
    }

    const serialText = normalizeCandidateText(serialQuery);
    let selectedSerialId = 0;
    if (serialText) {
      const currentSerialMatches = serialId && normalizeCandidateText(serialNo) === serialText;
      const serialMatch = currentSerialMatches
        ? { serialId, serialNo }
        : serials.find(s => normalizeCandidateText(s.serialNo) === serialText);
      if (!serialMatch) {
        setError('製番は候補から選択してください');
        setSerialPickerOpen(true);
        return;
      }
      selectedSerialId = Number(serialMatch.serialId);
    }

    setError('');
    onSave({ resourceId: Number(resourceMatch.resourceId), serialId: selectedSerialId, startDate: sd2, endDate: ed2, remark });
  }

  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;
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
    return source.slice(0, 80);
  }, [kisyuList, kisyuQuery]);
  const filteredSerials = useMemo(() => {
    const q = serialQuery.trim().toLowerCase();
    const source = q
      ? serials.filter(s => String(s.serialNo || '').toLowerCase().includes(q))
      : serials;
    return source.slice(0, 80);
  }, [serials, serialQuery]);

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
              <div style={{ position: 'relative' }}>
                <input
                  value={kisyuQuery}
                  onChange={e => handleKisyuInputChange(e.target.value)}
                  onFocus={() => { ensureKisyuList(); setKisyuPickerOpen(true); }}
                  onBlur={() => setTimeout(() => setKisyuPickerOpen(false), 120)}
                  placeholder="機種検索"
                  style={fieldStyle}
                />
                {kisyuPickerOpen && (
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
                    {filteredKisyus.length === 0 ? (
                      <div style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280' }}>候補なし</div>
                    ) : filteredKisyus.map(k => (
                      <button
                        key={k.kisyuId}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); handleKisyuChange(k.kisyuId); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '7px 10px',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          background: String(kisyuId) === String(k.kisyuId) ? '#eff6ff' : '#fff',
                          color: '#111827',
                          textAlign: 'left',
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        {k.kisyuName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label style={labelStyle}>製番</label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={serialSelectRef}
                  value={serialQuery}
                  onChange={e => handleSerialInputChange(e.target.value)}
                  onFocus={() => { ensureSerialList(); setSerialPickerOpen(true); }}
                  onBlur={() => setTimeout(() => setSerialPickerOpen(false), 120)}
                  disabled={!kisyuId || serialLoading}
                  placeholder={serialLoading ? '取得中...' : '製番検索'}
                  style={{ ...fieldStyle, background: !kisyuId || serialLoading ? '#f9fafb' : '' }}
                />
                {serialPickerOpen && kisyuId && !serialLoading && (
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
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleSerialChange(''); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '7px 10px',
                        border: 'none',
                        borderBottom: '1px solid #f3f4f6',
                        background: serialId === '' ? '#eff6ff' : '#fff',
                        color: '#6b7280',
                        textAlign: 'left',
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      （製番なし）
                    </button>
                    {filteredSerials.length === 0 ? (
                      <div style={{ padding: '8px 10px', fontSize: 13, color: '#6b7280' }}>候補なし</div>
                    ) : filteredSerials.map(s => (
                      <button
                        key={s.serialId}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); handleSerialChange(s.serialId); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '7px 10px',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          background: String(serialId) === String(s.serialId) ? '#eff6ff' : '#fff',
                          color: '#111827',
                          textAlign: 'left',
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        {s.serialNo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>開始日</div>
              <DatePicker value={startDate} onChange={setStartDate} rangeStart={rangeStart} rangeEnd={rangeEnd} />
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {TIME_SLOTS.map(s => <button key={s.label} onClick={() => setStartHm(s.start)} style={timeButtonStyle(startHm === s.start)}>{s.label}</button>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>終了日</div>
              <DatePicker value={endDate} onChange={setEndDate} rangeStart={rangeStart} rangeEnd={rangeEnd} />
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
