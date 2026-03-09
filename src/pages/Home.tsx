import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isEssentialCategory, essentialSortIndex } from '../lib/constants';
import type { CategorySummary } from '../lib/api';
import { useStore } from '../store';
import { MonthSelector } from '../components/MonthSelector';
import { CategoryCard } from '../components/CategoryCard';
import { CategoryModal } from '../components/CategoryModal';
import { InstallPrompt } from '../components/InstallPrompt';
import { BottomNav } from '../components/BottomNav';
import { apiPush } from '../lib/api';

export function Home() {
  const selectedMonth = useStore(s => s.selectedMonth);
  const setSelectedMonth = useStore(s => s.setSelectedMonth);
  const categorySummaries = useStore(s => s.categorySummaries);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const refreshAll = useStore(s => s.refreshAll);

  const [modalSummary, setModalSummary] = useState<CategorySummary | null>(null);
  const [todayReminder, setTodayReminder] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    apiPush.scheduleToday().then(({ reminder }) => setTodayReminder(reminder)).catch(() => {});
  }, []);

  const getSynonymsMap = useStore(s => s.getSynonymsMap);
  const synonymsMap = getSynonymsMap();
  const essential = categorySummaries
    .filter(s => isEssentialCategory(s.category_name, synonymsMap))
    .sort((a, b) => essentialSortIndex(a.category_name, synonymsMap) - essentialSortIndex(b.category_name, synonymsMap));
  const other = categorySummaries
    .filter(s => !isEssentialCategory(s.category_name, synonymsMap))
    .sort((a, b) => {
      const ia = essentialSortIndex(a.category_name, synonymsMap);
      const ib = essentialSortIndex(b.category_name, synonymsMap);
      return ia !== ib ? ia - ib : a.category_name.localeCompare(b.category_name);
    });

  return (
    <div className="min-h-screen bg-violet-50/50 text-slate-800">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold text-slate-800">Cashback Hunter</h1>
          <div className="mt-2">
            <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-nav">
        {todayReminder && (
          <div className="mb-4 p-3 bg-amber-100 border border-amber-300 rounded-xl text-amber-800 text-sm">
            Today: Выбери кэшбэки
            <Link to="/add" className="block mt-1 font-medium text-amber-600 hover:underline">
              Add cashback →
            </Link>
          </div>
        )}

        {error && (
          <p className="mb-4 text-red-600 text-sm">
            {error}
            <span className="block mt-1 text-slate-500 text-xs">
              Check network and API (Settings → Check API). If on mobile data, try Wi‑Fi or vice versa.
            </span>
          </p>
        )}

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : categorySummaries.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <p className="mb-4">No cashback data for this month.</p>
            <Link
              to="/add"
              className="inline-block py-2.5 px-5 bg-violet-500 hover:bg-violet-600 text-white font-medium rounded-xl"
            >
              Add cashback
            </Link>
          </div>
        ) : (
          <>
            {essential.length > 0 && (
              <section className="mb-6">
                <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                  Main categories
                </h2>
                <div className="grid gap-2">
                  {essential.map(s => (
                    <CategoryCard
                      key={s.category_id}
                      summary={s}
                      onClick={() => setModalSummary(s)}
                    />
                  ))}
                </div>
              </section>
            )}
            {other.length > 0 && (
              <section>
                <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                  Other categories
                </h2>
                <div className="grid gap-2">
                  {other.map(s => (
                    <CategoryCard
                      key={s.category_id}
                      summary={s}
                      onClick={() => setModalSummary(s)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <BottomNav />

      <div className="h-24" />

      <InstallPrompt />

      <CategoryModal
        summary={modalSummary}
        month={selectedMonth.month}
        year={selectedMonth.year}
        onClose={() => setModalSummary(null)}
        onAddBank={() => {
          const id = modalSummary?.category_id;
          setModalSummary(null);
          navigate(id != null ? `/add?categoryId=${id}` : '/add');
        }}
      />
    </div>
  );
}
