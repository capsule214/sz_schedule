import { useState, useEffect, useMemo } from 'react';
import DisplaySettingsSlotPicker from './DisplaySettingsSlotPicker';
import DeviceSettingsTab from './dspsetting/DeviceSettingsTab';
import TaskSettingsTab from './dspsetting/TaskSettingsTab';
import WorkerSettingsTab from './dspsetting/WorkerSettingsTab';
import DprSettingsTab from './dspsetting/DprSettingsTab';
import { useSettingsForm } from '../lib/settingsForm';

export default function DisplaySettingsDrawer({
  open, onClose, activeTab,
  serials, workers, tasks,
  settings, settingsList = [],
  onEnsureMasters, onSave,
}) {
  // location タブはドロワーにないので device にフォールバック
  const [tab, setTab] = useState(() =>
    activeTab === 'worker' ? 'worker' : activeTab === 'task' ? 'task' : 'device',
  );

  // 設定フォーム（30 個の useState を 1 行に集約）
  const { form, setField, applySettings } = useSettingsForm(settings);

  // スロット選択肢の正規化
  const normalizedSettingsList = useMemo(() => {
    const source = settingsList.length ? settingsList : (settings.settingsList || []);
    if (source.length) return source;
    return Array.from({ length: 5 }, (_, i) => ({
      settingNo:   i,
      settingName: `表示設定${i + 1}`,
      settings:    {},
      isActive:    i === 0,
    }));
  }, [settingsList, settings]);

  // スロット切替
  function handleSettingNoChange(nextNo) {
    const no = Number(nextNo);
    const slot = normalizedSettingsList.find(item => item.settingNo === no);
    applySettings({
      ...(slot?.settings || {}),
      settingNo:   no,
      settingName: slot?.settingName || `表示設定${no + 1}`,
    });
  }

  // ドロワーが開いたら現在のグリッドタブに合わせ、設定を最新値にリセット
  useEffect(() => {
    if (!open) return;
    setTab(activeTab === 'worker' ? 'worker' : activeTab === 'task' ? 'task' : 'device');
    applySettings(settings);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // タブ切替時にマスタデータを遅延取得
  useEffect(() => {
    if (!open) return;
    const requirements = tab === 'device'
      ? ['serials']
      : tab === 'worker'
        ? ['workers', 'tasks']
        : ['tasks'];
    onEnsureMasters?.(requirements)?.catch(() => {});
  }, [open, tab, onEnsureMasters]);

  // 保存
  function handleSave() {
    const trimmedName = (form.settingName || '').trim() || `表示設定${form.settingNo + 1}`;
    onSave({
      ...form,
      settingName:   trimmedName,
      settingsList:  normalizedSettingsList,
      sboption:      form.sboption ? 1 : 0,   // DB 保存は数値
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
              settingNo={form.settingNo}
              settingName={form.settingName}
              onSettingNoChange={handleSettingNoChange}
              onSettingNameChange={name => setField('settingName', name)}
            />
          </div>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', flexShrink: 0 }}>
          {[['device', '装置'], ['worker', '担当者'], ['task', 'タスク'], ['dpr', 'DPR']].map(([key, label]) => (
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
          {tab === 'device' && <DeviceSettingsTab form={form} setField={setField} serials={serials} />}
          {tab === 'worker' && <WorkerSettingsTab form={form} setField={setField} workers={workers} tasks={tasks} />}
          {tab === 'task'   && <TaskSettingsTab   form={form} setField={setField} tasks={tasks} />}
          {tab === 'dpr'    && <DprSettingsTab    form={form} setField={setField} />}
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
