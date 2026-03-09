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
  const [manualEnabled, setManualEnabled] = useState<Record<number, boolean>>({});
  const [manualRows, setManualRows] = useState<Record<number, { category: string; percentage: string }[]>>({});
  const [manualCategoryInput, setManualCategoryInput] = useState<Record<number, string>>({});
  const [manualPercentageInput, setManualPercentageInput] = useState<Record<number, string>>({});
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

  const toggleManual = useCallback((bankId: number) => {
    setManualEnabled(prev => ({ ...prev, [bankId]: !prev[bankId] }));
  }, []);

  const setManualCategory = useCallback((bankId: number, value: string) => {
    setManualCategoryInput(prev => ({ ...prev, [bankId]: value }));
  }, []);

  const setManualPercentage = useCallback((bankId: number, value: string) => {
    setManualPercentageInput(prev => ({ ...prev, [bankId]: value }));
  }, []);

  const addManualRow = useCallback((bankId: number) => {
    const name = (manualCategoryInput[bankId] ?? '').trim();
    const rawPct = (manualPercentageInput[bankId] ?? '').trim();
    if (!name) {
      setError('Enter category name');
      return;
    }
    const pctString = rawPct || '5';
    const pct = parseFloat(pctString.replace(',', '.'));
    if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
      setError('Enter valid percentage (1–100)');
      return;
    }
    setError(null);
    setManualRows(prev => {
      const existing = prev[bankId] ?? [];
      return {
        ...prev,
        [bankId]: [...existing, { category: name, percentage: pctString }],
      };
    });
    setManualCategoryInput(prev => ({ ...prev, [bankId]: '' }));
    setManualPercentageInput(prev => ({ ...prev, [bankId]: '' }));
  }, [manualCategoryInput, manualPercentageInput]);

  const removeManualRow = useCallback((bankId: number, index: number) => {
    setManualRows(prev => {
      const existing = prev[bankId] ?? [];
      return {
        ...prev,
        [bankId]: existing.filter((_, i) => i !== index),
      };
    });
  }, []);

  const run = useCallback(async () => {
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

      for (const bank of banks) {
        const manualEnabledForBank = manualEnabled[bank.id];
        const manualForBank = manualRows[bank.id] ?? [];
        if (manualEnabledForBank && manualForBank.length > 0) {
          const items: BankCategoryItem[] = [];
          for (const r of manualForBank) {
            const resolvedName = resolveCategoryName(r.category, synonymsMap);
            let cat = categoriesList.find((c) => c.name.toLowerCase() === resolvedName.toLowerCase());
            if (!cat) {
              cat = await createCategory(resolvedName);
              categoriesList = [...categoriesList, cat];
            }
            const pct = parseFloat(r.percentage.replace(',', '.'));
            if (Number.isNaN(pct) || pct <= 0 || pct > 100) continue;
            items.push({
              category_id: cat.id,
              category_name: cat.name,
              percentage: pct,
            });
          }
          if (items.length > 0) {
            bankCategories.set(bank.id, items);
          }
          continue;
        }
      }

      const withFiles = banks.filter((b) => bankFiles[b.id] && !(manualEnabled[b.id] && (manualRows[b.id]?.length ?? 0) > 0));

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

      if (bankCategories.size === 0) {
        setError('Add cashback data via photo or manual input');
        return;
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
    <div className="min-h-screen bg-violet-50/50 text-slate-800">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-slate-800">Аранжировщик</h1>
          <p className="text-slate-500 text-sm mt-1">Загрузите фото категорий по банкам и укажите лимиты</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-nav space-y-6">
        {banks.length === 0 ? (
          <p className="text-slate-500">No banks. Add banks first.</p>
        ) : (
          <>
            <ul className="space-y-4">
              {banks.map((bank) => (
                <li key={bank.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <BankIcon bankName={bank.name} size="md" />
                    <span className="font-medium text-slate-800">{bank.name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                      <span className="text-slate-500 text-sm">Лимит категорий</span>
                      <input
                        type="number"
                        min={0}
                        value={bankLimits[bank.id] ?? 0}
                        onChange={(e) => setLimit(bank.id, parseInt(e.target.value, 10) || 0)}
                        className="w-20 py-1.5 px-2 rounded bg-white text-slate-800 border border-slate-300"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500">Фото</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:bg-violet-100 file:text-violet-700 file:border-violet-200"
                        onChange={(e) => setFile(bank.id, e.target.files?.[0] ?? null)}
                      />
                      {bankFiles[bank.id] && (
                        <span className="text-slate-500 truncate max-w-[120px]">{bankFiles[bank.id]!.name}</span>
                      )}
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm ml-auto">
                      <input
                        type="checkbox"
                        checked={!!manualEnabled[bank.id]}
                        onChange={() => toggleManual(bank.id)}
                        className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-slate-600">Ручной ввод КБ</span>
                    </label>
                  </div>
                  {manualEnabled[bank.id] && (
                    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                      <div className="flex gap-2 flex-wrap items-end">
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-xs text-slate-500 mb-1">Категория</label>
                          <input
                            type="text"
                            value={manualCategoryInput[bank.id] ?? ''}
                            onChange={e => setManualCategory(bank.id, e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManualRow(bank.id))}
                            placeholder="Например, Продукты"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                          />
                        </div>
                        <div className="w-20">
                          <label className="block text-xs text-slate-500 mb-1">%</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={manualPercentageInput[bank.id] ?? ''}
                            onChange={e => setManualPercentage(bank.id, e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManualRow(bank.id))}
                            placeholder="5"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => addManualRow(bank.id)}
                          className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      {(manualRows[bank.id]?.length ?? 0) > 0 && (
                        <ul className="space-y-2">
                          {manualRows[bank.id]!.map((row, index) => (
                            <li
                              key={`${row.category}-${index}`}
                              className="flex items-center justify-between py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                            >
                              <span className="text-slate-800 truncate">{row.category}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-violet-600 font-medium tabular-nums">
                                  {row.percentage}%
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeManualRow(bank.id, index)}
                                  className="p-1 text-slate-500 hover:text-red-400 rounded"
                                  aria-label="Remove"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={run}
              disabled={running}
              className="w-full py-3 px-4 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white font-medium rounded-xl"
            >
              {running ? 'Распределяю…' : 'Распределить'}
            </button>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            {result !== null && (
              <section>
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Результат</h2>
                <ul className="space-y-3">
                  {banks.map((bank) => {
                    const list = result.get(bank.id);
                    if (!list || list.length === 0) return null;
                    return (
                      <li key={bank.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <BankIcon bankName={bank.name} size="sm" />
                          <span className="font-medium text-slate-800">{bank.name}</span>
                        </div>
                        <p className="text-slate-500 text-sm mb-1">Выбери:</p>
                        <p className="text-slate-700">{list.join(', ')}</p>
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
      <div className="h-24" />
    </div>
  );
}
