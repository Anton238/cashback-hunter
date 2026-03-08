import { useEffect, useState } from 'react';
import { apiCashback } from '../lib/api';
import type { CategorySummary } from '../lib/api';
import { useStore } from '../store';
import { BankIcon } from './BankIcon';

interface Props {
  summary: CategorySummary | null;
  month: number;
  year: number;
  onClose: () => void;
  onAddBank: () => void;
}

interface BankRow {
  id: number;
  percentage: number;
  bank_id: number;
  bank_name: string;
  photo_local_key: string | null;
}

export function CategoryModal({
  summary,
  month,
  year,
  onClose,
  onAddBank,
}: Props) {
  const [rows, setRows] = useState<BankRow[]>([]);
  const [loading, setLoading] = useState(!!summary);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const deleteCashbackEntry = useStore(s => s.deleteCashbackEntry);
  const updateCashbackEntry = useStore(s => s.updateCashbackEntry);

  useEffect(() => {
    if (!summary) return;
    setLoading(true);
    apiCashback
      .byCategory(summary.category_id, month, year)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [summary?.category_id, month, year]);

  const handleDelete = async (id: number) => {
    await deleteCashbackEntry(id);
    if (rows.length <= 1) {
      onClose();
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const startEdit = (row: BankRow) => {
    setEditingId(row.id);
    setEditValue(String(row.percentage));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const pct = parseFloat(editValue.replace(',', '.'));
    if (Number.isNaN(pct) || pct <= 0 || pct > 100) return;
    setSaving(true);
    try {
      await updateCashbackEntry(editingId, pct);
      setRows(prev => prev.map(r => r.id === editingId ? { ...r, percentage: pct } : r));
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  if (!summary) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            {summary.category_name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-lg"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : (
            <ul className="space-y-2">
              {rows
                .sort((a, b) => b.percentage - a.percentage)
                .map(row => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 py-2 px-3 bg-slate-800 rounded-xl"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <BankIcon bankName={row.bank_name} size="sm" />
                      <span className="text-slate-200 font-medium truncate">
                        {row.bank_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {editingId === row.id ? (
                        <>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-14 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-indigo-400 font-semibold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <span className="text-slate-400">%</span>
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={saving}
                            className="p-1 text-emerald-400 hover:text-emerald-300 rounded"
                            aria-label="Save"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="p-1 text-slate-500 hover:text-slate-300 rounded"
                            aria-label="Cancel"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="text-indigo-400 font-semibold tabular-nums hover:text-indigo-300"
                          >
                            {row.percentage}%
                          </button>
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="p-1 text-slate-500 hover:text-red-400 rounded"
                            aria-label="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={onAddBank}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors"
          >
            Add bank to category
          </button>
        </div>
      </div>
    </div>
  );
}
