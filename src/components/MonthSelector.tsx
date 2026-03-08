import { getThreeMonths, type MonthOption } from '../lib/months';

interface Props {
  value: MonthOption;
  onChange: (m: MonthOption) => void;
  className?: string;
}

export function MonthSelector({ value, onChange, className = '' }: Props) {
  const options = getThreeMonths();

  return (
    <div className={`flex gap-0.5 bg-slate-200/90 p-0.5 rounded-lg ${className}`}>
      {options.map((opt) => {
        const isActive = opt.month === value.month && opt.year === value.year;
        return (
          <button
            key={`${opt.year}-${opt.month}`}
            onClick={() => onChange(opt)}
            className={`flex-1 py-1 px-2 rounded-md text-xs font-medium transition-all ${
              isActive
                ? 'bg-violet-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
