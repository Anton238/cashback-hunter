import { useState } from 'react';
import { resolveCategoryName } from '../lib/synonyms';
import { useStore } from '../store';

export interface CashbackRow {
  category_id: number;
  category_name: string;
  percentage: string;
}

interface Props {
  bankId: number | null;
  month: number;
  year: number;
  initialRows: CashbackRow[];
  onSaved: () => void;
}

export function CashbackForm({
  bankId,
  month,
  year,
  initialRows,
  onSaved,
}: Props) {
  const [rows, setRows] = useState<CashbackRow[]>(initialRows);
  const [categoryInput, setCategoryInput] = useState('');
  const [percentageInput, setPercentageInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const banks = useStore(s => s.banks);
  const categories = useStore(s => s.categories);
  const createCategory = useStore(s => s.createCategory);
  const getSynonymsMap = useStore(s => s.getSynonymsMap);
  const saveCashbackEntry = useStore(s => s.saveCashbackEntry);

  const bank = bankId ? banks.find(b => b.id === bankId) : null;
  if (!bankId || !bank) return null;

  const addRow = async () => {
    const pct = parseFloat(percentageInput.replace(',', '.'));
    if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
      setError('Enter valid percentage (1–100)');
      return;
    }
    const name = categoryInput.trim();
    if (!name) {
      setError('Enter category name');
      return;
    }
    setError(null);
    const resolvedName = resolveCategoryName(name, getSynonymsMap());
    let cat = categories.find(c => c.name.toLowerCase() === resolvedName.toLowerCase());
    if (!cat) {
      cat = await createCategory(resolvedName);
    }
    setRows(prev => [...prev, { category_id: cat.id, category_name: cat.name, percentage: percentageInput }]);
    setCategoryInput('');
    setPercentageInput('');
  };

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) {
      setError('Add at least one category with percentage');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const row of rows) {
        const pct = parseFloat(row.percentage.replace(',', '.'));
        if (!Number.isNaN(pct)) {
          await saveCashbackEntry({
            bank_id: bankId,
            category_id: row.category_id,
            percentage: pct,
            month,
            year,
          });
        }
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs text-slate-500 mb-1">Category</label>
          <input
            type="text"
            value={categoryInput}
            onChange={e => setCategoryInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRow())}
            placeholder="e.g. Products"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            list="categories-datalist"
          />
          <datalist id="categories-datalist">
            {categories.map(c => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div className="w-20">
          <label className="block text-xs text-slate-500 mb-1">%</label>
          <input
            type="text"
            inputMode="decimal"
            value={percentageInput}
            onChange={e => setPercentageInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRow())}
            placeholder="5"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="button"
          onClick={addRow}
          className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition-colors"
        >
          Add
        </button>
      </div>

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li
              key={`${row.category_id}-${i}`}
              className="flex items-center justify-between py-2 px-3 bg-slate-800 rounded-lg"
            >
              <span className="text-slate-200">{row.category_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-indigo-400 font-medium tabular-nums">{row.percentage}%</span>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="p-1 text-slate-500 hover:text-red-400 rounded"
                  aria-label="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving || rows.length === 0}
        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
      >
        {saving ? 'Saving...' : 'Save cashback'}
      </button>
    </form>
  );
}
