import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SpreadsheetGrid from './SpreadsheetGrid';
import DisplaySettingsDrawer from './DisplaySettingsDrawer';
import { apiArray, apiJson } from '../lib/api';
import GridNavBar from './GridNavBar';
import GridTabBar from './GridTabBar';
import GridTabPane from './GridTabPane';
import AlertToast from './AlertToast';
import UnsavedChangesDialog from './UnsavedChangesDialog';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function displaySettingsCookieName(user) {
  return `active_display_setting_no_${encodeURIComponent(user?.email || 'default')}`;
}

function pickDisplaySettings(apiPayload, activeNo) {
  const list = apiPayload.settingsList || [];
  // cookie 値は文字列で来るので数値に変換。未設定時は 0 番スロットを使用
  const no = activeNo !== null && activeNo !== undefined && activeNo !== '' ? Number(activeNo) : 0;
  const active = list.find(item => item.settingNo === no)
    ?? list.find(item => item.settingNo === apiPayload.settingNo)
    ?? list[0];
  if (!active) return apiPayload;
  const settingNo = active.settingNo;
  const settingName = active.settingName;
  return {
    ...apiPayload,
    ...active.settings,
    settingNo,
    settingName,
    settingsList: list.map(item => ({ ...item, isActive: item.settingNo === settingNo })),
  };
}

export default function SpreadsheetGridClient({ user, onLogout }) {
  const [tab, setTab] = useState('device');
  const [serials, setSerials] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [locations, setLocations] = useState([]);
  const [displaySettings, setDisplaySettings] = useState({
    settingNo: 0,
    settingName: '表示設定1',
    duration: 1,
    flgdiff: false, flgkeppin: false, flgsyoyo: false, flgukeoi: false,
    pllocation: 3, plslace: 1,
    sbcolor: 0, sbdspdate: false, sbdspincharge: false, sbdspplplan: false, flggoso: false,
    sboption: 0, synobody: false, sborder: 0, sbsbmb: 0, sbslace: 1, sbequiptype: -1,
    flgsyoyo: false, flgukeoi: false, flgkeppin: false, flgdiff: false,
    sbinchargelist: [], sbmodellist: [], sbstatuslist: [], sbszgrouplist: [],
    sycolor: 0, sygroup: 0, syslace: 1, syteamlist: [], sytasklist: [],
    tksbmb: 0, tkslace: 1, tktasklist: [],
  });
  const [displaySettingsList, setDisplaySettingsList] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loadedMasters, setLoadedMasters] = useState({ serials: false, workers: false, tasks: false, locations: false });
  const [seeding, setSeeding] = useState(false);
  const [jumpTarget, setJumpTarget] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);

  // 各タブの現在の表示期間（SpreadsheetGrid から onRangeChange で随時更新）
  const deviceRangeRef = useRef(null);
  const workerRangeRef = useRef(null);

  // 各グリッドへの imperative ハンドル（保存・キャンセル用）
  const deviceGridRef   = useRef(null);
  const workerGridRef   = useRef(null);
  const locationGridRef = useRef(null);
  const taskGridRef     = useRef(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  const locationRangeRef = useRef(null);
  const taskRangeRef     = useRef(null);
  const alertTimerRef = useRef(null);
  const prevTabRef = useRef('device');

  const masterRequirements = useMemo(() => ({
    device: ['serials'],
    worker: ['workers'],
    task: ['tasks'],
    location: ['locations'],
  }), []);

  const hasMastersForMode = useCallback((mode) => (
    (masterRequirements[mode] || []).every(key => loadedMasters[key])
  ), [loadedMasters, masterRequirements]);

  const ensureMasters = useCallback(async (keys) => {
    const dataByKey = { serials, workers, tasks, locations };
    const missing = keys.filter(key => !loadedMasters[key]);
    if (missing.length === 0) return dataByKey;

    const entries = await Promise.all(missing.map(async (key) => {
      if (key === 'serials') return [key, await apiArray('/serial')];
      if (key === 'workers') return [key, await apiArray('/worker')];
      if (key === 'tasks') return [key, await apiArray('/task')];
      if (key === 'locations') return [key, await apiArray('/location')];
      throw new Error(`Unknown master key: ${key}`);
    }));

    for (const [key, data] of entries) {
      dataByKey[key] = data;
      if (key === 'serials') setSerials(data);
      else if (key === 'workers') setWorkers(data);
      else if (key === 'tasks') setTasks(data);
      else if (key === 'locations') setLocations(data);
    }

    setLoadedMasters(prev => ({
      ...prev,
      ...Object.fromEntries(entries.map(([key]) => [key, true])),
    }));
    return dataByKey;
  }, [loadedMasters, locations, serials, tasks, workers]);

  const ensureMastersForMode = useCallback((mode) => (
    ensureMasters(masterRequirements[mode] || [])
  ), [ensureMasters, masterRequirements]);

  const reloadDisplaySettings = useCallback(async () => {
    const ds = await apiJson('/display-settings');
    const activeNo = getCookie(displaySettingsCookieName(user));
    const picked = pickDisplaySettings(ds, activeNo);
    setDisplaySettings(picked);
    setDisplaySettingsList(picked.settingsList || []);
    setSettingsLoaded(true);
  }, [user]);

  useEffect(() => {
    reloadDisplaySettings().catch(() => setSettingsLoaded(true));
  }, [reloadDisplaySettings]);

  useEffect(() => {
    if (!settingsLoaded) return;
    ensureMastersForMode(tab).catch(() => showAlert('マスタデータの取得に失敗しました'));
  }, [settingsLoaded, tab, ensureMastersForMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    await apiJson('/logout', { method: 'POST' });
    onLogout();
  }

  function showAlert(msg) {
    setAlertMessage(msg);
    clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => setAlertMessage(null), 4000);
  }

  async function handleSave() {
    const activeGridRef = tab === 'device' ? deviceGridRef : tab === 'worker' ? workerGridRef : tab === 'location' ? locationGridRef : taskGridRef;
    await activeGridRef.current?.saveChanges();
    setIsDirty(false);
  }

  async function handleCancel() {
    const activeGridRef = tab === 'device' ? deviceGridRef : tab === 'worker' ? workerGridRef : tab === 'location' ? locationGridRef : taskGridRef;
    await activeGridRef.current?.cancelChanges();
    setIsDirty(false);
  }

  async function handleSeedMaster() {
    if (!window.confirm('既存のマスタと予定を削除して初期データを生成します。実行しますか？')) return;
    setSeeding(true);
    try {
      await apiJson('/seed/master', { method: 'POST', body: JSON.stringify({}) });
      setSerials([]);
      setWorkers([]);
      setTasks([]);
      setLocations([]);
      setLoadedMasters({ serials: false, workers: false, tasks: false, locations: false });
      await reloadDisplaySettings();
      await handleCancel();
      showAlert('初期データを生成しました');
    } catch (e) {
      showAlert('初期データ生成に失敗しました');
    } finally {
      setSeeding(false);
    }
  }

  async function handleSeedPlans() {
    setSeeding(true);
    try {
      await apiJson('/seed/plans', { method: 'POST', body: JSON.stringify({}) });
      await handleCancel();
      showAlert('予定データを生成しました');
    } catch (e) {
      showAlert('予定データ生成に失敗しました');
    } finally {
      setSeeding(false);
    }
  }

  function handleTabChange(nextTab) {
    if (isDirty) {
      setPendingTab(nextTab);
      return;
    }
    setTab(nextTab);
  }

  async function handleConfirmSave() {
    await handleSave();
    setTab(pendingTab);
    setPendingTab(null);
  }

  async function handleConfirmDiscard() {
    await handleCancel();
    setTab(pendingTab);
    setPendingTab(null);
  }

  async function saveDisplaySettings(settings, drawerTab) {
    setShowSettings(false);
    setCookie(displaySettingsCookieName(user), settings.settingNo);
    setDisplaySettings(settings);
    setDisplaySettingsList(prev => {
      const base = prev.length ? prev : (settings.settingsList || []);
      return base.map(item =>
        item.settingNo === settings.settingNo
          ? { ...item, settingName: settings.settingName, settings, isActive: true }
          : { ...item, isActive: false }
      );
    });
    // 適用したドロワータブのグリッドに切り替える
    if (drawerTab === 'device') setTab('device');
    else if (drawerTab === 'worker') setTab('worker');
    else if (drawerTab === 'task') setTab('task');
    try {
      await apiJson('/display-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }).then(saved => {
        const picked = pickDisplaySettings(saved, settings.settingNo);
        setDisplaySettings(picked);
        setDisplaySettingsList(picked.settingsList || []);
      });
    } catch {
      showAlert('表示設定の保存に失敗しました。画面には適用済みです');
    }
  }

  const handleJumpToOtherTab = useCallback(async (plan, targetMode) => {
    const sbmodellist = displaySettings.sbmodellist || [];
    const syteamlist  = displaySettings.syteamlist  || [];

    // ① 表示設定チェック（機種 / 担当者が表示対象か）
    if (targetMode === 'device') {
      const { serials: loadedSerials } = await ensureMasters(['serials']);
      const serial = loadedSerials.find(s => s.serialId === plan.serialId);
      if (!serial) {
        showAlert('表示対象データがありませんでした');
        return;
      }
      if (sbmodellist.length > 0 && !sbmodellist.includes(Number(serial.kisyuId))) {
        showAlert('表示対象データがありませんでした（表示設定で非表示の機種です）');
        return;
      }
    } else {
      const { workers: loadedWorkers } = await ensureMasters(['workers']);
      const worker = loadedWorkers.find(w => w.workerId === plan.workerId);
      if (!worker) {
        showAlert('表示対象データがありませんでした');
        return;
      }
      if (syteamlist.length > 0 && !syteamlist.includes(worker.teamId)) {
        showAlert('表示対象データがありませんでした（表示設定で非表示のチームです）');
        return;
      }
    }

    // ② 表示期間チェック（遷移先タブの表示範囲内か）
    const targetRange = targetMode === 'device' ? deviceRangeRef.current : workerRangeRef.current;
    if (targetRange) {
      const planStart = plan.startDate.slice(0, 10);
      const planEnd   = plan.endDate.slice(0, 10);
      // 予定が遷移先の表示期間と重なるか（startDate <= planEnd かつ endDate >= planStart）
      if (planEnd < targetRange.startDate || planStart > targetRange.endDate) {
        showAlert('表示対象データがありませんでした（遷移先の表示期間外です）');
        return;
      }
    }

    prevTabRef.current = tab;
    setTab(targetMode);
    setJumpTarget({ plan, targetMode });
  }, [ensureMasters, displaySettings, tab]);

  const handleJumpHandled = useCallback(() => setJumpTarget(null), []);

  const handleJumpError = useCallback(() => {
    setJumpTarget(null);
    setTab(prevTabRef.current);
    showAlert('表示対象データがありませんでした');
  }, []);

  if (!settingsLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#6b7280' }}>
        読み込み中...
      </div>
    );
  }

  const gridProps = {
    serials, workers, tasks, locations, displaySettings,
    onJumpToOtherTab: handleJumpToOtherTab,
    onEnsureMasters: ensureMasters,
    onJumpHandled: handleJumpHandled,
    onJumpError: handleJumpError,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <GridNavBar
        onOpenSettings={() => setShowSettings(true)}
        onSeedMaster={handleSeedMaster}
        onSeedPlans={handleSeedPlans}
        seeding={seeding}
        userName={user?.name}
        onLogout={handleLogout}
      />
      <GridTabBar
        tab={tab}
        setTab={handleTabChange}
        isDirty={isDirty}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      {/* グリッド — 全タブを常時マウントし visibility で切り替え。スクロール位置を保持する */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* アクティブタブのマスター未ロード中はオーバーレイで「読み込み中」を表示 */}
        {!hasMastersForMode(tab) && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#6b7280', background: '#fff',
          }}>
            読み込み中...
          </div>
        )}

        <GridTabPane active={tab === 'device'}>
          <SpreadsheetGrid
            {...gridProps}
            active={tab === 'device'}
            ref={deviceGridRef}
            mode="device"
            jumpTarget={tab === 'device' ? jumpTarget : null}
            onRangeChange={r => { deviceRangeRef.current = r; }}
            onDirtyChange={dirty => setIsDirty(prev => dirty || prev)}
          />
        </GridTabPane>

        <GridTabPane active={tab === 'worker'}>
          <SpreadsheetGrid
            {...gridProps}
            active={tab === 'worker'}
            ref={workerGridRef}
            mode="worker"
            jumpTarget={tab === 'worker' ? jumpTarget : null}
            onRangeChange={r => { workerRangeRef.current = r; }}
            onDirtyChange={dirty => setIsDirty(prev => dirty || prev)}
          />
        </GridTabPane>

        <GridTabPane active={tab === 'location'}>
          <SpreadsheetGrid
            {...gridProps}
            active={tab === 'location'}
            ref={locationGridRef}
            mode="location"
            jumpTarget={null}
            onRangeChange={r => { locationRangeRef.current = r; }}
            onDirtyChange={dirty => setIsDirty(prev => dirty || prev)}
          />
        </GridTabPane>

        <GridTabPane active={tab === 'task'}>
          <SpreadsheetGrid
            {...gridProps}
            active={tab === 'task'}
            ref={taskGridRef}
            mode="task"
            jumpTarget={null}
            onRangeChange={r => { taskRangeRef.current = r; }}
            onDirtyChange={dirty => setIsDirty(prev => dirty || prev)}
          />
        </GridTabPane>

        <AlertToast message={alertMessage} onClose={() => setAlertMessage(null)} />

        {/* 未保存変更ありタブ切り替え確認ダイアログ */}
        {pendingTab !== null && (
          <UnsavedChangesDialog
            onSave={handleConfirmSave}
            onDiscard={handleConfirmDiscard}
            onClose={() => setPendingTab(null)}
          />
        )}
      </div>

      <DisplaySettingsDrawer
        open={showSettings}
        onClose={() => setShowSettings(false)}
        activeTab={tab}
        serials={serials}
        workers={workers}
        tasks={tasks}
        settings={displaySettings}
        settingsList={displaySettingsList}
        onEnsureMasters={ensureMasters}
        onSave={saveDisplaySettings}
      />
    </div>
  );
}
