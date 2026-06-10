import { useState } from 'react';

/** タグ入力欄（Enter / , で追加、Backspace で末尾削除） */
function TagInput({ values, onAdd, onRemove, placeholder = '入力 + Enter', numeric = false }) {
  const [text, setText] = useState('');

  function commit() {
    const raw = text.trim();
    if (!raw) return;
    const val = numeric ? Number(raw) : raw;
    if (!values.some(v => String(v) === String(val))) {
      onAdd(val);
    }
    setText('');
  }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-start',
      padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6,
      background: '#fff', minHeight: 34,
    }}>
      {values.map((v, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '1px 6px', borderRadius: 4,
          background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {v}
          <button
            type="button"
            onClick={() => onRemove(v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#1d4ed8', fontSize: 13 }}
          >×</button>
        </span>
      ))}
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && text === '' && values.length > 0) {
            onRemove(values[values.length - 1]);
          }
        }}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : ''}
        style={{ flex: 1, minWidth: 72, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', padding: '1px 2px' }}
      />
    </div>
  );
}

/** フィルタ行（ラベル + TagInput） */
function FilterRow({ label, values, setField, fieldKey, numeric = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{label}</span>
      <TagInput
        values={values}
        numeric={numeric}
        onAdd={v => setField(fieldKey, [...values, v])}
        onRemove={v => setField(fieldKey, values.filter(x => String(x) !== String(v)))}
      />
    </div>
  );
}

export default function DprSettingsTab({ form, setField }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 0 }}>
      {/* 表示オプション1（上部横並び） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        {/* 表示期間 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>表示期間</span>
          <input
            type="number" min={1} max={24}
            value={form.dprduration}
            onChange={e => setField('dprduration', Math.max(1, Number(e.target.value)))}
            style={{ width: 52, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'right' }}
          />
          <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>ヶ月</span>
        </div>

        {/* 表示順 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>表示順</span>
          <select
            value={form.dprorder}
            onChange={e => setField('dprorder', Number(e.target.value))}
            style={{ padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
          >
            <option value={0}>製番順</option>
            <option value={1}>着工日順</option>
            <option value={2}>出荷日順</option>
          </select>
        </div>

        {/* タスク表示色 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>タスク表示色</span>
          <select
            value={form.dprcolor}
            onChange={e => setField('dprcolor', Number(e.target.value))}
            style={{ padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
          >
            <option value={0}>タスクカラー</option>
            <option value={1}>機種カラー</option>
          </select>
        </div>

        {/* 製番予定も表示 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={form.dprflgseiban}
            onChange={e => setField('dprflgseiban', e.target.checked)}
          />
          <span style={{ fontSize: 13, color: '#374151' }}>製番予定も表示</span>
        </label>
      </div>

      {/* フィルタ + 表示オプション */}
      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'auto', minHeight: 0 }}>
        {/* フィルタ列1 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>絞り込み（製品）</div>
          <FilterRow label="機種名" values={form.dprmodellist} setField={setField} fieldKey="dprmodellist" />
          <FilterRow label="発行年" values={form.dprpublicationyearlist} setField={setField} fieldKey="dprpublicationyearlist" />
          <FilterRow label="種別" values={form.dprclassificationlist} setField={setField} fieldKey="dprclassificationlist" />
          <FilterRow label="ステータス" values={form.dprstatuslist} setField={setField} fieldKey="dprstatuslist" />
          <FilterRow label="出荷形態" values={form.dprdeliverytypelist} setField={setField} fieldKey="dprdeliverytypelist" numeric />
          <FilterRow label="受注形態" values={form.dprformtypelist} setField={setField} fieldKey="dprformtypelist" numeric />
        </div>

        {/* フィルタ列2 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>絞り込み（担当）</div>
          <FilterRow label="営業拠点" values={form.dprsaleslocationlist} setField={setField} fieldKey="dprsaleslocationlist" />
          <FilterRow label="担当者" values={form.dprinchargelist} setField={setField} fieldKey="dprinchargelist" />
          <FilterRow label="製造グループ" values={form.dprszgrouplist} setField={setField} fieldKey="dprszgrouplist" />
        </div>

      </div>
    </div>
  );
}
