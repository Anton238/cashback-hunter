import { getThreeMonths, type MonthOption } from '../lib/months';

interface Props {
  value: MonthOption;
  onChange: (m: MonthOption) => void;
  className?: string;
}

export function MonthSelector({ value, onChange, className = '' }: Props) {
  const options = getThreeMonths();

  return (
    <div className={`flex gap-1 bg-slate-800 p-1 rounded-xl ${className}`}>
      {options.map((opt) => {
        const isActive = opt.month === value.month && opt.year === value.year;
        return (
          <button
            key={`${opt.year}-${opt.month}`}
            onClick={() => onChange(opt)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
