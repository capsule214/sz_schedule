import { useState } from 'react';

export default function GridNavBar({
  userName,
  onOpenSettings,
  onOpenSeparateData,
  onSeedMaster,
  onSeedPlans,
  seeding,
  onLogout,
}) {
  const [separateDataTeamId, setSeparateDataTeamId] = useState('');
  const canOpenSeparateData = Number(separateDataTeamId) > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box', background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '8px 12px', flexShrink: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', flexShrink: 0 }}>生産スケジュール</div>
      <div style={{ flex: '1 0 12px' }} />
      <button
        onClick={onSeedMaster}
        disabled={seeding}
        style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: seeding ? '#f3f4f6' : '#fff', cursor: seeding ? 'default' : 'pointer', fontSize: 13, marginRight: 6, flexShrink: 0 }}
      >
        初期データ生成
      </button>
      <button
        onClick={onSeedPlans}
        disabled={seeding}
        style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: seeding ? '#f3f4f6' : '#fff', cursor: seeding ? 'default' : 'pointer', fontSize: 13, marginRight: 8, flexShrink: 0 }}
      >
        予定データ生成
      </button>
      <button
        onClick={onOpenSettings}
        style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"/></svg>
        表示設定
      </button>
      <button
        onClick={() => onOpenSeparateData(separateDataTeamId)}
        disabled={!canOpenSeparateData}
        style={{ marginLeft: 6, padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: canOpenSeparateData ? '#fff' : '#f3f4f6', color: canOpenSeparateData ? '#111827' : '#9ca3af', cursor: canOpenSeparateData ? 'pointer' : 'not-allowed', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3h6v6"/><path d="M17 3l-8 8"/><path d="M15 11v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>
        別データ
      </button>
      <label style={{ marginLeft: 6, display: 'flex', alignItems: 'center', gap: 4, color: '#374151', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
        チームID
        <input
          type="text"
          inputMode="numeric"
          value={separateDataTeamId}
          onChange={event => setSeparateDataTeamId(event.target.value.replace(/\D/g, ''))}
          onKeyDown={event => {
            if (event.key === 'Enter' && canOpenSeparateData) onOpenSeparateData(separateDataTeamId);
          }}
          aria-label="別データのチームID"
          style={{ width: 64, boxSizing: 'border-box', padding: '5px 7px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        />
      </label>
      <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 8px' }} />
      <span style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>{userName}</span>
      <button onClick={onLogout} style={{ marginLeft: 8, padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>ログアウト</button>
    </div>
  );
}
