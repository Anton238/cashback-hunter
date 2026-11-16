import { useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { apiAuth } from '../lib/api';
import { App } from '../App';

export function AuthGate() {
  const [ready, setReady] = useState(false), [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    apiAuth.session().then(() => { if (active) setUnlocked(true); }).catch(() => {}).finally(() => { if (active) setReady(true); });
    const lock = () => { setUnlocked(false); setCode(''); };
    window.addEventListener('cashback:locked', lock);
    return () => { active = false; window.removeEventListener('cashback:locked', lock); };
  }, []);
  async function logout() {
    try { await apiAuth.logout(); setUnlocked(false); setCode(''); }
    catch (e) { window.alert((e as Error).message); }
  }
  if (unlocked) return <App onLock={logout} />;
  return <div className="access-page"><form className="access-card" onSubmit={async e => {
    e.preventDefault(); if (busy || !ready) return;
    setBusy(true); setError('');
    try { await apiAuth.login(code); setCode(''); setUnlocked(true); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }}>
    <img src="/hunter-icon.png" width="64" height="64" alt="" />
    <h1>Cashback Hunter</h1>
    <label htmlFor="access-code"><LockKeyhole size={18} /> Код доступа</label>
    <input id="access-code" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4}" maxLength={4} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={!ready || busy} required aria-describedby={error ? 'access-error' : undefined} />
    {error && <p id="access-error" role="alert">{error}</p>}
    <button type="submit" disabled={!ready || busy || code.length !== 4}>{!ready ? 'Загрузка…' : busy ? 'Входим…' : 'Войти'}</button>
  </form></div>;
}
