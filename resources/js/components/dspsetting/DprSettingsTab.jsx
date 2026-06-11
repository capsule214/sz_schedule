import { useState, useEffect, useRef } from 'react';
import { apiJson } from '../../lib/api';

const BTN = {
  fontSize: 13, padding: '3px 8px', border: '1px solid #d1d5db',
  borderRadius: 4, cursor: 'pointer', background: '#f9fafb', flexShrink: 0,
};

const STATUSES       = ['オークション中', '設計中', 'A完了', '枝番発行済', '設計完了', '中止'];
const FORM_TYPES     = [[1, 'DPR有償'], [2, 'DPR無償'], [3, '一括受注']];
const DELIVERY_TYPES = [[1, '客先直送'], [2, '機械組込']];
const CLASSES        = ['A', 'B', 'AtoB'];

/** チェックボックス1個 */
function Chk({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

/** タグ入力欄 */
function TagInput({ values, onAdd, onRemove, placeholder = '入力 + Enter' }) {
  const [text, setText] = useState('');

  function commit() {
    const val = text.trim();
    if (!val || values.includes(val)) return;
    onAdd(val);
    setText('');
  }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-start',
      padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6,
      background: '#fff', minHeight: 34, flex: 1,
    }}>
      {values.map(v => (
        <span key={v} style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '1px 6px', borderRadius: 4,
          background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 600,
        }}>
          {v}
          <button type="button" onClick={() => onRemove(v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#1d4ed8', fontSize: 13 }}
          >×</button>
        </span>
      ))}
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && text.trim()) { e.preventDefault(); commit(); }
          else if (e.key === 'Backspace' && text === '' && values.length > 0) onRemove(values[values.length - 1]);
        }}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : ''}
        style={{ flex: 1, minWidth: 80, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', padding: '1px 2px' }}
      />
    </div>
  );
}

/** タグ入力セクション（ラベル＋入力欄） */
function TagSection({ label, values, onAdd, onRemove, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{label}</div>
      <TagInput values={values} onAdd={onAdd} onRemove={onRemove} placeholder={placeholder} />
      <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Enterまたは「,」で追加</p>
    </div>
  );
}

export default function DprSettingsTab({ form, setField, machines = [], salesLocations = [], publicationYears = [] }) {
  // チェックボックスで絞り込んだ後の選択肢（初期値はプロップから）
  const [filteredMachines,   setFilteredMachines]   = useState([]);
  const [filteredLocations,  setFilteredLocations]  = useState([]);
  const [filteredYears,      setFilteredYears]      = useState([]);

  // stale closure を避けるための form 参照
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; });

  // チェックボックス4種が変化したら filter-options API を呼んで選択肢を更新
  useEffect(() => {
    const { dprformtypelist: ft, dprdeliverytypelist: dt,
            dprclassificationlist: cl, dprstatuslist: st } = form;

    const hasFilter = ft.length > 0 || dt.length > 0 || cl.length > 0 || st.length > 0;

    // チェックが全て外れているときは何も表示しない
    if (!hasFilter) {
      setFilteredMachines([]);
      setFilteredLocations([]);
      setFilteredYears([]);
      setField('dprmodellist',          []);
      setField('dprsaleslocationlist',  []);
      setField('dprpublicationyearlist',[]);
      return;
    }

    const params = new URLSearchParams();
    ft.forEach(v => params.append('formtype[]',       v));
    dt.forEach(v => params.append('deliverytype[]',   v));
    cl.forEach(v => params.append('classification[]', v));
    st.forEach(v => params.append('status[]',         v));

    let cancelled = false;
    apiJson(`/dpr/filter-options?${params}`)
      .then(({ machines: m, locations: l, years: y }) => {
        if (cancelled) return;
        setFilteredMachines(m);
        setFilteredLocations(l);
        setFilteredYears(y);
        // 絞り込みで存在しなくなった選択済みアイテムを自動解除
        const f = formRef.current;
        setField('dprmodellist',          f.dprmodellist.filter(v => m.includes(v)));
        setField('dprsaleslocationlist',  f.dprsaleslocationlist.filter(v => l.includes(v)));
        setField('dprpublicationyearlist',f.dprpublicationyearlist.filter(v => y.includes(v)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [form.dprformtypelist, form.dprdeliverytypelist, form.dprclassificationlist, form.dprstatuslist]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleStr(key, val) {
    setField(key,
      form[key].includes(val)
        ? form[key].filter(v => v !== val)
        : [...form[key], val],
    );
  }
  function toggleInt(key, val) {
    setField(key,
      form[key].includes(val)
        ? form[key].filter(v => v !== val)
        : [...form[key], val],
    );
  }
  function tagAdd(key, val) { setField(key, [...form[key], val]); }
  function tagRemove(key, val) { setField(key, form[key].filter(x => x !== val)); }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 0 }}>

      {/* ─── 上部：チェックボックスで絞り込み条件を全選択 ─── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12,
        paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #e5e7eb', flexShrink: 0,
      }}>
        {/* 受注形態 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>受注形態</span>
          {FORM_TYPES.map(([val, label]) => (
            <Chk key={val}
              checked={form.dprformtypelist.includes(val)}
              onChange={() => toggleInt('dprformtypelist', val)}
              label={label}
            />
          ))}
        </div>

        <div style={{ width: 1, background: '#e5e7eb', alignSelf: 'stretch', flexShrink: 0 }} />

        {/* 出荷形態 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>出荷形態</span>
          {DELIVERY_TYPES.map(([val, label]) => (
            <Chk key={val}
              checked={form.dprdeliverytypelist.includes(val)}
              onChange={() => toggleInt('dprdeliverytypelist', val)}
              label={label}
            />
          ))}
        </div>

        <div style={{ width: 1, background: '#e5e7eb', alignSelf: 'stretch', flexShrink: 0 }} />

        {/* 種別 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>種別</span>
          {CLASSES.map(val => (
            <Chk key={val}
              checked={form.dprclassificationlist.includes(val)}
              onChange={() => toggleStr('dprclassificationlist', val)}
              label={val}
            />
          ))}
        </div>

        <div style={{ width: 1, background: '#e5e7eb', alignSelf: 'stretch', flexShrink: 0 }} />

        {/* ステータス */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>ステータス</span>
          {STATUSES.map(val => (
            <Chk key={val}
              checked={form.dprstatuslist.includes(val)}
              onChange={() => toggleStr('dprstatuslist', val)}
              label={val}
            />
          ))}
        </div>
      </div>

      {/* ─── 下部：2:1:1 の3カラム ─── */}
      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>

        {/* 左 flex:2 → 内部を横3分割（機種 / 営業拠点 / 発行年） */}
        <div style={{ flex: 2, display: 'flex', gap: 8, overflow: 'hidden', minHeight: 0, minWidth: 0 }}>

          {/* 機種選択（装置タブと同じ multi-select） */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>機種選択</div>
            <button
              onClick={() => setField('dprmodellist', [...filteredMachines])}
              style={{ ...BTN, width: '100%' }}
            >全選択</button>
            <select
              multiple
              value={form.dprmodellist}
              onChange={e => setField('dprmodellist', [...e.target.selectedOptions].map(o => o.value))}
              style={{ flex: 1, width: '100%', minHeight: 0, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, padding: '2px 0' }}
            >
              {filteredMachines.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 営業拠点選択 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>営業拠点選択</div>
            <button
              onClick={() => setField('dprsaleslocationlist', [...filteredLocations])}
              style={{ ...BTN, width: '100%' }}
            >全選択</button>
            <select
              multiple
              value={form.dprsaleslocationlist}
              onChange={e => setField('dprsaleslocationlist', [...e.target.selectedOptions].map(o => o.value))}
              style={{ flex: 1, width: '100%', minHeight: 0, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, padding: '2px 0' }}
            >
              {filteredLocations.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* 発行年選択 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>発行年選択</div>
            <button
              onClick={() => setField('dprpublicationyearlist', [...filteredYears])}
              style={{ ...BTN, width: '100%' }}
            >全選択</button>
            <select
              multiple
              value={form.dprpublicationyearlist}
              onChange={e => setField('dprpublicationyearlist', [...e.target.selectedOptions].map(o => o.value))}
              style={{ flex: 1, width: '100%', minHeight: 0, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, padding: '2px 0' }}
            >
              {filteredYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 中 flex:1 → DPR担当絞込 + 製造グループ絞込 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', minWidth: 0 }}>
          <TagSection
            label="DPR担当絞込"
            values={form.dprinchargelist}
            placeholder="社員番号 + Enter"
            onAdd={v => tagAdd('dprinchargelist', v)}
            onRemove={v => tagRemove('dprinchargelist', v)}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>装置グループ絞込</div>
            <button
              onClick={() => setField('dprszgrouplist', [1, 2, 3])}
              style={{ ...BTN, width: '100%' }}
            >全選択</button>
            <select
              multiple
              value={form.dprszgrouplist.map(String)}
              onChange={e => setField('dprszgrouplist', [...e.target.selectedOptions].map(o => Number(o.value)))}
              style={{ flex: 1, width: '100%', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, padding: '2px 0' }}
            >
              <option value="1">1部</option>
              <option value="2">2部</option>
              <option value="3">3部</option>
            </select>
          </div>
        </div>

        {/* 右 flex:1 → 表示オプション */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flexShrink: 0 }}>
          {/* 表示オプション1 */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>表示オプション1</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>表示期間</span>
            <input
              type="number" min={1} max={24}
              value={form.dprduration}
              onChange={e => setField('dprduration', Math.max(1, Number(e.target.value)))}
              style={{ width: 52, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'right' }}
            />
            <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>ヶ月</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>表示順</span>
            <select
              value={form.dprorder}
              onChange={e => setField('dprorder', Number(e.target.value))}
              style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
            >
              <option value={0}>製番順</option>
              <option value={1}>着工日順</option>
              <option value={2}>出荷日順</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>表示カラー</span>
            <select
              value={form.dprcolor}
              onChange={e => setField('dprcolor', Number(e.target.value))}
              style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
            >
              <option value={0}>タスクカラー</option>
              <option value={1}>機種カラー</option>
            </select>
          </div>

          {/* 表示オプション2 */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginTop: 6 }}>表示オプション2</div>
          <Chk
            checked={form.dprflgseiban}
            onChange={e => setField('dprflgseiban', e.target.checked)}
            label="製番予定も表示"
          />
        </div>
      </div>
    </div>
  );
}
