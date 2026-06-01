export default function GridNavBar({
  userName,
  onOpenSettings,
  onSeedMaster,
  onSeedPlans,
  seeding,
  onLogout,
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '8px 12px', flexShrink: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>生産スケジュール</div>
      <div style={{ flex: 1 }} />
      <button
        onClick={onSeedMaster}
        disabled={seeding}
        style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: seeding ? '#f3f4f6' : '#fff', cursor: seeding ? 'default' : 'pointer', fontSize: 13, marginRight: 6 }}
      >
        初期データ生成
      </button>
      <button
        onClick={onSeedPlans}
        disabled={seeding}
        style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: seeding ? '#f3f4f6' : '#fff', cursor: seeding ? 'default' : 'pointer', fontSize: 13, marginRight: 8 }}
      >
        予定データ生成
      </button>
      <button
        onClick={onOpenSettings}
        style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"/></svg>
        表示設定
      </button>
      <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 8px' }} />
      <span style={{ fontSize: 12, color: '#6b7280' }}>{userName}</span>
      <button onClick={onLogout} style={{ marginLeft: 8, padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>ログアウト</button>
    </div>
  );
}
