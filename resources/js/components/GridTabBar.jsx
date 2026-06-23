export default function GridTabBar({
  tab,
  setTab,
  isDirty,
  onSave,
  onCancel,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '2px solid #e5e7eb', padding: '0 12px', flexShrink: 0 }}>
      {[['device', '装置'], ['worker', '担当者'], ['task', 'タスク'], ['place', '場所']].map(([key, label]) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          style={{
            padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: tab === key ? 700 : 400, fontSize: 14,
            borderBottom: tab === key ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2, color: tab === key ? '#2563eb' : '#374151',
          }}
        >
          {label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      {isDirty && (
        <>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: canUndo ? '#fff' : '#f3f4f6', color: canUndo ? '#374151' : '#9ca3af', cursor: canUndo ? 'pointer' : 'not-allowed', fontSize: 13, marginRight: 6 }}
          >Undo</button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: canRedo ? '#fff' : '#f3f4f6', color: canRedo ? '#374151' : '#9ca3af', cursor: canRedo ? 'pointer' : 'not-allowed', fontSize: 13, marginRight: 6 }}
          >Redo</button>
          <button onClick={onSave} style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>保存</button>
          <button onClick={onCancel} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, marginLeft: 6 }}>キャンセル</button>
        </>
      )}
    </div>
  );
}
