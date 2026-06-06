import { useState, useEffect, useMemo, useCallback } from 'react';
import DisplaySettingsSlotPicker from './DisplaySettingsSlotPicker';

const BTN = {
  fontSize: 13, padding: '3px 8px', border: '1px solid #d1d5db',
  borderRadius: 4, cursor: 'pointer', background: '#f9fafb', flexShrink: 0,
};


export default function DisplaySettingsDrawer({ open, onClose, activeTab, serials, workers, tasks, settings, settingsList = [], onEnsureMasters, onSave }) {
  // location タブはドロワーにないので device にフォールバック
  const [tab, setTab] = useState(() => activeTab === 'worker' ? 'worker' : activeTab === 'task' ? 'task' : 'device');
  // 装置タブ
  const [duration,      setDuration]      = useState(1);    // 表示期間（日数）
  const [sborder,       setSborder]       = useState(0);    // 0:製番順 1:着工日順 2:出荷日順
  const [sbcolor,       setSbcolor]       = useState(0);    // 0:タスクカラー 1:機種カラー（装置タブ）
  const [sycolor,       setSycolor]       = useState(0);    // 0:タスクカラー 1:機種カラー（担当者タブ）
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
  const [sygroup,    setSygroup]    = useState(0);  // 0=全て 1=1部 2=2部 3=3部
  const [syteamlist, setSyteamlist] = useState([]); // number[]
  const [sytasklist, setSytasklist] = useState([]); // number[]
  // タスクタブ
  const [tksbmb,     setTksbmb]     = useState(0);  // 0=製番 1=M番 2=すべて
  const [tktasklist, setTktasklist] = useState([]); // number[]
  const [settingNo, setSettingNo] = useState(0);
  const [settingName, setSettingName] = useState('表示設定1');
  const [teamFilter,       setTeamFilter]        = useState('');
  const [sbinchargeInput,  setSbinchargeInput]   = useState(''); // タグ入力中のテキスト


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
    setSycolor(Number(nextSettings.sycolor ?? 0));
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
    setSygroup(Number(nextSettings.sygroup ?? 0));
    setSyteamlist((nextSettings.syteamlist || []).map(Number));
    setSytasklist((nextSettings.sytasklist || []).map(Number));
    setTksbmb(Number(nextSettings.tksbmb ?? 0));
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
    if (sbstatuslist.length === 0) {
      src = []; // 全チェックOFFのときは何も表示しない
    } else {
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

  // チームリスト（製造部署・チーム名で絞り込み）
  const teamList = useMemo(() => {
    const map = workers.reduce((acc, w) => {
      if (!w.teamId) return acc;
      // sygroup > 0 のとき製造部署で絞り込み
      if (sygroup > 0 && w.szgroupId !== sygroup) return acc;
      const k = w.teamId;
      if (!acc[k]) acc[k] = { teamId: k, teamName: w.teamName || '(未設定)', count: 0 };
      acc[k].count++;
      return acc;
    }, {});
    return Object.values(map)
      .filter(t => t.teamName.includes(teamFilter))
      .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ja'));
  }, [workers, sygroup, teamFilter]);

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
      sycolor,
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
      sygroup,
      syteamlist,
      sytasklist,
      tksbmb,
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

              {/* 1行目：製造部署 */}
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

              {/* 3カラム横並び */}
              <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>

                {/* 左：チームリスト */}
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

                {/* 中：表示タスクリスト */}
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

                    {/* タスク表示色 */}
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

                  {/* 表示オプション2 */}
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
          )}

          {/* ── タスクタブ ── */}
          {tab === 'task' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* 1行目：製品表示 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#374151', flexShrink: 0 }}>製品表示</span>
                <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
                  {[['製番', 0], ['M番', 1], ['すべて', 2]].map(([label, val], idx, arr) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTksbmb(val)}
                      style={{
                        padding: '4px 14px', border: 'none',
                        borderRight: idx < arr.length - 1 ? '1px solid #d1d5db' : 'none',
                        background: tksbmb === val ? '#2563eb' : '#fff',
                        color: tksbmb === val ? '#fff' : '#374151',
                        fontSize: 13, cursor: 'pointer', fontWeight: tksbmb === val ? 600 : 400,
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* 2カラム横並び */}
              <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>

                {/* 左：表示タスクリスト */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden', minHeight: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>表示タスクリスト</div>
                  <select
                    multiple
                    value={tktasklist.map(String)}
                    onChange={e => setTktasklist([...e.target.selectedOptions].map(o => Number(o.value)))}
                    style={{ flex: 1, width: '100%', minHeight: 0, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, padding: '2px 0' }}
                  >
                    {tasks.map(t => (
                      <option key={t.taskId} value={t.taskId}>{t.taskTypeName || '(未設定)'} | {t.processName || '(未設定)'} | {t.taskName}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0, flexShrink: 0 }}>未選択の場合は何も表示しません</p>
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
                        style={{ width: 52, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'right' }}
                      />
                      <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>ヶ月</span>
                    </div>

                    {/* タスク表示色 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>タスク表示色</span>
                      <select
                        value={sycolor}
                        onChange={e => setSycolor(Number(e.target.value))}
                        style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
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
