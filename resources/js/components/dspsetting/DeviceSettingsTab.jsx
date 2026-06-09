const BTN = {
  fontSize: 13, padding: '3px 8px', border: '1px solid #d1d5db',
  borderRadius: 4, cursor: 'pointer', background: '#f9fafb', flexShrink: 0,
};

export default function DeviceSettingsTab({
  duration,
  setDuration,
  sborder,
  setSborder,
  sbcolor,
  setSbcolor,
  sbsbmb,
  setSbsbmb,
  sbequiptype,
  setSbequiptype,
  sbstatuslist,
  setSbstatuslist,
  sbinchargelist,
  setSbinchargelist,
  sbinchargeInput,
  setSbinchargeInput,
  sbszgrouplist,
  setSbszgrouplist,
  sbmodellist,
  setSbmodellist,
  sboption,
  setSboption,
  synobody,
  setSynobody,
  sbdspplplan,
  setSbdspplplan,
  sbdspdate,
  setSbdspdate,
  sbdspincharge,
  setSbdspincharge,
  flgsyoyo,
  setFlgsyoyo,
  flgukeoi,
  setFlgukeoi,
  flgkeppin,
  setFlgkeppin,
  flggoso,
  setFlggoso,
  flgdiff,
  setFlgdiff,
  kisyuList,
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: '#374151', flexShrink: 0 }}>製品表示</span>
        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
          {[['製番', 0], ['M番', 1]].map(([label, val]) => (
            <button
              key={val}
              type="button"
              onClick={() => setSbsbmb(val)}
              style={{
                padding: '4px 14px',
                border: 'none',
                borderRight: val === 0 ? '1px solid #d1d5db' : 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: sbsbmb === val ? 600 : 400,
                background: sbsbmb === val ? '#2563eb' : '#fff',
                color: sbsbmb === val ? '#fff' : '#374151',
                transition: 'background 0.15s, color 0.15s',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: '#374151', flexShrink: 0 }}>装置区分</span>
        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
          {[['全て', -1], ['AAA', 1], ['BBB', 2], ['CCC', 3]].map(([label, val], i, arr) => (
            <button
              key={val}
              type="button"
              onClick={() => setSbequiptype(val)}
              style={{
                padding: '4px 14px',
                border: 'none',
                borderRight: i < arr.length - 1 ? '1px solid #d1d5db' : 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: sbequiptype === val ? 600 : 400,
                background: sbequiptype === val ? '#2563eb' : '#fff',
                color: sbequiptype === val ? '#fff' : '#374151',
                transition: 'background 0.15s, color 0.15s',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden', minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {[['試作機', 0], ['量産機', 1], ['生産終了機', 2]].map(([label, val]) => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={sbstatuslist.includes(val)}
                  onChange={e => setSbstatuslist(prev =>
                    e.target.checked ? [...prev, val] : prev.filter(v => v !== val)
                  )}
                />
                {label}
              </label>
            ))}
          </div>
          <button
            onClick={() => setSbmodellist(kisyuList.map(k => k.kisyuId))}
            style={{ ...BTN, width: '100%' }}
          >全選択</button>
          <select
            multiple
            value={sbmodellist.map(String)}
            onChange={e => {
              setSbmodellist([...e.target.selectedOptions].map(o => Number(o.value)));
            }}
            style={{
              flex: 1, width: '100%', minHeight: 0,
              border: '1px solid #d1d5db', borderRadius: 6,
              fontSize: 13, padding: '2px 0',
            }}
          >
            {kisyuList.map(k => (
              <option key={k.kisyuId} value={k.kisyuId}>{k.kisyuName}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>工程担当絞り込み</div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-start',
            padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6,
            background: '#fff', minHeight: 34,
          }}>
            {sbinchargelist.map(code => (
              <span key={code} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '1px 6px', borderRadius: 4,
                background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 600,
              }}>
                {code}
                <button
                  type="button"
                  onClick={() => setSbinchargelist(prev => prev.filter(c => c !== code))}
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
                  if (!sbinchargelist.includes(code)) {
                    setSbinchargelist(prev => [...prev, code]);
                  }
                  setSbinchargeInput('');
                } else if (e.key === 'Backspace' && sbinchargeInput === '' && sbinchargelist.length > 0) {
                  setSbinchargelist(prev => prev.slice(0, -1));
                }
              }}
              placeholder={sbinchargelist.length === 0 ? '社員番号 + Enter' : ''}
              style={{
                flex: 1, minWidth: 80, border: 'none', outline: 'none',
                fontSize: 13, background: 'transparent', padding: '1px 2px',
              }}
            />
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
            Enterまたは「,」で追加
          </p>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginTop: 4 }}>装置グループ絞込</div>
          <button
            onClick={() => setSbszgrouplist([1, 2, 3])}
            style={{ ...BTN, width: '100%' }}
          >全選択</button>
          <select
            multiple
            value={sbszgrouplist.map(String)}
            onChange={e => setSbszgrouplist([...e.target.selectedOptions].map(o => Number(o.value)))}
            style={{
              width: '100%', border: '1px solid #d1d5db', borderRadius: 6,
              fontSize: 13, padding: '2px 0',
            }}
            size={3}
          >
            <option value="1">1部</option>
            <option value="2">2部</option>
            <option value="3">3部</option>
          </select>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 120 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>表示オプション1</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>表示期間</span>
              <input
                type="number"
                min={1}
                max={24}
                value={duration}
                onChange={e => setDuration(Math.max(1, Number(e.target.value)))}
                style={{
                  width: 52, padding: '4px 6px',
                  border: '1px solid #d1d5db', borderRadius: 6,
                  fontSize: 13, textAlign: 'right',
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>ヶ月</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>表示順</span>
              <select
                value={sborder}
                onChange={e => setSborder(Number(e.target.value))}
                style={{
                  flex: 1, padding: '4px 6px',
                  border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13,
                }}
              >
                <option value={0}>製番順</option>
                <option value={1}>着工日順</option>
                <option value={2}>出荷日順</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>タスク表示色</span>
              <select
                value={sbcolor}
                onChange={e => setSbcolor(Number(e.target.value))}
                style={{
                  flex: 1, padding: '4px 6px',
                  border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13,
                }}
              >
                <option value={0}>タスクカラー</option>
                <option value={1}>機種カラー</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>表示オプション2</div>
            {[
              [sboption,    e => setSboption(e.target.checked),    '完了製品も表示'],
              [synobody,    e => setSynobody(e.target.checked),    '社員未定も表示'],
              [sbdspplplan, e => setSbdspplplan(e.target.checked), '場所予定も表示'],
              [sbdspdate,   e => setSbdspdate(e.target.checked),   '出荷日を表示'],
              [sbdspincharge, e => setSbdspincharge(e.target.checked), '責任者を表示'],
              [flgsyoyo,    e => setFlgsyoyo(e.target.checked),    '所要日連動を表示'],
              [flgukeoi,    e => setFlgukeoi(e.target.checked),    '請負発注状態を表示'],
              [flgkeppin,   e => setFlgkeppin(e.target.checked),   '部品欠品状態を表示'],
              [flggoso,     e => setFlggoso(e.target.checked),     '後送有無を表示'],
              [flgdiff,     e => setFlgdiff(e.target.checked),     '当日変更状態を表示'],
            ].map(([checked, onChange, label]) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={checked} onChange={onChange} />
                <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
