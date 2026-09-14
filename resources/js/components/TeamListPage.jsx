import { useCallback, useEffect, useState } from 'react';
import { apiArray } from '../lib/api';
import LoadingScreen from './LoadingScreen';

const headerCellStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid #d1d5db',
  background: '#f3f4f6',
  color: '#374151',
  fontSize: 13,
  fontWeight: 700,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const bodyCellStyle = {
  padding: '9px 12px',
  borderBottom: '1px solid #e5e7eb',
  color: '#111827',
  fontSize: 13,
};

function departmentName(szgroupId) {
  const id = Number(szgroupId);
  return id > 0 ? `${id}部` : '-';
}

export default function TeamListPage() {
  const requestedTeamId = Number(new URLSearchParams(window.location.search).get('teamId'));
  const teamId = Number.isInteger(requestedTeamId) && requestedTeamId > 0 ? requestedTeamId : null;
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiArray('/worker/team');
      setTeams(teamId === null ? data : data.filter(team => Number(team.teamId) === teamId));
    } catch {
      setError('チームリストを取得できませんでした');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    document.title = `${teamId === null ? 'チームリスト' : `チームID ${teamId}`} - 生産スケジュール`;
    loadTeams();
  }, [loadTeams]);

  return (
    <div style={{ width: 'var(--web-viewport-width, 100vw)', height: 'var(--web-viewport-height, 100dvh)', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: '#f9fafb' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #d1d5db', background: '#fff', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 17, color: '#111827' }}>チームリスト</h1>
        {teamId !== null && (
          <span style={{ padding: '3px 8px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600 }}>チームID: {teamId}</span>
        )}
        <span style={{ color: '#6b7280', fontSize: 13 }}>{loading ? '取得中...' : `${teams.length}件`}</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={loadTeams}
          disabled={loading}
          style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: loading ? '#f3f4f6' : '#fff', color: '#374151', cursor: loading ? 'default' : 'pointer', fontSize: 13 }}
        >
          更新
        </button>
      </header>

      <main style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch', padding: 16, boxSizing: 'border-box' }}>
        {loading && teams.length === 0 ? (
          <LoadingScreen message="チームリストを読み込んでいます..." />
        ) : error ? (
          <div role="alert" style={{ maxWidth: 900, margin: '0 auto', padding: 16, border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
            {error}
          </div>
        ) : (
          <div style={{ maxWidth: 900, minWidth: 520, margin: '0 auto', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...headerCellStyle, width: 100 }}>チームID</th>
                  <th style={headerCellStyle}>チーム名</th>
                  <th style={{ ...headerCellStyle, width: 120 }}>製造部署</th>
                  <th style={{ ...headerCellStyle, width: 100 }}>表示順</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(team => (
                  <tr key={team.teamId}>
                    <td style={bodyCellStyle}>{team.teamId}</td>
                    <td style={bodyCellStyle}>{team.teamName || '(未設定)'}</td>
                    <td style={bodyCellStyle}>{departmentName(team.szgroupId)}</td>
                    <td style={bodyCellStyle}>{team.sortNo}</td>
                  </tr>
                ))}
                {teams.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ ...bodyCellStyle, padding: 24, textAlign: 'center', color: '#6b7280' }}>チームデータがありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
