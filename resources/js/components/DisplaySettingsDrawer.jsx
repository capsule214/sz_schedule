import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import VirtualList from './VirtualList';
import DisplaySettingsSlotPicker from './DisplaySettingsSlotPicker';

const BTN = {
  fontSize: 13, padding: '3px 8px', border: '1px solid #d1d5db',
  borderRadius: 4, cursor: 'pointer', background: '#f9fafb', flexShrink: 0,
};

function useListHeight(ref) {
  const [height, setHeight] = useState(200);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([e]) => setHeight(e.contentRect.height));
    obs.observe(ref.current);
    return () => obs.disconnect();
  });
  return height;
}

export default function DisplaySettingsDrawer({ open, onClose, activeTab, serials, workers, tasks, settings, settingsList = [], onEnsureMasters, onSave }) {
  // location タブはドロワーにないので device にフォールバック
  const [tab, setTab] = useState(() => activeTab === 'worker' ? 'worker' : activeTab === 'task' ? 'task' : 'device');
  // 装置タブ
  const [duration,      setDuration]      = useState(1);    // 表示期間（日数）
  const [sborder,       setSborder]       = useState(0);    // 0:製番順 1:着工日順 2:出荷日順
  const [sbcolor,       setSbcolor]       = useState(0);    // 0:タスクカラー 1:機種カラー
  const [sbsbmb,        setSbsbmb]        = useState(0);    // 0:製番 1:M番
  const [sbequiptype,   setSbequiptype]   = useState(-1);  // -1:全て 1:AAA 2:BBB 3:CCC
  const [sbstatuslist,   setSbstatuslist]   = useState([]); // number[] 0:試作機 1:量産機 2:生産終了機
  const [sbinchargelist, setSbinchargelist] = useState([]); // string[]
  const [sbszgrouplist,  setSbszgrouplist]  = useState([]); // number[] 1:1部 2:2部 3:3部
  const [sbmodellist,    setSbmodellist]    = useState([]); // number[]
  const [sboption,      setSboption]      = useState(false); // false=未完了のみ true=完了も表示
  const [synobody,      setSynobody]      = useState(false); // 社員未定も表示
  const [sbdspplplan,   setSbdspplplan]   = useState(false);
  const [sbdspdate,     setSbdspdate]     = useState(false);
  const [sbdspincharge, setSbdspincharge] = useState(false);
  const [flgsyoyo,      setFlgsyoyo]      = useState(false);
  const [flgukeoi,      setFlgukeoi]      = useState(false);
  const [flgkeppin,     setFlgkeppin]     = useState(false);
  const [flggoso,       setFlggoso]       = useState(false);
  const [flgdiff,       setFlgdiff]       = useState(false);
  // 担当者タブ
  const [syteamlist, setSyteamlist] = useState([]); // number[]
  const [sytasklist, setSytasklist] = useState([]); // number[]
  // タスクタブ
  const [tktasklist, setTktasklist] = useState([]); // number[]
  const [settingNo, setSettingNo] = useState(0);
  const [settingName, setSettingName] = useState('表示設定1');
  const [teamFilter,       setTeamFilter]        = useState('');
  const [sbinchargeInput,  setSbinchargeInput]   = useState(''); // タグ入力中のテキスト

  const teamListRef = useRef(null);
  const teamListH   = useListHeight(teamListRef);

  const normalizedSettingsList = useMemo(() => {
    const source = settingsList.length ? settingsList : (settings.settingsList || []);
    if (source.length) return source;
    // フォールバック: 0〜4 ベースで生成
    return Array.from({ length: 5 }, (_, i) => ({
      settingNo: i,
      settingName: `表示設定${i + 1}`,
      settings: {},
      isActive: i === 0,
    }));
  }, [settingsList, settings]);

  function applySettingsToForm(nextSettings) {
    setDuration(Math.max(1, Number(nextSettings.duration ?? 1)));
    setSborder(Number(nextSettings.sborder ?? 0));
    setSbcolor(Number(nextSettings.sbcolor ?? 0));
    setSbsbmb(Number(nextSettings.sbsbmb ?? 0));
    setSbequiptype(Number(nextSettings.sbequiptype ?? -1));
    setSbstatuslist((nextSettings.sbstatuslist || []).map(Number));
    setSbinchargelist((nextSettings.sbinchargelist || []).map(String));
    setSbszgrouplist((nextSettings.sbszgrouplist || []).map(Number));
    setSbmodellist((nextSettings.sbmodellist || []).map(Number));
    setSboption(!!nextSettings.sboption);
    setSynobody(!!nextSettings.synobody);
    setSbdspplplan(!!nextSettings.sbdspplplan);
    setSbdspdate(!!nextSettings.sbdspdate);
    setSbdspincharge(!!nextSettings.sbdspincharge);
    setFlgsyoyo(!!nextSettings.flgsyoyo);
    setFlgukeoi(!!nextSettings.flgukeoi);
    setFlgkeppin(!!nextSettings.flgkeppin);
    setFlggoso(!!nextSettings.flggoso);
    setFlgdiff(!!nextSettings.flgdiff);
    setSyteamlist((nextSettings.syteamlist || []).map(Number));
    setSytasklist((nextSettings.sytasklist || []).map(Number));
    setTktasklist((nextSettings.tktasklist || []).map(Number));
  }

  function handleSettingNoChange(nextNo) {
    const no = Number(nextNo);
    const slot = normalizedSettingsList.find(item => item.settingNo === no);
    setSettingNo(no);
    setSettingName(slot?.settingName || `表示設定${no + 1}`);
    applySettingsToForm(slot?.settings || {});
  }

  // ドロワーが開いたら現在のグリッドタブに合わせ、設定を最新値にリセット
  useEffect(() => {
    if (!open) return;
    setTab(activeTab === 'worker' ? 'worker' : activeTab === 'task' ? 'task' : 'device');
    const no = settings.settingNo ?? 0;
    setSettingNo(no);
    setSettingName(settings.settingName || `表示設定${no + 1}`);
    applySettingsToForm(settings);
    setTeamFilter('');
    setSbinchargeInput('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const requirements = tab === 'device'
      ? ['serials']
      : tab === 'worker'
        ? ['workers', 'tasks']
        : ['tasks'];
    onEnsureMasters?.(requirements)?.catch(() => {});
  }, [open, tab, onEnsureMasters]);

  // 機種リスト — 装置区分・生産状態でフィルタして kisyuId は number で管理
  const kisyuList = useMemo(() => {
    let src = serials;
    if (sbequiptype !== -1) {
      src = src.filter(s => s.equipTypeId === sbequiptype);
    }
    if (sbstatuslist.length > 0) {
      src = src.filter(s => sbstatuslist.includes(s.seizoStatus));
    }
    const map = src.reduce((acc, s) => {
      const k = Number(s.kisyuId);
      if (!acc[k]) acc[k] = { kisyuId: k, kisyuName: s.kisyuName };
      return acc;
    }, {});
    return Object.values(map)
      .sort((a, b) => a.kisyuName.localeCompare(b.kisyuName, 'ja'));
  }, [serials, sbequiptype, sbstatuslist]);

  // プロセス別タスクリスト（タスクドロワータブ用）
  const tasksByProcess = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      const key = t.processName || '(プロセス未設定)';
      if (!map[key]) map[key] = { processName: key, processSortNo: t.processSortNo || 0, tasks: [] };
      map[key].tasks.push(t);
    }
    return Object.values(map).sort((a, b) => a.processSortNo - b.processSortNo);
  }, [tasks]);

  // チームリスト
  const teamList = useMemo(() => {
    const map = workers.reduce((acc, w) => {
      if (!w.teamId) return acc;
      const k = w.teamId;
      if (!acc[k]) acc[k] = { teamId: k, teamName: w.teamName || '(未設定)', count: 0 };
      acc[k].count++;
      return acc;
    }, {});
    return Object.values(map)
      .filter(t => t.teamName.includes(teamFilter))
      .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ja'));
  }, [workers, teamFilter]);

  function toggleKisyu(id) {
    // id は number
    setSbmodellist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleTeam(id) {
    setSyteamlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleSyTask(id) {
    setSytasklist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleTkTask(id) {
    setTktasklist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleSave() {
    const trimmedName = settingName.trim() || `表示設定${settingNo + 1}`;
    onSave({
      settingNo,
      settingName: trimmedName,
      settingsList: normalizedSettingsList,
      duration,
      sborder,
      sbcolor,
      sbsbmb,
      sbequiptype,
      sbstatuslist,
      sbinchargelist,
      sbszgrouplist,
      sbmodellist,
      sboption: sboption ? 1 : 0,
      synobody,
      sbdspplplan,
      sbdspdate,
      sbdspincharge,
      flgsyoyo,
      flgukeoi,
      flgkeppin,
      flggoso,
      flgdiff,
      syteamlist,
      sytasklist,
      tktasklist,
    }, tab);
  }

  return (
    <>
      {/* バックドロップ */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 900,
          pointerEvents: open ? 'auto' : 'none',
          opacity: open ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      />

      {/* ドロワー本体 */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 700,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        background: '#fff',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.18)',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', flexShrink: 0 }}>表示設定</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <DisplaySettingsSlotPicker
              settingsList={normalizedSettingsList}
              settingNo={settingNo}
              settingName={settingName}
              onSettingNoChange={handleSettingNoChange}
              onSettingNameChange={setSettingName}
            />
          </div>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', flexShrink: 0 }}>
          {[['device', '装置'], ['worker', '担当者'], ['task', 'タスク']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '9px 22px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: tab === key ? 700 : 400, fontSize: 13,
                borderBottom: tab === key ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: -2, color: tab === key ? '#2563eb' : '#374151',
              }}
            >{label}</button>
          ))}
        </div>

        {/* コンテンツ */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px 20px 0' }}>

          {/* ── 装置タブ ── */}
          {tab === 'device' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 0 }}>

              {/* 1行目：製品表示 */}
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

              {/* 2行目：装置区分 */}
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

              {/* 3カラム横並び */}
              <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>

                {/* 左：機種セレクト */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden', minHeight: 0 }}>
                  {/* 生産状態チェックボックス */}
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

                {/* 中：工程担当絞り込み */}
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

                  {/* 装置グループ絞込 */}
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

                {/* 右：表示オプション1 ＋ 表示オプション2 */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 120 }}>

                  {/* 表示オプション1 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>表示オプション1</div>

                    {/* 表示期間 */}
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

                    {/* 表示順 */}
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

                    {/* タスク表示色 */}
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

                  {/* 表示オプション2 */}
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
          )}

          {/* ── 担当者タブ ── */}
          {tab === 'worker' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 0 }}>

              {/* チームリスト */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0, marginBottom: 6 }}>チームリスト</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginBottom: 4 }}>
                <input
                  placeholder="チーム名で絞り込み"
                  value={teamFilter}
                  onChange={e => setTeamFilter(e.target.value)}
                  style={{ flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13 }}
                />
                <button onClick={() => setSyteamlist(teamList.map(t => t.teamId))} style={BTN}>全選択</button>
                <button onClick={() => setSyteamlist([])} style={BTN}>全解除</button>
              </div>
              <div ref={teamListRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <VirtualList
                  items={teamList.map(t => ({ ...t, id: t.teamId }))}
                  height={teamListH}
                  renderItem={item => (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', cursor: 'pointer', height: 36 }}>
                      <input type="checkbox" checked={syteamlist.includes(item.teamId)} onChange={() => toggleTeam(item.teamId)} />
                      <span style={{ flex: 1, fontSize: 13 }}>{item.teamName}</span>
                      <span style={{ fontSize: 13, color: '#9ca3af' }}>{item.count}人</span>
                    </label>
                  )}
                />
              </div>

              {/* 表示タスクリスト */}
              <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 12, paddingTop: 12, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>表示タスクリスト</span>
                  <button onClick={() => setSytasklist(tasks.map(t => t.taskId))} style={BTN}>全選択</button>
                  <button onClick={() => setSytasklist([])} style={BTN}>全解除</button>
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                  {tasks.map(item => (
                    <label key={item.taskId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', cursor: 'pointer', height: 36, borderBottom: '1px solid #f3f4f6' }}>
                      <input type="checkbox" checked={sytasklist.includes(item.taskId)} onChange={() => toggleSyTask(item.taskId)} />
                      <span style={{ flex: 1, fontSize: 13 }}>{item.taskName}</span>
                    </label>
                  ))}
                </div>
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>未選択の場合は全タスクのバーを表示します</p>
              </div>
            </div>
          )}

          {/* ── タスクタブ ── */}
          {tab === 'task' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', flex: 1 }}>表示タスクリスト</span>
                <button onClick={() => setTktasklist(tasks.map(t => t.taskId))} style={BTN}>全選択</button>
                <button onClick={() => setTktasklist([])} style={BTN}>全解除</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, minHeight: 0 }}>
                {tasksByProcess.map(pg => (
                  <div key={pg.processName}>
                    <div style={{ padding: '6px 10px', background: '#f3f4f6', fontSize: 13, fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 1 }}>
                      {pg.processName}
                    </div>
                    {pg.tasks.map(item => (
                      <label key={item.taskId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', cursor: 'pointer', height: 36, borderBottom: '1px solid #f3f4f6' }}>
                        <input type="checkbox" checked={tktasklist.includes(item.taskId)} onChange={() => toggleTkTask(item.taskId)} />
                        <span style={{ flex: 1, fontSize: 13 }}>{item.taskName}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8, flexShrink: 0 }}>
                未選択の場合は全タスクを表示します
              </p>
            </div>
          )}
        </div>

        {/* フッター */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #e5e7eb', flexShrink: 0, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '7px 20px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSave} style={{ padding: '7px 20px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>適用</button>
        </div>
      </div>
    </>
  );
}
