import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { BankIcon } from '../components/BankIcon';
import { BottomNav } from '../components/BottomNav';

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
    <div className="min-h-screen bg-violet-50/50 text-slate-800">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-slate-800">Banks</h1>
          <p className="text-slate-500 text-sm mt-1">Last update date per bank</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {banks.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <p className="mb-4">No banks yet.</p>
            <Link
              to="/add"
              className="inline-block py-2.5 px-5 bg-violet-500 hover:bg-violet-600 text-white font-medium rounded-xl"
            >
              Add cashback (create bank there)
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {banks.map(bank => (
              <li
                key={bank.id}
                className="flex items-center justify-between gap-3 py-3 px-4 bg-white border border-slate-200 rounded-xl shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BankIcon bankName={bank.name} size="md" />
                  <span className="font-medium text-slate-800 truncate">{bank.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-sm tabular-nums">
                    {formatDate(bank.updated_at)}
                  </span>
                  <Link
                    to={`/add?bankId=${bank.id}`}
                    className="text-violet-600 hover:text-violet-500 text-sm font-medium"
                  >
                    Update
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BottomNav />
      <div className="h-24" />
    </div>
  );
}
