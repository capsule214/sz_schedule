import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import SpreadsheetGridClient from './components/SpreadsheetGridClient';
import LoginPage from './components/LoginPage';
import LoadingScreen from './components/LoadingScreen';
import AlertToast from './components/AlertToast';
import { initCsrf, apiJson, resetUnauthorizedState } from './lib/api';
import '../css/app.css';

function App() {
  const [user, setUser]       = useState(null);   // null = 未確認
  const [checked, setChecked] = useState(false);  // 認証確認済みフラグ
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }

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
    const handleUnauthorized = () => {
      setChecked(true);
      setUser(null);
      showToast('ログインの有効期限が切れました。再度ログインしてください');
    };
    window.addEventListener('api:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('api:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    const handleApiError = (e) => {
      showToast(e?.detail?.message || '処理ができませんでした');
    };
    window.addEventListener('api:error', handleApiError);
    return () => {
      window.removeEventListener('api:error', handleApiError);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ブラウザ標準コンテキストメニューを全面抑制
  useEffect(() => {
    const suppress = e => e.preventDefault();
    document.addEventListener('contextmenu', suppress);
    return () => document.removeEventListener('contextmenu', suppress);
  }, []);

  if (!checked) {
    return (
      <>
        <LoadingScreen />
        <AlertToast message={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage onLogin={u => { resetUnauthorizedState(); setUser(u); }} />
        <AlertToast message={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <>
      <SpreadsheetGridClient user={user} onLogout={() => { resetUnauthorizedState(); setUser(null); }} />
      <AlertToast message={toast} onClose={() => setToast(null)} />
    </>
  );
}

const root = createRoot(document.getElementById('app'));
root.render(<App />);
