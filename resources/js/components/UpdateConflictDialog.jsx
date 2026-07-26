export default function UpdateConflictDialog({
  onOverwrite,
  onSkip,
  onCancel,
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, padding: '28px 32px', width: 420,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>更新の競合があります</div>
        <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
          更新対象の予定に他のユーザによって更新された予定があります。上書きして保存しますか？
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onOverwrite} style={{
            padding: '9px 0', border: 'none', borderRadius: 6,
            background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            上書き保存する
          </button>
          <button onClick={onSkip} style={{
            padding: '9px 0', border: '1px solid #2563eb', borderRadius: 6,
            background: '#fff', color: '#1d4ed8', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            上書きせず保存する
          </button>
          <button onClick={onCancel} style={{
            padding: '9px 0', border: '1px solid #d1d5db', borderRadius: 6,
            background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13,
          }}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
