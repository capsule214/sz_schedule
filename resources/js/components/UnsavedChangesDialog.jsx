export default function UnsavedChangesDialog({
  onSave,
  onDiscard,
  onClose,
  message = 'タブを切り替える前に、変更内容を保存するか破棄してください。',
  saveLabel = '保存してタブを切り替え',
  discardLabel = '変更を破棄してタブを切り替え',
  closeLabel = '閉じる',
}) {
  return (
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
          {message}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onSave} style={{
            padding: '9px 0', border: 'none', borderRadius: 6,
            background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            {saveLabel}
          </button>
          <button onClick={onDiscard} style={{
            padding: '9px 0', border: '1px solid #f87171', borderRadius: 6,
            background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 13,
          }}>
            {discardLabel}
          </button>
          <button onClick={onClose} style={{
            padding: '9px 0', border: '1px solid #d1d5db', borderRadius: 6,
            background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13,
          }}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
