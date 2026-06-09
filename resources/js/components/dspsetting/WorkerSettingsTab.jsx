const BTN = {
  fontSize: 13, padding: '3px 8px', border: '1px solid #d1d5db',
  borderRadius: 4, cursor: 'pointer', background: '#f9fafb', flexShrink: 0,
};

export default function WorkerSettingsTab({
  duration,
  setDuration,
  sycolor,
  setSycolor,
  sygroup,
  setSygroup,
  syteamlist,
  setSyteamlist,
  sytasklist,
  setSytasklist,
  teamFilter,
  setTeamFilter,
  teamList,
  tasks,
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
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#374151', flexShrink: 0 }}>製造部署</span>
        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
          {[[-1, '全て'], [1, '1部'], [2, '2部'], [3, '3部']].map(([val, label], idx, arr) => {
            const v = val === -1 ? 0 : val;
            const active = sygroup === v;
            return (
              <button
                key={val}
                type="button"
                onClick={() => setSygroup(v)}
                style={{
                  padding: '4px 14px', border: 'none',
                  borderRight: idx < arr.length - 1 ? '1px solid #d1d5db' : 'none',
                  background: active ? '#2563eb' : '#fff',
                  color: active ? '#fff' : '#374151',
                  fontSize: 13, cursor: 'pointer', fontWeight: active ? 600 : 400,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >{label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden', minHeight: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>チームリスト</div>
          <input
            placeholder="チーム名で絞り込み"
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13, flexShrink: 0 }}
          />
          <button onClick={() => setSyteamlist(teamList.map(t => t.teamId))} style={{ ...BTN, width: '100%' }}>全選択</button>
          <select
            multiple
            value={syteamlist.map(String)}
            onChange={e => setSyteamlist([...e.target.selectedOptions].map(o => Number(o.value)))}
            style={{ flex: 1, width: '100%', minHeight: 0, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, padding: '2px 0' }}
          >
            {teamList.map(t => (
              <option key={t.teamId} value={t.teamId}>{t.teamName}（{t.count}人）</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>表示タスクリスト</div>
          <button onClick={() => setSytasklist(tasks.map(t => t.taskId))} style={{ ...BTN, width: '100%' }}>全選択</button>
          <select
            multiple
            value={sytasklist.map(String)}
            onChange={e => setSytasklist([...e.target.selectedOptions].map(o => Number(o.value)))}
            style={{ flex: 1, width: '100%', minHeight: 0, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, padding: '2px 0' }}
          >
            {tasks.map(t => (
              <option key={t.taskId} value={t.taskId}>{t.taskName}</option>
            ))}
          </select>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0, flexShrink: 0 }}>未選択の場合は全タスクを表示します</p>
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
              <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>タスク表示色</span>
              <select
                value={sycolor}
                onChange={e => setSycolor(Number(e.target.value))}
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
              [sboption,      e => setSboption(e.target.checked),      '完了製品も表示'],
              [synobody,      e => setSynobody(e.target.checked),      '社員未定も表示'],
              [sbdspplplan,   e => setSbdspplplan(e.target.checked),   '場所予定も表示'],
              [sbdspdate,     e => setSbdspdate(e.target.checked),     '出荷日を表示'],
              [sbdspincharge, e => setSbdspincharge(e.target.checked), '責任者を表示'],
              [flgsyoyo,      e => setFlgsyoyo(e.target.checked),      '所要日連動を表示'],
              [flgukeoi,      e => setFlgukeoi(e.target.checked),      '請負発注状態を表示'],
              [flgkeppin,     e => setFlgkeppin(e.target.checked),     '部品欠品状態を表示'],
              [flggoso,       e => setFlggoso(e.target.checked),       '後送有無を表示'],
              [flgdiff,       e => setFlgdiff(e.target.checked),       '当日変更状態を表示'],
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
