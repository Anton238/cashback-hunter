import { useEffect, useState } from 'react';
import { usePush } from '../hooks/usePush';
import { BottomNav } from '../components/BottomNav';
import { apiPush, apiHealth, apiBanks, apiCategories, apiCashback, apiSynonyms } from '../lib/api';
import { API_BASE } from '../lib/constants';
import { useStore } from '../store';

export function Settings() {
  const { state, subscribe, unsubscribe, getEndpoint } = usePush();
  const [schedule, setSchedule] = useState<{ day: number }[]>([]);
  const [testNotify, setTestNotify] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [testNotifyError, setTestNotifyError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [apiError, setApiError] = useState<string | null>(null);
  const [dataCheck, setDataCheck] = useState<{ banks?: string; categories?: string; cashback?: string } | null>(null);
  const [synonymMainId, setSynonymMainId] = useState<number | ''>('');
  const [synonymInput, setSynonymInput] = useState('');
  const [synonymError, setSynonymError] = useState<string | null>(null);
  const selectedMonth = useStore(s => s.selectedMonth);
  const categories = useStore(s => s.categories);
  const categorySynonyms = useStore(s => s.categorySynonyms);
  const loadCategories = useStore(s => s.loadCategories);
  const loadCategorySynonyms = useStore(s => s.loadCategorySynonyms);

  useEffect(() => {
    apiPush.schedule().then(setSchedule).catch(() => {});
  }, []);

  useEffect(() => {
    loadCategories();
    loadCategorySynonyms();
  }, [loadCategories, loadCategorySynonyms]);

  const addSynonym = async () => {
    const categoryId = synonymMainId;
    const syn = synonymInput.trim();
    if (categoryId === '' || !syn) return;
    setSynonymError(null);
    try {
      await apiSynonyms.add(categoryId, syn);
      await loadCategorySynonyms();
      setSynonymInput('');
    } catch (err) {
      setSynonymError((err as Error).message);
    }
  };

  const removeSynonym = async (id: number) => {
    setSynonymError(null);
    try {
      await apiSynonyms.delete(id);
      await loadCategorySynonyms();
    } catch (err) {
      setSynonymError((err as Error).message);
    }
  };

  const checkApi = () => {
    setApiStatus('checking');
    setApiError(null);
    apiHealth
      .check()
      .then(() => {
        setApiStatus('ok');
      })
      .catch((err: Error) => {
        setApiStatus('error');
        setApiError(err.message);
      });
  };

  const sendTestNotification = async () => {
    setTestNotify('sending');
    setTestNotifyError(null);
    try {
      const endpoint = await getEndpoint();
      if (!endpoint) {
        setTestNotifyError('Enable reminders first');
        setTestNotify('error');
        return;
      }
      await apiPush.test(endpoint);
      setTestNotify('ok');
    } catch (err) {
      setTestNotifyError((err as Error).message);
      setTestNotify('error');
    }
  };

  const checkDataEndpoints = async () => {
    setDataCheck(null);
    const [banks, categories, cashback] = await Promise.all([
      apiBanks.list().then(() => 'OK').catch((e: Error) => e.message),
      apiCategories.list().then(() => 'OK').catch((e: Error) => e.message),
      apiCashback.list(selectedMonth.month, selectedMonth.year).then(() => 'OK').catch((e: Error) => e.message),
    ]);
    setDataCheck({ banks, categories, cashback });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            API connection
          </h2>
          <p className="text-slate-500 text-sm mb-3">
            If cashbacks do not load (e.g. “Load failed”), check whether the app can reach the API.
          </p>
          <p className="text-slate-500 text-xs mb-2 font-mono break-all">{API_BASE}</p>
          <button
            type="button"
            onClick={checkApi}
            disabled={apiStatus === 'checking'}
            className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium rounded-xl"
          >
            {apiStatus === 'checking' ? 'Checking...' : 'Check API'}
          </button>
          {apiStatus === 'ok' && (
            <p className="mt-2 text-emerald-400 text-sm">API is reachable.</p>
          )}
          {apiStatus === 'error' && apiError && (
            <p className="mt-2 text-red-400 text-sm">Error: {apiError}</p>
          )}
          <p className="text-slate-500 text-sm mt-4 mb-2">Data endpoints (used by Home):</p>
          <button
            type="button"
            onClick={checkDataEndpoints}
            className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl"
          >
            Check banks / categories / cashback
          </button>
          {dataCheck && (
            <ul className="mt-2 text-sm space-y-1">
              <li className={dataCheck.banks === 'OK' ? 'text-emerald-400' : 'text-red-400'}>
                banks: {dataCheck.banks}
              </li>
              <li className={dataCheck.categories === 'OK' ? 'text-emerald-400' : 'text-red-400'}>
                categories: {dataCheck.categories}
              </li>
              <li className={dataCheck.cashback === 'OK' ? 'text-emerald-400' : 'text-red-400'}>
                cashback: {dataCheck.cashback}
              </li>
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Notifications
          </h2>
          <p className="text-slate-500 text-sm mb-3">
            Reminders to update bank cashback. Works when the app is installed on your home screen (iOS 16.4+).
          </p>
          {state === 'unsupported' && (
            <p className="text-slate-500 text-sm">Push is not supported in this browser.</p>
          )}
          {state === 'denied' && (
            <p className="text-amber-500 text-sm">Notifications are blocked. Enable them in system settings.</p>
          )}
          {(state === 'unsubscribed' || state === 'loading') && (
            <button
              onClick={subscribe}
              disabled={state === 'loading'}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl"
            >
              {state === 'loading' ? 'Loading...' : 'Enable reminders'}
            </button>
          )}
          {state === 'subscribed' && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 text-sm">Reminders enabled</span>
                <button
                  onClick={unsubscribe}
                  className="py-1.5 px-3 text-slate-400 hover:text-slate-200 text-sm rounded-lg border border-slate-600"
                >
                  Disable
                </button>
              </div>
              <button
                type="button"
                onClick={sendTestNotification}
                disabled={testNotify === 'sending'}
                className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium rounded-xl"
              >
                {testNotify === 'sending' ? 'Sending...' : 'Test notification'}
              </button>
              {testNotify === 'ok' && (
                <p className="text-emerald-400 text-sm">Test notification sent. Check your device.</p>
              )}
              {testNotify === 'error' && testNotifyError && (
                <p className="text-red-400 text-sm">Error: {testNotifyError}</p>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Category synonyms
          </h2>
          <p className="text-slate-500 text-sm mb-3">
            Map synonym names to a main category. When you add cashback with a synonym (e.g. Супермаркеты), it will be saved under the main category (e.g. Продукты).
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Main category</label>
              <select
                value={synonymMainId === '' ? '' : String(synonymMainId)}
                onChange={e => setSynonymMainId(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Synonym</label>
                <input
                  type="text"
                  value={synonymInput}
                  onChange={e => setSynonymInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSynonym())}
                  placeholder="e.g. Супермаркеты"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addSynonym}
                  disabled={synonymMainId === '' || !synonymInput.trim()}
                  className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium rounded-lg"
                >
                  Add
                </button>
              </div>
            </div>
            {synonymError && <p className="text-sm text-red-400">{synonymError}</p>}
            {categorySynonyms.length > 0 && (
              <ul className="space-y-2 mt-3">
                {Object.entries(
                  categorySynonyms.reduce<Record<string, typeof categorySynonyms>>((acc, s) => {
                    if (!acc[s.category_name]) acc[s.category_name] = [];
                    acc[s.category_name].push(s);
                    return acc;
                  }, {})
                ).map(([main, syns]) => (
                  <li key={main} className="py-2 px-3 bg-slate-800 rounded-lg">
                    <span className="text-slate-400 text-sm">{main}</span>
                    <ul className="mt-1.5 space-y-1">
                      {syns.map(s => (
                        <li key={s.id} className="flex items-center justify-between text-sm">
                          <span className="text-slate-200">{s.synonym}</span>
                          <button
                            type="button"
                            onClick={() => removeSynonym(s.id)}
                            className="p-1 text-slate-500 hover:text-red-400 rounded"
                            aria-label="Remove synonym"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Reminder schedule
          </h2>
          <p className="text-slate-500 text-sm mb-3">One reminder on the last day of each month: «Выбери кэшбэки».</p>
          <ul className="space-y-2">
            {schedule.map(({ day }) => (
              <li key={day} className="py-2 px-3 bg-slate-800 rounded-lg text-sm">
                <span className="text-slate-400">Day {day}</span>
                <span className="text-slate-200"> (last day of month)</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <BottomNav />
      <div className="h-16" />
    </div>
  );
}
