import { useEffect, useState, useCallback } from 'react';
import { runOcr } from '../lib/ocr';
import { resolveCategoryName } from '../lib/synonyms';
import { runArranger, type BankCategoryItem } from '../lib/arranger';
import { apiCategories } from '../lib/api';
import { BankIcon } from '../components/BankIcon';
import { BottomNav } from '../components/BottomNav';
import { useStore } from '../store';

export function Arrange() {
  const banks = useStore(s => s.banks);
  const loadBanks = useStore(s => s.loadBanks);
  const loadCategories = useStore(s => s.loadCategories);
  const createCategory = useStore(s => s.createCategory);
  const getSynonymsMap = useStore(s => s.getSynonymsMap);

  const [bankLimits, setBankLimits] = useState<Record<number, number>>({});
  const [bankFiles, setBankFiles] = useState<Record<number, File | null>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Map<number, string[]> | null>(null);

  useEffect(() => {
    loadBanks();
    loadCategories();
    useStore.getState().loadCategorySynonyms();
  }, [loadBanks, loadCategories]);

  const setLimit = useCallback((bankId: number, value: number) => {
    setBankLimits((prev) => ({ ...prev, [bankId]: Math.max(0, value) }));
  }, []);

  const setFile = useCallback((bankId: number, file: File | null) => {
    setBankFiles((prev) => ({ ...prev, [bankId]: file ?? null }));
  }, []);

  const run = useCallback(async () => {
    const withFiles = banks.filter((b) => bankFiles[b.id]);
    if (withFiles.length === 0) {
      setError('Upload at least one photo');
      return;
    }
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      let categoriesList = await apiCategories.list();
      const synonymsMap = getSynonymsMap();
      const bankCategories = new Map<number, BankCategoryItem[]>();
      const bankNames: Record<number, string> = {};
      for (const bank of banks) {
        bankNames[bank.id] = bank.name;
      }

      for (const bank of withFiles) {
        const file = bankFiles[bank.id];
        if (!file) continue;
        const ocrResults = await runOcr(file);
        const items: BankCategoryItem[] = [];
        for (const r of ocrResults) {
          const resolvedName = resolveCategoryName(r.category, synonymsMap);
          let cat = categoriesList.find((c) => c.name.toLowerCase() === resolvedName.toLowerCase());
          if (!cat) {
            cat = await createCategory(resolvedName);
            categoriesList = [...categoriesList, cat];
          }
          items.push({
            category_id: cat.id,
            category_name: cat.name,
            percentage: r.percentage,
          });
        }
        if (items.length > 0) {
          bankCategories.set(bank.id, items);
        }
      }

      const limits: Record<number, number> = {};
      for (const bank of banks) {
        limits[bank.id] = bankLimits[bank.id] ?? 0;
      }

      const assignment = runArranger(bankCategories, limits, bankNames, synonymsMap);
      setResult(assignment);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }, [banks, bankFiles, bankLimits, getSynonymsMap, createCategory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-slate-100">Аранжировщик</h1>
          <p className="text-slate-500 text-sm mt-1">Загрузите фото категорий по банкам и укажите лимиты</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {banks.length === 0 ? (
          <p className="text-slate-500">No banks. Add banks first.</p>
        ) : (
          <>
            <ul className="space-y-4">
              {banks.map((bank) => (
                <li key={bank.id} className="p-4 bg-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <BankIcon bankName={bank.name} size="md" />
                    <span className="font-medium text-slate-200">{bank.name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm">Лимит категорий</span>
                      <input
                        type="number"
                        min={0}
                        value={bankLimits[bank.id] ?? 0}
                        onChange={(e) => setLimit(bank.id, parseInt(e.target.value, 10) || 0)}
                        className="w-20 py-1.5 px-2 rounded bg-slate-700 text-slate-200 border border-slate-600"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400">Фото</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-600 file:text-slate-200"
                        onChange={(e) => setFile(bank.id, e.target.files?.[0] ?? null)}
                      />
                      {bankFiles[bank.id] && (
                        <span className="text-slate-500 truncate max-w-[120px]">{bankFiles[bank.id]!.name}</span>
                      )}
                    </label>
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={run}
              disabled={running}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl"
            >
              {running ? 'Распределяю…' : 'Распределить'}
            </button>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {result !== null && (
              <section>
                <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Результат</h2>
                <ul className="space-y-3">
                  {banks.map((bank) => {
                    const list = result.get(bank.id);
                    if (!list || list.length === 0) return null;
                    return (
                      <li key={bank.id} className="p-4 bg-slate-800 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <BankIcon bankName={bank.name} size="sm" />
                          <span className="font-medium text-slate-200">{bank.name}</span>
                        </div>
                        <p className="text-slate-400 text-sm mb-1">Выбери:</p>
                        <p className="text-slate-200">{list.join(', ')}</p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      <BottomNav />
      <div className="h-16" />
    </div>
  );
}
