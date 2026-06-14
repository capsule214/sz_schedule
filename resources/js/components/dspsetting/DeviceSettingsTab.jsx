import { useState, useMemo } from 'react';
import CommonOptions from './CommonOptions';

const BTN = {
  fontSize: 13, padding: '3px 8px', border: '1px solid #d1d5db',
  borderRadius: 4, cursor: 'pointer', background: '#f9fafb', flexShrink: 0,
};

export default function DeviceSettingsTab({ form, setField, serials }) {
  // 工程担当コード入力欄はタブローカルな UI 状態
  const [sbinchargeInput, setSbinchargeInput] = useState('');
  const showModelFilters = form.sbsbmb !== 1;

  // 装置区分・生産状態でフィルタした機種リスト
  const kisyuList = useMemo(() => {
    let src = serials;
    if (form.sbequiptype !== -1) {
      src = src.filter(s => s.equipTypeId === form.sbequiptype);
    }
    if (form.sbstatuslist.length === 0) {
      src = [];
    } else {
      src = src.filter(s => form.sbstatuslist.includes(s.seizoStatus));
    }
    const map = src.reduce((acc, s) => {
      const k = Number(s.kisyuId);
      if (!acc[k]) acc[k] = { kisyuId: k, kisyuName: s.kisyuName };
      return acc;
    }, {});
    return Object.values(map).sort((a, b) => a.kisyuName.localeCompare(b.kisyuName, 'ja'));
  }, [serials, form.sbequiptype, form.sbstatuslist]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 0 }}>
      {/* 製品表示 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: '#374151', flexShrink: 0 }}>製品表示</span>
        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
          {[['製番', 0], ['M番', 1]].map(([label, val]) => (
            <button
              key={val}
              type="button"
              onClick={() => setField('sbsbmb', val)}
              style={{
                padding: '4px 14px', border: 'none',
                borderRight: val === 0 ? '1px solid #d1d5db' : 'none',
                cursor: 'pointer', fontSize: 13,
                fontWeight: form.sbsbmb === val ? 600 : 400,
                background: form.sbsbmb === val ? '#2563eb' : '#fff',
                color: form.sbsbmb === val ? '#fff' : '#374151',
                transition: 'background 0.15s, color 0.15s',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {showModelFilters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: '#374151', flexShrink: 0 }}>装置区分</span>
          <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
            {[['全て', -1], ['AAA', 1], ['BBB', 2], ['CCC', 3]].map(([label, val], i, arr) => (
              <button
                key={val}
                type="button"
                onClick={() => setField('sbequiptype', val)}
                style={{
                  padding: '4px 14px', border: 'none',
                  borderRight: i < arr.length - 1 ? '1px solid #d1d5db' : 'none',
                  cursor: 'pointer', fontSize: 13,
                  fontWeight: form.sbequiptype === val ? 600 : 400,
                  background: form.sbequiptype === val ? '#2563eb' : '#fff',
                  color: form.sbequiptype === val ? '#fff' : '#374151',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >{label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>
        {showModelFilters && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              {[['試作機', 0], ['量産機', 1], ['生産終了機', 2]].map(([label, val]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={form.sbstatuslist.includes(val)}
                    onChange={e => setField(
                      'sbstatuslist',
                      e.target.checked
                        ? [...form.sbstatuslist, val]
                        : form.sbstatuslist.filter(v => v !== val),
                    )}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              onClick={() => setField('sbmodellist', kisyuList.map(k => k.kisyuId))}
              style={{ ...BTN, width: '100%' }}
            >全選択</button>
            <select
              multiple
              value={form.sbmodellist.map(String)}
              onChange={e => setField('sbmodellist', [...e.target.selectedOptions].map(o => Number(o.value)))}
              style={{ flex: 1, width: '100%', minHeight: 0, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, padding: '2px 0' }}
            >
              {kisyuList.map(k => (
                <option key={k.kisyuId} value={k.kisyuId}>{k.kisyuName}</option>
              ))}
            </select>
          </div>
        )}

        {/* 工程担当 / 装置グループ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>工程担当絞り込み</div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-start',
            padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6,
            background: '#fff', minHeight: 34,
          }}>
            {form.sbinchargelist.map(code => (
              <span key={code} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '1px 6px', borderRadius: 4,
                background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 600,
              }}>
                {code}
                <button
                  type="button"
                  onClick={() => setField('sbinchargelist', form.sbinchargelist.filter(c => c !== code))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#1d4ed8', fontSize: 13 }}
                >×</button>
              </span>
            ))}
            <input
              value={sbinchargeInput}
              onChange={e => setSbinchargeInput(e.target.value)}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ',') && sbinchargeInput.trim()) {
                  e.preventDefault();
                  const code = sbinchargeInput.trim();
                  if (!form.sbinchargelist.includes(code)) {
                    setField('sbinchargelist', [...form.sbinchargelist, code]);
                  }
                  setSbinchargeInput('');
                } else if (e.key === 'Backspace' && sbinchargeInput === '' && form.sbinchargelist.length > 0) {
                  setField('sbinchargelist', form.sbinchargelist.slice(0, -1));
                }
              }}
              placeholder={form.sbinchargelist.length === 0 ? '社員番号 + Enter' : ''}
              style={{ flex: 1, minWidth: 80, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', padding: '1px 2px' }}
            />
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Enterまたは「,」で追加</p>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginTop: 4 }}>装置グループ絞込</div>
          <button
            onClick={() => setField('sbszgrouplist', [1, 2, 3])}
            style={{ ...BTN, width: '100%' }}
          >全選択</button>
          <select
            multiple
            value={form.sbszgrouplist.map(String)}
            onChange={e => setField('sbszgrouplist', [...e.target.selectedOptions].map(o => Number(o.value)))}
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, padding: '2px 0' }}
            size={3}
          >
            <option value="1">1部</option>
            <option value="2">2部</option>
            <option value="3">3部</option>
          </select>
        </div>

        {/* 表示オプション */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 120 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>表示オプション1</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>表示期間</span>
              <input
                type="number" min={1} max={24}
                value={form.duration}
                onChange={e => setField('duration', Math.max(1, Number(e.target.value)))}
                style={{ width: 52, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'right' }}
              />
              <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>ヶ月</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>表示順</span>
              <select
                value={form.sborder}
                onChange={e => setField('sborder', Number(e.target.value))}
                style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              >
                <option value={0}>製番順</option>
                <option value={1}>着工日順</option>
                <option value={2}>出荷日順</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>タスク表示色</span>
              <select
                value={form.sbcolor}
                onChange={e => setField('sbcolor', Number(e.target.value))}
                style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              >
                <option value={0}>タスクカラー</option>
                <option value={1}>機種カラー</option>
              </select>
            </div>
          </div>

          <CommonOptions form={form} setField={setField} />
        </div>
      </div>
    </div>
  );
}
