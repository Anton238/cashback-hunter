export const ESSENTIAL_CATEGORIES = [
  'Все покупки',
  'Продукты',
  'Рестораны',
  'Транспорт',
  'Такси',
  'Аптеки',
  'АЗС',
  'Одежда',
] as const;

export function isEssentialCategory(
  categoryName: string,
  synonymsMap: Record<string, string[]>,
): boolean {
  const lower = categoryName.trim().toLowerCase();
  if (!lower) return false;
  for (const name of ESSENTIAL_CATEGORIES) {
    if (name.toLowerCase() === lower) return true;
    const keywords = CATEGORY_KEYWORD_MAP[name];
    if (keywords?.some(kw => lower.includes(kw) || kw.includes(lower))) return true;
  }
  const reversed = Object.entries(synonymsMap).find(([, syns]) =>
    syns.some(s => s.trim().toLowerCase() === lower),
  );
  if (reversed) {
    const canonical = reversed[0];
    return ESSENTIAL_CATEGORIES.some(n => n.toLowerCase() === canonical.toLowerCase());
  }
  return false;
}

export function essentialSortIndex(categoryName: string, synonymsMap: Record<string, string[]>): number {
  const lower = categoryName.trim().toLowerCase();
  if (!lower) return ESSENTIAL_CATEGORIES.length;
  for (let i = 0; i < ESSENTIAL_CATEGORIES.length; i++) {
    const name = ESSENTIAL_CATEGORIES[i];
    if (name.toLowerCase() === lower) return i;
    const keywords = CATEGORY_KEYWORD_MAP[name];
    if (keywords?.some(kw => lower.includes(kw) || kw.includes(lower))) return i;
  }
  const reversed = Object.entries(synonymsMap).find(([, syns]) =>
    syns.some(s => s.trim().toLowerCase() === lower),
  );
  if (reversed) {
    const canonical = reversed[0];
    const idx = ESSENTIAL_CATEGORIES.findIndex(n => n.toLowerCase() === canonical.toLowerCase());
    if (idx >= 0) return idx;
  }
  return ESSENTIAL_CATEGORIES.length;
}

export const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
  'Продукты': ['продукт', 'супермаркет', 'гипермаркет', 'магазин', 'продовол', 'food', 'grocery'],
  'АЗС': ['азс', 'бензин', 'топлив', 'заправ', 'нефть', 'gas', 'fuel'],
  'Рестораны': ['ресторан', 'кафе', 'кофе', 'фаст-фуд', 'фастфуд', 'пицц', 'суши', 'доставк', 'restaurant', 'cafe'],
  'Аптеки': ['аптек', 'лекарств', 'здоровь', 'pharmacy', 'drug'],
  'Транспорт': ['транспорт', 'метро', 'автобус', 'поезд', 'авиа', 'билет', 'transport'],
  'Такси': ['такси', 'taxi'],
  'Все покупки': ['все покупки', 'покупк'],
  'Кино': ['кино', 'театр', 'кинотеатр', 'cinema', 'movie'],
  'Одежда': ['одежд', 'обувь', 'одежды', 'fashion', 'cloth'],
};

export const BANK_PRIORITY: string[] = ['Tbank', 'Яндекс'];

export const DEFAULT_BANKS: { name: string; iconUrl: string }[] = [
  { name: 'Tbank', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/17/T-Bank_RU_logo.svg' },
  { name: 'Яндекс', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Yandex_icon.svg' },
  { name: 'Сбербанк', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Sberbank_Logo_2020.svg' },
  { name: 'Озон', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/39/Ozon_logo_clear.svg' },
  { name: 'Альфа', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Alfa_Bank_RU_logo.svg' },
  { name: 'ВТБ', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/VTB_Logo_2018.svg' },
  { name: 'Зенит', iconUrl: 'https://cdn.worldvectorlogo.com/logos/zenit-bank.svg' },
  { name: 'Газпром', iconUrl: 'https://upload.wikimedia.org/wikipedia/en/9/99/Gazprombank_en.svg' },
  { name: 'МТС', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/MTSBank_Logo_800px.png/120px-MTSBank_Logo_800px.png' },
  { name: 'Уралсиб', iconUrl: 'https://cdn.worldvectorlogo.com/logos/uralsib.svg' },
];

const BANK_ICON_MAP: Record<string, string> = Object.fromEntries(
  DEFAULT_BANKS.map(b => [b.name.toLowerCase().trim(), b.iconUrl]),
);

const BANK_NAME_ALIASES: Record<string, string> = {
  'тинькофф': 'tbank',
  'тинькофф банк': 'tbank',
  'tinkoff': 'tbank',
  'tinkoff bank': 'tbank',
  'сбер': 'сбербанк',
  'сбербанк россии': 'сбербанк',
  'газпромбанк': 'газпром',
  'мтс банк': 'мтс',
  'озон банк': 'озон',
};

export function getBankIconUrl(bankName: string): string | undefined {
  if (!bankName?.trim()) return undefined;
  const key = bankName.trim().toLowerCase();
  const normalized = BANK_NAME_ALIASES[key] ?? key;
  return BANK_ICON_MAP[normalized] ?? DEFAULT_BANKS.find(b => {
    const n = b.name.toLowerCase();
    return normalized.includes(n) || n.includes(normalized);
  })?.iconUrl;
}
