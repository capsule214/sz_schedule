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
  const [selectedKisyuIds, setSelectedKisyuIds] = useState([]);
  const [selectedTeamIds, setSelectedTeamIds]   = useState([]);
  const [selectedTaskIds, setSelectedTaskIds]   = useState([]);
  const [showLocationInDevice,     setShowLocationInDevice]     = useState(false);
  const [showUnassignedWorker,     setShowUnassignedWorker]     = useState(false);
  const [showShippingDateInDevice, setShowShippingDateInDevice] = useState(false);
  const [showResponsibleInDevice,  setShowResponsibleInDevice]  = useState(false);
  const [selectedTaskTabIds, setSelectedTaskTabIds] = useState([]);
  const [settingNo, setSettingNo] = useState(1);
  const [settingName, setSettingName] = useState('表示設定1');
  const [kisyuFilter, setKisyuFilter] = useState('');
  const [teamFilter, setTeamFilter]   = useState('');

  const kisyuListRef  = useRef(null);
  const serialListRef = useRef(null);
  const teamListRef   = useRef(null);
  const kisyuListH  = useListHeight(kisyuListRef);
  const serialListH = useListHeight(serialListRef);
  const teamListH   = useListHeight(teamListRef);

  const normalizedSettingsList = useMemo(() => {
    const source = settingsList.length ? settingsList : (settings.settingsList || []);
    if (source.length) return source;
    return Array.from({ length: 5 }, (_, i) => ({
      settingNo: i + 1,
      settingName: `表示設定${i + 1}`,
      settings: {},
      isActive: i === 0,
    }));
  }, [settingsList, settings]);

  function applySettingsToForm(nextSettings) {
    setSelectedKisyuIds((nextSettings.selectedKisyuIds || []).map(String));
    setSelectedTeamIds(nextSettings.selectedTeamIds || []);
    setSelectedTaskIds(nextSettings.selectedTaskIds || []);
    setShowLocationInDevice(!!nextSettings.showLocationInDevice);
    setShowUnassignedWorker(!!nextSettings.showUnassignedWorker);
    setShowShippingDateInDevice(!!nextSettings.showShippingDateInDevice);
    setShowResponsibleInDevice(!!nextSettings.showResponsibleInDevice);
    setSelectedTaskTabIds(nextSettings.selectedTaskTabIds || []);
  }

  function handleSettingNoChange(nextNo) {
    const no = Number(nextNo);
    const slot = normalizedSettingsList.find(item => item.settingNo === no);
    setSettingNo(no);
    setSettingName(slot?.settingName || `表示設定${no}`);
    applySettingsToForm(slot?.settings || {});
  }

  // ドロワーが開いたら現在のグリッドタブに合わせ、設定を最新値にリセット
  useEffect(() => {
    if (!open) return;
    setTab(activeTab === 'worker' ? 'worker' : activeTab === 'task' ? 'task' : 'device');
    setSettingNo(settings.settingNo || 1);
    setSettingName(settings.settingName || `表示設定${settings.settingNo || 1}`);
    applySettingsToForm(settings);
    setKisyuFilter('');
    setTeamFilter('');
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

  // 機種グループ（kisyu）リスト
  const kisyuList = useMemo(() => {
    const map = serials.reduce((acc, s) => {
      const k = String(s.kisyuId);
      if (!acc[k]) acc[k] = { kisyuId: k, kisyuName: s.kisyuName, count: 0 };
      acc[k].count++;
      return acc;
    }, {});
    return Object.values(map)
      .filter(k => k.kisyuName.includes(kisyuFilter))
      .sort((a, b) => a.kisyuName.localeCompare(b.kisyuName, 'ja'));
  }, [serials, kisyuFilter]);

  // 機種リスト（選択中の機種グループで絞り込んだ製番）
  const filteredSerials = useMemo(() =>
    serials.filter(s => selectedKisyuIds.length === 0 || selectedKisyuIds.includes(String(s.kisyuId)))
      .sort((a, b) => a.serialNo.localeCompare(b.serialNo, 'ja', { numeric: true })),
    [serials, selectedKisyuIds]
  );

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
    setSelectedKisyuIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleTeam(id) {
    setSelectedTeamIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleTask(id) {
    setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleSave() {
    // 選択中のドロワータブも渡し、呼び出し元でグリッドタブを切り替えてもらう
    const trimmedName = settingName.trim() || `表示設定${settingNo}`;
    onSave({
      settingNo,
      settingName: trimmedName,
      settingsList: normalizedSettingsList,
      selectedKisyuIds,
      selectedTeamIds,
      selectedTaskIds,
      selectedTaskTabIds,
      showLocationInDevice,
      showUnassignedWorker,
      showShippingDateInDevice,
      showResponsibleInDevice,
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
        width: 560,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        background: '#fff',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.18)',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px 12px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>表示設定</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20, lineHeight: 1, padding: '2px 6px' }}>✕</button>
        </div>

        <DisplaySettingsSlotPicker
          settingsList={normalizedSettingsList}
          settingNo={settingNo}
          settingName={settingName}
          onSettingNoChange={handleSettingNoChange}
          onSettingNameChange={setSettingName}
        />

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
              <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden', minHeight: 0 }}>

                {/* 左：機種グループ */}
                <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>機種グループ</div>
                  <input
                    placeholder="機種名で絞り込み"
                    value={kisyuFilter}
                    onChange={e => setKisyuFilter(e.target.value)}
                    style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13, flexShrink: 0 }}
                  />
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setSelectedKisyuIds(kisyuList.map(k => k.kisyuId))} style={BTN}>全選択</button>
                    <button onClick={() => setSelectedKisyuIds([])} style={BTN}>全解除</button>
                  </div>
                  <div ref={kisyuListRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <VirtualList
                      items={kisyuList.map(k => ({ ...k, id: k.kisyuId }))}
                      height={kisyuListH}
                      renderItem={item => (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', cursor: 'pointer', height: 36 }}>
                          <input type="checkbox" checked={selectedKisyuIds.includes(item.kisyuId)} onChange={() => toggleKisyu(item.kisyuId)} />
                          <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.kisyuName}</span>
                          <span style={{ fontSize: 13, color: '#9ca3af', flexShrink: 0 }}>{item.count}台</span>
                        </label>
                      )}
                    />
                  </div>
                </div>

                {/* 右：機種リスト（プレビュー） */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>
                    機種リスト
                    <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
                      {filteredSerials.length}件
                    </span>
                  </div>
                  <div ref={serialListRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb' }}>
                    <VirtualList
                      items={filteredSerials.map(s => ({ ...s, id: s.serialId }))}
                      height={serialListH}
                      renderItem={item => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 36, borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: 13, color: '#9ca3af', flexShrink: 0, width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.kisyuName}</span>
                          <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.serialNo}</span>
                        </div>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* 追加列・場所予定チェックボックス群 */}
              <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 12, paddingTop: 10, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={showShippingDateInDevice} onChange={e => setShowShippingDateInDevice(e.target.checked)} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>出荷日(3列目)を表示</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={showResponsibleInDevice} onChange={e => setShowResponsibleInDevice(e.target.checked)} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>責任者(4列目)を表示</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', marginTop: 4, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
                  <input type="checkbox" checked={showLocationInDevice} onChange={e => setShowLocationInDevice(e.target.checked)} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>場所予定も表示</span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>（各装置下端に場所予定行を追加）</span>
                </label>
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
                <button onClick={() => setSelectedTeamIds(teamList.map(t => t.teamId))} style={BTN}>全選択</button>
                <button onClick={() => setSelectedTeamIds([])} style={BTN}>全解除</button>
              </div>
              <div ref={teamListRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <VirtualList
                  items={teamList.map(t => ({ ...t, id: t.teamId }))}
                  height={teamListH}
                  renderItem={item => (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', cursor: 'pointer', height: 36 }}>
                      <input type="checkbox" checked={selectedTeamIds.includes(item.teamId)} onChange={() => toggleTeam(item.teamId)} />
                      <span style={{ flex: 1, fontSize: 13 }}>{item.teamName}</span>
                      <span style={{ fontSize: 13, color: '#9ca3af' }}>{item.count}人</span>
                    </label>
                  )}
                />
              </div>

              {/* 担当者未定も表示 */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none',
                padding: '10px 0', borderTop: '1px solid #e5e7eb', marginTop: 12, flexShrink: 0,
              }}>
                <input type="checkbox" checked={showUnassignedWorker} onChange={e => setShowUnassignedWorker(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>担当者未定も表示</span>
                <span style={{ fontSize: 13, color: '#6b7280' }}>（担当者未定の予定を製番別に表示）</span>
              </label>

              {/* 表示タスクリスト */}
              <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 12, paddingTop: 12, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>表示タスクリスト</span>
                  <button onClick={() => setSelectedTaskIds(tasks.map(t => t.taskId))} style={BTN}>全選択</button>
                  <button onClick={() => setSelectedTaskIds([])} style={BTN}>全解除</button>
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                  {tasks.map(item => (
                    <label key={item.taskId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', cursor: 'pointer', height: 36, borderBottom: '1px solid #f3f4f6' }}>
                      <input type="checkbox" checked={selectedTaskIds.includes(item.taskId)} onChange={() => toggleTask(item.taskId)} />
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
                <button onClick={() => setSelectedTaskTabIds(tasks.map(t => t.taskId))} style={BTN}>全選択</button>
                <button onClick={() => setSelectedTaskTabIds([])} style={BTN}>全解除</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, minHeight: 0 }}>
                {tasksByProcess.map(pg => (
                  <div key={pg.processName}>
                    <div style={{ padding: '6px 10px', background: '#f3f4f6', fontSize: 13, fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 1 }}>
                      {pg.processName}
                    </div>
                    {pg.tasks.map(item => (
                      <label key={item.taskId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', cursor: 'pointer', height: 36, borderBottom: '1px solid #f3f4f6' }}>
                        <input type="checkbox" checked={selectedTaskTabIds.includes(item.taskId)} onChange={() => setSelectedTaskTabIds(prev => prev.includes(item.taskId) ? prev.filter(x => x !== item.taskId) : [...prev, item.taskId])} />
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
