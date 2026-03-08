export interface MonthOption {
  month: number;
  year: number;
  label: string;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function addMonths(date: Date, delta: number): { month: number; year: number } {
  const d = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export function getThreeMonths(): MonthOption[] {
  const now = new Date();
  const options: MonthOption[] = [-1, 0, 1].map((delta) => {
    const { month, year } = addMonths(now, delta);
    return { month, year, label: `${MONTH_NAMES[month - 1]} ${year}` };
  });
  return options;
}

export function getDefaultMonth(): MonthOption {
  const now = new Date();
  const day = now.getDate();
  // Если число > 25 — подставляется следующий месяц
  const delta = day > 25 ? 1 : 0;
  const { month, year } = addMonths(now, delta);
  return { month, year, label: `${MONTH_NAMES[month - 1]} ${year}` };
}

export function monthKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatMonthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
