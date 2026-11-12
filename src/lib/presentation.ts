const bankDefinitions = [
  { key: 'tbank', match: /^(t.?bank|т.?банк|тинькофф)/i },
  { key: 'yandex', match: /^(яндекс|yandex|y.?pay)/i },
  { key: 'ozon', match: /^(озон|ozon)/i },
  { key: 'sber', match: /^(сбер|sber)/i },
  { key: 'otp', match: /^(отп|otp)/i },
  { key: 'uralsib', match: /^(уралсиб|uralsib)/i },
  { key: 'alfa', match: /^(альфа|alfa|alpha)/i },
  { key: 'wb', match: /^(wb[\s-]*(?:банк|bank)|вб[\s-]*банк|вайлдберриз[\s-]*банк|wildberries[\s-]*(?:банк|bank))/i },
  { key: 'vtb', match: /^(втб|vtb)/i },
  { key: 'gazprom', match: /^(газпром|gazprom)/i },
  { key: 'mts', match: /^(мтс|mts)/i },
  { key: 'zenit', match: /^(зенит|zenit)/i },
];
export function bankKey(name: string) { return bankDefinitions.find(b => b.match.test(name.trim()))?.key; }
export function bankPriority(name: string) { const index = bankDefinitions.findIndex(b => b.match.test(name.trim())); return index < 0 ? bankDefinitions.length : index; }

// Specific categories are checked before broader categories, then sorted by this rank.
export function categoryKind(name: string): string {
  const n = name.toLocaleLowerCase('ru');
  if (/каршер|прокат авто/.test(n)) return 'carshare';
  if (/такси|taxi/.test(n)) return 'taxi';
  if (/поезд|железнодорож|ж\/д/.test(n)) return 'train';
  if (/достав|delivery/.test(n)) return 'delivery';
  if (/супермаркет|продукт|продовольств/.test(n)) return 'supermarket';
  if (/ресторан|кафе|бары|бар |питани/.test(n)) return 'restaurant';
  if (/аптек|pharma/.test(n)) return 'pharmacy';
  if (/транспорт|общественн.*транспорт/.test(n)) return 'transport';
  if (/кино|театр|развлеч|досуг|концерт/.test(n)) return 'entertainment';
  if (/одежд|обув|шопинг/.test(n)) return 'shopping';
  if (/азс|топлив|заправ/.test(n)) return 'fuel';
  if (/ювелир/.test(n)) return 'jewelry';
  if (/техник|электроник/.test(n)) return 'electronics';
  if (/дом|ремонт/.test(n)) return 'home';
  if (/цвет/.test(n)) return 'flowers';
  return 'other';
}
const categoryOrder = ['supermarket', 'restaurant', 'taxi', 'pharmacy', 'carshare', 'transport', 'train', 'delivery', 'entertainment'];
export function categoryPriority(name: string) { const i = categoryOrder.indexOf(categoryKind(name)); return i < 0 ? categoryOrder.length : i; }
export function rateClass(rate: number) { return rate < 5 ? 'rate-low' : rate === 5 ? 'rate-mid' : 'rate-high'; }

export function priorityCompare(a: number, b: number, order: number[]) { const ai = order.indexOf(a), bi = order.indexOf(b); return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi); }
