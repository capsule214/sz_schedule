import { useState, useEffect, useMemo } from 'react';
import DisplaySettingsSlotPicker from './DisplaySettingsSlotPicker';
import DeviceSettingsTab from './dspsetting/DeviceSettingsTab';
import TaskSettingsTab from './dspsetting/TaskSettingsTab';
import WorkerSettingsTab from './dspsetting/WorkerSettingsTab';


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

          {tab === 'device' && (
            <DeviceSettingsTab
              duration={duration}
              setDuration={setDuration}
              sborder={sborder}
              setSborder={setSborder}
              sbcolor={sbcolor}
              setSbcolor={setSbcolor}
              sbsbmb={sbsbmb}
              setSbsbmb={setSbsbmb}
              sbequiptype={sbequiptype}
              setSbequiptype={setSbequiptype}
              sbstatuslist={sbstatuslist}
              setSbstatuslist={setSbstatuslist}
              sbinchargelist={sbinchargelist}
              setSbinchargelist={setSbinchargelist}
              sbinchargeInput={sbinchargeInput}
              setSbinchargeInput={setSbinchargeInput}
              sbszgrouplist={sbszgrouplist}
              setSbszgrouplist={setSbszgrouplist}
              sbmodellist={sbmodellist}
              setSbmodellist={setSbmodellist}
              sboption={sboption}
              setSboption={setSboption}
              synobody={synobody}
              setSynobody={setSynobody}
              sbdspplplan={sbdspplplan}
              setSbdspplplan={setSbdspplplan}
              sbdspdate={sbdspdate}
              setSbdspdate={setSbdspdate}
              sbdspincharge={sbdspincharge}
              setSbdspincharge={setSbdspincharge}
              flgsyoyo={flgsyoyo}
              setFlgsyoyo={setFlgsyoyo}
              flgukeoi={flgukeoi}
              setFlgukeoi={setFlgukeoi}
              flgkeppin={flgkeppin}
              setFlgkeppin={setFlgkeppin}
              flggoso={flggoso}
              setFlggoso={setFlggoso}
              flgdiff={flgdiff}
              setFlgdiff={setFlgdiff}
              kisyuList={kisyuList}
            />
          )}

          {tab === 'worker' && (
            <WorkerSettingsTab
              duration={duration}
              setDuration={setDuration}
              sycolor={sycolor}
              setSycolor={setSycolor}
              sygroup={sygroup}
              setSygroup={setSygroup}
              syteamlist={syteamlist}
              setSyteamlist={setSyteamlist}
              sytasklist={sytasklist}
              setSytasklist={setSytasklist}
              teamFilter={teamFilter}
              setTeamFilter={setTeamFilter}
              teamList={teamList}
              tasks={tasks}
              sboption={sboption}
              setSboption={setSboption}
              synobody={synobody}
              setSynobody={setSynobody}
              sbdspplplan={sbdspplplan}
              setSbdspplplan={setSbdspplplan}
              sbdspdate={sbdspdate}
              setSbdspdate={setSbdspdate}
              sbdspincharge={sbdspincharge}
              setSbdspincharge={setSbdspincharge}
              flgsyoyo={flgsyoyo}
              setFlgsyoyo={setFlgsyoyo}
              flgukeoi={flgukeoi}
              setFlgukeoi={setFlgukeoi}
              flgkeppin={flgkeppin}
              setFlgkeppin={setFlgkeppin}
              flggoso={flggoso}
              setFlggoso={setFlggoso}
              flgdiff={flgdiff}
              setFlgdiff={setFlgdiff}
            />
          )}

          {tab === 'task' && (
            <TaskSettingsTab
              duration={duration}
              setDuration={setDuration}
              sycolor={sycolor}
              setSycolor={setSycolor}
              tksbmb={tksbmb}
              setTksbmb={setTksbmb}
              tktasklist={tktasklist}
              setTktasklist={setTktasklist}
              tasks={tasks}
              sboption={sboption}
              setSboption={setSboption}
              synobody={synobody}
              setSynobody={setSynobody}
              sbdspplplan={sbdspplplan}
              setSbdspplplan={setSbdspplplan}
              sbdspdate={sbdspdate}
              setSbdspdate={setSbdspdate}
              sbdspincharge={sbdspincharge}
              setSbdspincharge={setSbdspincharge}
              flgsyoyo={flgsyoyo}
              setFlgsyoyo={setFlgsyoyo}
              flgukeoi={flgukeoi}
              setFlgukeoi={setFlgukeoi}
              flgkeppin={flgkeppin}
              setFlgkeppin={setFlgkeppin}
              flggoso={flggoso}
              setFlggoso={setFlggoso}
              flgdiff={flgdiff}
              setFlgdiff={setFlgdiff}
            />
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
