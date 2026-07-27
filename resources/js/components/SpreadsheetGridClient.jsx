import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SpreadsheetGrid from './SpreadsheetGrid';
import DisplaySettingsDrawer from './DisplaySettingsDrawer';
import { apiArray, apiJson } from '../lib/api';
import { loadKisyuMaster } from '../lib/kisyuMaster';
import { loadTeamMaster } from '../lib/teamMaster';
import { loadTaskMaster } from '../lib/taskMaster';
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

const GRID_TABS = ['device', 'worker', 'place', 'task'];

function displaySettingsCookieName(user) {
  return `active_display_setting_no_${encodeURIComponent(user?.email || 'default')}`;
}

function activeTabCookieName(user) {
  return `active_grid_tab_${encodeURIComponent(user?.email || 'default')}`;
}

function loadActiveTab(user) {
  const saved = getCookie(activeTabCookieName(user));
  return GRID_TABS.includes(saved) ? saved : 'device';
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
  const [tab, setTab] = useState(() => loadActiveTab(user));
  const [serials, setSerials] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [resources, setResources] = useState([]);
  // 表示設定の機種リスト・チームリストはマスタ API から取得する（serials/workers の集計に依存しない）
  const [kisyus, setKisyus] = useState([]);
  const [teams, setTeams] = useState([]);
  const [dprMachines, setDprMachines] = useState([]);
  const [dprSalesLocations, setDprSalesLocations] = useState([]);
  const [dprPublicationYears, setDprPublicationYears] = useState([]);
  const [displaySettings, setDisplaySettings] = useState({
    settingNo: 0,
    settingName: '表示設定1',
    duration: 1,
    flgdiff: false, flgkeppin: false, flgsyoyo: false, flgukeoi: false,
    pllocation: 3, plscale: 1,
    sbcolor: 0, sbdspdate: false, sbdspincharge: false, sbdspplplan: false, flggoso: false,
    sboption: 0, synobody: false, sborder: 0, sbsbmb: 0, sbscale: 1, sbequiptype: -1,
    flgsyoyo: false, flgukeoi: false, flgkeppin: false, flgdiff: false,
    sbinchargelist: [], sbmodellist: [], sbstatuslist: [], sbszgrouplist: [],
    sycolor: 0, sygroup: 0, syscale: 1, syteamlist: [], sytasklist: [],
    tksbmb: 0, tkscale: 1, tktasklist: [],
  });
  const [displaySettingsList, setDisplaySettingsList] = useState([]);
  const [displaySettingsApplyVersion, setDisplaySettingsApplyVersion] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingSettingsOpen, setPendingSettingsOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loadedMasters, setLoadedMasters] = useState({ serials: false, workers: false, tasks: false, resources: false, kisyus: false, teams: false, dprMachines: false, dprSalesLocations: false, dprPublicationYears: false });
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
  const [isSaving, setIsSaving] = useState(false);
  const savingPromiseRef = useRef(null);
  const [pendingTab, setPendingTab] = useState(null);
  const [pendingRedrawAction, setPendingRedrawAction] = useState(null);
  const redrawPromptOpenRef = useRef(false);
  const [historyState, setHistoryState] = useState({
    device: { canUndo: false, canRedo: false },
    worker: { canUndo: false, canRedo: false },
    place: { canUndo: false, canRedo: false },
    task: { canUndo: false, canRedo: false },
  });

  const locationRangeRef = useRef(null);
  const taskRangeRef     = useRef(null);
  const alertTimerRef = useRef(null);
  const prevTabRef = useRef('device');

  const masterRequirements = useMemo(() => ({
    device: [],
    worker: ['workers'],
    task: ['tasks'],
    place: ['resources'],
  }), []);

  const hasMastersForMode = useCallback((mode) => (
    (masterRequirements[mode] || []).every(key => loadedMasters[key])
  ), [loadedMasters, masterRequirements]);

  useEffect(() => {
    setCookie(activeTabCookieName(user), tab);
  }, [tab, user]);

  const ensureMasters = useCallback(async (keys) => {
    const dataByKey = { serials, workers, tasks, resources, kisyus, teams, dprMachines, dprSalesLocations, dprPublicationYears };
    const missing = keys.filter(key => !loadedMasters[key]);
    if (missing.length === 0) return dataByKey;

    const entries = await Promise.all(missing.map(async (key) => {
      if (key === 'serials') return [key, await apiArray('/serial')];
      if (key === 'workers') return [key, await apiArray('/worker')];
      if (key === 'tasks') return [key, await loadTaskMaster()];
      if (key === 'resources') return [key, await apiArray('/resource')];
      if (key === 'kisyus') return [key, await loadKisyuMaster()];
      if (key === 'teams') return [key, await loadTeamMaster()];
      if (key === 'dprMachines') return [key, await apiArray('/dpr/machines')];
      if (key === 'dprSalesLocations') return [key, await apiArray('/dpr/locations')];
      if (key === 'dprPublicationYears') return [key, await apiArray('/dpr/years')];
      throw new Error(`Unknown master key: ${key}`);
    }));

    for (const [key, data] of entries) {
      dataByKey[key] = data;
      if (key === 'serials') setSerials(data);
      else if (key === 'workers') setWorkers(data);
      else if (key === 'tasks') setTasks(data);
      else if (key === 'resources') setResources(data);
      else if (key === 'kisyus') setKisyus(data);
      else if (key === 'teams') setTeams(data);
      else if (key === 'dprMachines') setDprMachines(data);
      else if (key === 'dprSalesLocations') setDprSalesLocations(data);
      else if (key === 'dprPublicationYears') setDprPublicationYears(data);
    }

    setLoadedMasters(prev => ({
      ...prev,
      ...Object.fromEntries(entries.map(([key]) => [key, true])),
    }));
    return dataByKey;
  }, [loadedMasters, resources, serials, tasks, workers, kisyus, teams]);

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

  function handleSave() {
    if (savingPromiseRef.current) return savingPromiseRef.current;
    const targetGridRef = tab === 'device' ? deviceGridRef : tab === 'worker' ? workerGridRef : tab === 'place' ? locationGridRef : taskGridRef;
    const promise = (async () => {
      setIsSaving(true);
      try {
        return await targetGridRef.current?.saveChanges();
      } finally {
        savingPromiseRef.current = null;
        setIsSaving(false);
      }
    })();
    savingPromiseRef.current = promise;
    return promise;
  }

  async function handleCancel() {
    if (savingPromiseRef.current) return false;
    const activeGridRef = tab === 'device' ? deviceGridRef : tab === 'worker' ? workerGridRef : tab === 'place' ? locationGridRef : taskGridRef;
    await activeGridRef.current?.cancelChanges();
    return true;
  }

  function activeGridRef() {
    return tab === 'device' ? deviceGridRef : tab === 'worker' ? workerGridRef : tab === 'place' ? locationGridRef : taskGridRef;
  }

  function handleUndo() {
    if (savingPromiseRef.current) return;
    activeGridRef().current?.undoLastEdit?.();
  }

  function handleRedo() {
    if (savingPromiseRef.current) return;
    activeGridRef().current?.redoLastEdit?.();
  }

  async function handleSeedMaster() {
    if (!window.confirm('既存のマスタと予定を削除して初期データを生成します。実行しますか？')) return;
    setSeeding(true);
    try {
      await apiJson('/seed/master', { method: 'POST', body: JSON.stringify({}) });
      setSerials([]);
      setWorkers([]);
      setTasks([]);
      setResources([]);
      setKisyus([]);
      setTeams([]);
      setDprMachines([]);
      setDprSalesLocations([]);
      setDprPublicationYears([]);
      setLoadedMasters({ serials: false, workers: false, tasks: false, resources: false, kisyus: false, teams: false, dprMachines: false, dprSalesLocations: false, dprPublicationYears: false });
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
      const productDisplay =
        (tab === 'device' && [1, 2].includes(Number(displaySettings.sbsbmb ?? 0)))
        || (tab === 'task' && Number(displaySettings.tksbmb ?? 0) === 1)
          ? 'morder'
          : 'serial';
      await apiJson('/seed/plans', {
        method: 'POST',
        body: JSON.stringify({
          product_display: productDisplay,
        }),
      });
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

  function handleOpenSettings() {
    if (isDirty) {
      setPendingSettingsOpen(true);
      return;
    }
    setShowSettings(true);
  }

  async function handleSettingsSave() {
    const saved = await handleSave();
    if (saved === false) return;
    setPendingSettingsOpen(false);
    setShowSettings(true);
  }

  async function handleSettingsDiscard() {
    await handleCancel();
    setPendingSettingsOpen(false);
    setShowSettings(true);
  }

  async function handleConfirmSave() {
    const saved = await handleSave();
    if (saved === false) return;
    setTab(pendingTab);
    setPendingTab(null);
  }

  async function handleConfirmDiscard() {
    await handleCancel();
    setTab(pendingTab);
    setPendingTab(null);
  }

  const handleBeforeRedraw = useCallback((action) => {
    if (redrawPromptOpenRef.current) return false;
    redrawPromptOpenRef.current = true;
    setPendingRedrawAction(() => action);
    return true;
  }, []);

  async function handleRedrawSave() {
    const saved = await handleSave();
    if (saved === false) return;
    const action = pendingRedrawAction;
    redrawPromptOpenRef.current = false;
    setPendingRedrawAction(null);
    if (action) setTimeout(action, 0);
  }

  async function handleRedrawDiscard() {
    await handleCancel();
    const action = pendingRedrawAction;
    redrawPromptOpenRef.current = false;
    setPendingRedrawAction(null);
    if (action) setTimeout(action, 0);
  }

  function handleRedrawClose() {
    redrawPromptOpenRef.current = false;
    setPendingRedrawAction(null);
  }

  async function saveDisplaySettings(settings, drawerTab) {
    setShowSettings(false);
    setCookie(displaySettingsCookieName(user), settings.settingNo);
    setDisplaySettingsApplyVersion(version => version + 1);
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
    const deviceProductDisplay = Number(displaySettings.sbsbmb ?? 0);
    const planMorderOrderTypeId = Number(plan.morderOrderTypeId || 0);
    const planIsMorder = Number(plan.morderId) > 0;
    const requiredDeviceProductDisplay = planIsMorder
      ? (planMorderOrderTypeId === 11 ? 2 : 1)
      : 0;
    const useDeviceModelFilters = deviceProductDisplay === 0;
    const sbmodellist = displaySettings.sbmodellist || [];
    const syteamlist  = displaySettings.syteamlist  || [];

    // ① 表示設定チェック（機種 / 担当者が表示対象か）
    if (targetMode === 'device') {
      if (deviceProductDisplay !== requiredDeviceProductDisplay) {
        showAlert('表示対象データがありませんでした（表示設定で非表示の製品表示です）');
        return;
      }
      if (!planIsMorder) {
        // 予定自体が機種ID を持つため、製番マスタ（/serial）を全件取得する必要はない
        const kisyuId = Number(plan.kisyuId);
        if (!kisyuId) {
          showAlert('表示対象データがありませんでした');
          return;
        }
        if (useDeviceModelFilters && sbmodellist.length > 0 && !sbmodellist.includes(kisyuId)) {
          showAlert('表示対象データがありませんでした（表示設定で非表示の機種です）');
          return;
        }
      }
    } else if (targetMode === 'task') {
      const taskId = Number(plan.taskId);
      const tktasklist = displaySettings.tktasklist || [];
      if (!taskId) {
        showAlert('表示対象データがありませんでした');
        return;
      }
      if (tktasklist.length > 0 && !tktasklist.includes(taskId)) {
        showAlert('表示対象データがありませんでした（表示設定で非表示のタスクです）');
        return;
      }
    } else {
      const workerId = Number(plan.workerId);
      if (workerId > 0) {
        const { workers: loadedWorkers } = await ensureMasters(['workers']);
        const worker = loadedWorkers.find(w => w.workerId === workerId);
        if (!worker) {
          showAlert('表示対象データがありませんでした');
          return;
        }
        if (syteamlist.length > 0 && !syteamlist.includes(worker.teamId)) {
          showAlert('表示対象データがありませんでした（表示設定で非表示のチームです）');
          return;
        }
      } else if (!displaySettings.synobody) {
        showAlert('表示対象データがありませんでした（担当者未定予定が非表示です）');
        return;
      }
    }

    // ② 表示期間チェック（遷移先タブの表示範囲内か）
    const targetRange = targetMode === 'device' ? deviceRangeRef.current
      : targetMode === 'task' ? taskRangeRef.current
      : workerRangeRef.current;
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
    serials, workers, tasks, resources, displaySettings,
    displaySettingsApplyVersion,
    settingsReady: settingsLoaded,
    onJumpToOtherTab: handleJumpToOtherTab,
    onEnsureMasters: ensureMasters,
    onJumpHandled: handleJumpHandled,
    onJumpError: handleJumpError,
    onBeforeRedraw: handleBeforeRedraw,
    onHistoryChange: (mode, state) => setHistoryState(prev => ({ ...prev, [mode]: state })),
  };
  const activeHistory = historyState[tab] || { canUndo: false, canRedo: false };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <GridNavBar
        onOpenSettings={handleOpenSettings}
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
        canUndo={activeHistory.canUndo}
        canRedo={activeHistory.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isSaving={isSaving}
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
            onDirtyChange={setIsDirty}
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
            onDirtyChange={setIsDirty}
          />
        </GridTabPane>

        <GridTabPane active={tab === 'place'}>
          <SpreadsheetGrid
            {...gridProps}
            active={tab === 'place'}
            ref={locationGridRef}
            mode="place"
            jumpTarget={null}
            onRangeChange={r => { locationRangeRef.current = r; }}
            onDirtyChange={setIsDirty}
          />
        </GridTabPane>

        <GridTabPane active={tab === 'task'}>
          <SpreadsheetGrid
            {...gridProps}
            active={tab === 'task'}
            ref={taskGridRef}
            mode="task"
            jumpTarget={tab === 'task' ? jumpTarget : null}
            onRangeChange={r => { taskRangeRef.current = r; }}
            onDirtyChange={setIsDirty}
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
        {pendingRedrawAction !== null && (
          <UnsavedChangesDialog
            message="表示を更新する前に、変更内容を保存するか破棄してください。"
            saveLabel="保存して表示を更新"
            discardLabel="変更を破棄して表示を更新"
            onSave={handleRedrawSave}
            onDiscard={handleRedrawDiscard}
            onClose={handleRedrawClose}
          />
        )}
        {pendingSettingsOpen && (
          <UnsavedChangesDialog
            message="表示設定を開く前に、変更内容を保存するか破棄してください。"
            saveLabel="保存して表示設定を開く"
            discardLabel="変更を破棄して表示設定を開く"
            closeLabel="表示設定を開かない"
            onSave={handleSettingsSave}
            onDiscard={handleSettingsDiscard}
            onClose={() => setPendingSettingsOpen(false)}
          />
        )}
      </div>

      <DisplaySettingsDrawer
        open={showSettings}
        onClose={() => setShowSettings(false)}
        activeTab={tab}
        tasks={tasks}
        kisyus={kisyus}
        teams={teams}
        dprMachines={dprMachines}
        dprSalesLocations={dprSalesLocations}
        dprPublicationYears={dprPublicationYears}
        settings={displaySettings}
        settingsList={displaySettingsList}
        onEnsureMasters={ensureMasters}
        onSave={saveDisplaySettings}
      />
    </div>
  );
}
