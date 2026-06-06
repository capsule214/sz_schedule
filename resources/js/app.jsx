import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import SpreadsheetGridClient from './components/SpreadsheetGridClient';
import LoginPage from './components/LoginPage';
import { initCsrf, apiJson } from './lib/api';
import '../css/app.css';

function App() {
  const [user, setUser]       = useState(null);   // null = 未確認
  const [checked, setChecked] = useState(false);  // 認証確認済みフラグ

  // 初期表示時に認証済みセッションがあるか確認
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        await initCsrf();
        const data = await apiJson('/me', { method: 'GET' });
        if (!cancelled && data?.user) setUser(data.user);
      } catch {
        // 未ログインまたは通信失敗時はログイン画面を表示する。
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('api:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('api:unauthorized', handleUnauthorized);
  }, []);

  // ブラウザ標準コンテキストメニューを全面抑制
  useEffect(() => {
    const suppress = e => e.preventDefault();
    document.addEventListener('contextmenu', suppress);
    return () => document.removeEventListener('contextmenu', suppress);
  }, []);

  if (!checked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 14, color: '#6b7280' }}>
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={u => setUser(u)} />;
  }

  return <SpreadsheetGridClient user={user} onLogout={() => setUser(null)} />;
}

const root = createRoot(document.getElementById('app'));
root.render(<App />);
