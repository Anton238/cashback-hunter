import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { runOcr } from '../lib/ocr';
import { resolveCategoryName } from '../lib/synonyms';
import { getDefaultMonth } from '../lib/months';
import type { CashbackRow } from '../components/CashbackForm';
import { MonthSelector } from '../components/MonthSelector';
import { CashbackForm } from '../components/CashbackForm';
import { BottomNav } from '../components/BottomNav';
import { useStore } from '../store';
import { apiCategories } from '../lib/api';

export function AddCashback() {
  const [searchParams] = useSearchParams();
  const bankIdParam = searchParams.get('bankId');
  const categoryIdParam = searchParams.get('categoryId');

  const defaultMonth = getDefaultMonth();
  const [monthOption, setMonthOption] = useState(defaultMonth);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(
    bankIdParam ? parseInt(bankIdParam, 10) : null,
  );
  const [prefillRows, setPrefillRows] = useState<CashbackRow[]>([]);
  const [saved, setSaved] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const banks = useStore(s => s.banks);
  const categories = useStore(s => s.categories);
  const loadBanks = useStore(s => s.loadBanks);
  const loadCategories = useStore(s => s.loadCategories);
  const createCategory = useStore(s => s.createCategory);
  const createBank = useStore(s => s.createBank);
  const getSynonymsMap = useStore(s => s.getSynonymsMap);

  useEffect(() => {
    loadBanks();
    loadCategories();
    useStore.getState().loadCategorySynonyms();
  }, []);

  useEffect(() => {
    if (categoryIdParam && categories.length > 0) {
      const id = parseInt(categoryIdParam, 10);
      const cat = categories.find(c => c.id === id);
      if (cat) setPrefillRows(prev => prev.length ? prev : [{ category_id: cat.id, category_name: cat.name, percentage: '' }]);
    }
  }, [categoryIdParam, categories]);

  const handleFile = useCallback(async (file: File) => {
    setOcrLoading(true);
    setUploadError(null);
    try {
      const results = await runOcr(file);
      let categoriesList = await apiCategories.list();
      const rows: CashbackRow[] = [];
      const synonymsMap = getSynonymsMap();
      for (const r of results) {
        const resolvedName = resolveCategoryName(r.category, synonymsMap);
        let cat = categoriesList.find(c => c.name.toLowerCase() === resolvedName.toLowerCase());
        if (!cat) {
          cat = await createCategory(resolvedName);
          categoriesList = [...categoriesList, cat];
        }
        rows.push({
          category_id: cat.id,
          category_name: cat.name,
          percentage: r.percentage % 1 === 0 ? String(r.percentage) : r.percentage.toFixed(1),
        });
      }
      if (rows.length > 0) {
        setPrefillRows(rows);
      } else {
        setUploadError('Recognition finished. No cashback lines found in the image.');
      }
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setOcrLoading(false);
    }
  }, [createCategory]);

  const handleSaved = useCallback(() => {
    setSaved(true);
    setPrefillRows([]);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const { month, year } = monthOption;

  return (
    <div className="min-h-screen bg-violet-50/50 text-slate-800">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-2">
          <h1 className="text-lg font-bold text-slate-800">Add cashback</h1>
          <div className="mt-2">
            <MonthSelector value={monthOption} onChange={setMonthOption} />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-nav space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Photo (optional, for OCR)
          </label>
          <input
            type="file"
            accept="image/*"
            disabled={ocrLoading}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
            className="block w-full text-slate-600 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-100 file:text-violet-700 file:border file:border-violet-200"
          />
          {ocrLoading && <p className="mt-1 text-slate-500 text-sm">Recognizing text...</p>}
          {uploadError && <p className="mt-1 text-red-400 text-sm">{uploadError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Bank</label>
          <select
            value={selectedBankId ?? ''}
            onChange={e => setSelectedBankId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
          >
            <option value="">Select bank</option>
            {banks.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={async () => {
              const name = window.prompt('Bank name');
              if (!name?.trim()) return;
              const bank = await createBank(name.trim());
              setSelectedBankId(bank.id);
            }}
            className="mt-2 text-sm text-violet-600 hover:text-violet-500"
          >
            + Add new bank
          </button>
        </div>

        {selectedBankId && (
          <CashbackForm
            bankId={selectedBankId}
            month={month}
            year={year}
            initialRows={prefillRows}
            onSaved={handleSaved}
          />
        )}

        {saved && (
          <p className="text-emerald-400 text-sm">Saved.</p>
        )}
      </main>

      <BottomNav />
      <div className="h-24" />
    </div>
  );
}
