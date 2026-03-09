import { useEffect, useState, useRef } from 'react';
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
import { getThreeMonths } from '../lib/months';
import appIcon from '/pwa-icon-source.png';

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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 50 || absDx <= absDy) return;

    const options = getThreeMonths();
    const currentIndex = options.findIndex(
      o => o.month === selectedMonth.month && o.year === selectedMonth.year,
    );
    if (currentIndex === -1) return;

    const offset = dx < 0 ? 1 : -1;
    const next = options[currentIndex + offset];
    if (!next) return;
    setSelectedMonth(next);
  };

  return (
    <div
      className="min-h-screen bg-violet-50/50 text-slate-800"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-3">
          <div className="flex items-center gap-3">
            <img
              src={appIcon}
              alt="Cashback Hunter"
              className="h-8 w-8 rounded-3xl shadow-sm object-cover"
            />
            <h1 className="text-2xl font-bold text-slate-800">Cashback Hunter</h1>
          </div>
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
