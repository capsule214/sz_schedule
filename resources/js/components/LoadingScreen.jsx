export default function LoadingScreen({ message = '読み込み中...', overlay = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      ...(overlay
        ? { position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(1px)' }
        : { height: '100vh', background: 'var(--ui-bg)' }),
    }}>
      <div className="ui-spinner" />
      <div style={{ fontSize: 13, color: 'var(--ui-text-sub)' }}>{message}</div>
    </div>
  );
}
