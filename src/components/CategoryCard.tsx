import type { CategorySummary } from '../lib/api';
import { BankIcon } from './BankIcon';

interface Props {
  summary: CategorySummary;
  onClick: () => void;
}

export function CategoryCard({ summary, onClick }: Props) {
  const pct = summary.max_percentage;
  const color =
    pct > 5 ? 'text-orange-400' :
    pct === 5 ? 'text-emerald-400' :
    pct > 1 ? 'text-amber-400' :
    'text-slate-400';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-slate-800 hover:bg-slate-750 active:bg-slate-700 rounded-2xl p-4 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-200 font-medium text-sm leading-tight truncate">
          {summary.category_name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-2xl font-bold tabular-nums ${color}`}>
            {pct % 1 === 0 ? pct : pct.toFixed(1)}%
          </span>
        </div>
      </div>
      <p className="mt-1 text-slate-500 text-xs truncate flex items-center gap-1.5">
        <BankIcon bankName={summary.bank_name} size="sm" />
        {summary.bank_name}
      </p>
    </button>
  );
}
