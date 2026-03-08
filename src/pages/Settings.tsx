import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePush } from '../hooks/usePush';
import { apiPush } from '../lib/api';

export function Settings() {
  const { state, subscribe, unsubscribe } = usePush();
  const [schedule, setSchedule] = useState<{ day: number; banks: string[] }[]>([]);

  useEffect(() => {
    apiPush.schedule().then(setSchedule).catch(() => {});
  }, []);

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
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 text-sm">Reminders enabled</span>
              <button
                onClick={unsubscribe}
                className="py-1.5 px-3 text-slate-400 hover:text-slate-200 text-sm rounded-lg border border-slate-600"
              >
                Disable
              </button>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Reminder schedule
          </h2>
          <p className="text-slate-500 text-sm mb-3">Day of month → banks to update</p>
          <ul className="space-y-2">
            {schedule.map(({ day, banks }) => (
              <li key={day} className="py-2 px-3 bg-slate-800 rounded-lg text-sm">
                <span className="text-slate-400">Day {day}:</span>{' '}
                <span className="text-slate-200">{banks.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 safe-area-pb">
        <div className="max-w-lg mx-auto flex">
          <Link to="/" className="flex-1 py-3 text-center text-slate-400 hover:text-slate-200">Home</Link>
          <Link to="/add" className="flex-1 py-3 text-center text-slate-400 hover:text-slate-200">Add</Link>
          <Link to="/banks" className="flex-1 py-3 text-center text-slate-400 hover:text-slate-200">Banks</Link>
          <Link to="/settings" className="flex-1 py-3 text-center text-indigo-400 font-medium">Settings</Link>
        </div>
      </nav>
      <div className="h-16" />
    </div>
  );
}
