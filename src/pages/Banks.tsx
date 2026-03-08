import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function Banks() {
  const banks = useStore(s => s.banks);
  const loadBanks = useStore(s => s.loadBanks);

  useEffect(() => {
    loadBanks();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-slate-100">Banks</h1>
          <p className="text-slate-500 text-sm mt-1">Last update date per bank</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {banks.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="mb-4">No banks yet.</p>
            <Link
              to="/add"
              className="inline-block py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl"
            >
              Add cashback (create bank there)
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {banks.map(bank => (
              <li
                key={bank.id}
                className="flex items-center justify-between py-3 px-4 bg-slate-800 rounded-xl"
              >
                <span className="font-medium text-slate-200">{bank.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-sm tabular-nums">
                    {formatDate(bank.updated_at)}
                  </span>
                  <Link
                    to={`/add?bankId=${bank.id}`}
                    className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                  >
                    Update
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 safe-area-pb">
        <div className="max-w-lg mx-auto flex">
          <Link to="/" className="flex-1 py-3 text-center text-slate-400 hover:text-slate-200">
            Home
          </Link>
          <Link to="/add" className="flex-1 py-3 text-center text-slate-400 hover:text-slate-200">
            Add
          </Link>
          <Link to="/banks" className="flex-1 py-3 text-center text-indigo-400 font-medium">
            Banks
          </Link>
          <Link to="/settings" className="flex-1 py-3 text-center text-slate-400 hover:text-slate-200">
            Settings
          </Link>
        </div>
      </nav>
      <div className="h-16" />
    </div>
  );
}
