import { useState, useEffect, useCallback, useRef } from 'react';
import SpreadsheetGrid from './SpreadsheetGrid';
import DisplaySettingsDrawer from './DisplaySettingsDrawer';
import { apiArray, apiJson } from '../lib/api';
import GridNavBar from './GridNavBar';
import GridTabBar from './GridTabBar';
import GridTabPane from './GridTabPane';
import AlertToast from './AlertToast';

export default function SpreadsheetGridClient({ user, onLogout }) {
  const [tab, setTab] = useState('device');
  const [serials, setSerials] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [locations, setLocations] = useState([]);
  const [displaySettings, setDisplaySettings] = useState({ selectedKisyuIds: [], selectedTeamIds: [], selectedTaskIds: [], selectedTaskTabIds: [], showLocationInDevice: false, showUnassignedWorker: false, showShippingDateInDevice: false, showResponsibleInDevice: false });
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
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

  const reloadMasterData = useCallback(async () => {
    const [s, w, t, ds, loc] = await Promise.all([
      apiArray('/serial'),
      apiArray('/worker'),
      apiArray('/task'),
      apiJson('/display-settings'),
      apiArray('/location'),
    ]);
    setSerials(s);
    setWorkers(w);
    setTasks(t);
    setDisplaySettings(ds);
    setLocations(loc);
  }, []);

  useEffect(() => {
    reloadMasterData().then(() => {
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [reloadMasterData]);

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
    await Promise.all([
      deviceGridRef.current?.saveChanges(),
      workerGridRef.current?.saveChanges(),
      locationGridRef.current?.saveChanges(),
      taskGridRef.current?.saveChanges(),
    ]);
    setIsDirty(false);
  }

  async function handleCancel() {
    await Promise.all([
      deviceGridRef.current?.cancelChanges(),
      workerGridRef.current?.cancelChanges(),
      locationGridRef.current?.cancelChanges(),
      taskGridRef.current?.cancelChanges(),
    ]);
    setIsDirty(false);
  }

  async function handleSeedMaster() {
    if (!window.confirm('既存のマスタと予定を削除して初期データを生成します。実行しますか？')) return;
    setSeeding(true);
    try {
      await apiJson('/seed/master', { method: 'POST', body: JSON.stringify({}) });
      await reloadMasterData();
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
    setDisplaySettings(settings);
    // 適用したドロワータブのグリッドに切り替える
    if (drawerTab === 'device') setTab('device');
    else if (drawerTab === 'worker') setTab('worker');
    else if (drawerTab === 'task') setTab('task');
    await apiJson('/display-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  const handleJumpToOtherTab = useCallback((plan, targetMode) => {
    const { selectedKisyuIds = [], selectedTeamIds = [] } = displaySettings;

    // ① 表示設定チェック（機種 / 担当者が表示対象か）
    if (targetMode === 'device') {
      const serial = serials.find(s => s.serialId === plan.serialId);
      if (!serial) {
        showAlert('表示対象データがありませんでした');
        return;
      }
      if (selectedKisyuIds.length > 0 && !selectedKisyuIds.includes(String(serial.kisyuId))) {
        showAlert('表示対象データがありませんでした（表示設定で非表示の機種です）');
        return;
      }
    } else {
      const worker = workers.find(w => w.workerId === plan.workerId);
      if (!worker) {
        showAlert('表示対象データがありませんでした');
        return;
      }
      if (selectedTeamIds.length > 0 && !selectedTeamIds.includes(worker.teamId)) {
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
  }, [serials, workers, displaySettings, tab]);

  const handleJumpHandled = useCallback(() => setJumpTarget(null), []);

  const handleJumpError = useCallback(() => {
    setJumpTarget(null);
    setTab(prevTabRef.current);
    showAlert('表示対象データがありませんでした');
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#6b7280' }}>
        読み込み中...
      </div>
    );
  }

  const gridProps = {
    serials, workers, tasks, locations, displaySettings,
    onJumpToOtherTab: handleJumpToOtherTab,
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

      {/* グリッド — 両タブ常時マウント。visibility で表示/非表示を切り替え */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}>
            <div style={{
              background: '#fff', borderRadius: 10, padding: '28px 32px', width: 360,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>未保存の変更があります</div>
              <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
                タブを切り替える前に、変更内容を保存するか破棄してください。
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={handleConfirmSave} style={{
                  padding: '9px 0', border: 'none', borderRadius: 6,
                  background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                  保存してタブを切り替え
                </button>
                <button onClick={handleConfirmDiscard} style={{
                  padding: '9px 0', border: '1px solid #f87171', borderRadius: 6,
                  background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 13,
                }}>
                  変更を破棄してタブを切り替え
                </button>
                <button onClick={() => setPendingTab(null)} style={{
                  padding: '9px 0', border: '1px solid #d1d5db', borderRadius: 6,
                  background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13,
                }}>
                  閉じる
                </button>
              </div>
            </div>
          </div>
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
        onSave={saveDisplaySettings}
      />
    </div>
  );
}
