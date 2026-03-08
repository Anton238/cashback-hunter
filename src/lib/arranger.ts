import { essentialSortIndex, BANK_PRIORITY } from './constants';

export interface BankCategoryItem {
  category_id: number;
  category_name: string;
  percentage: number;
}

export function getBankPriority(bankName: string): number {
  const key = bankName.trim().toLowerCase();
  const idx = BANK_PRIORITY.findIndex(
    (p) => key === p.toLowerCase() || key.includes(p.toLowerCase()),
  );
  return idx >= 0 ? idx : 999;
}

export function runArranger(
  bankCategories: Map<number, BankCategoryItem[]>,
  bankLimits: Record<number, number>,
  bankNames: Record<number, string>,
  synonymsMap: Record<string, string[]>,
): Map<number, string[]> {
  const categoryToBanks = new Map<string, { bank_id: number; percentage: number; bankName: string }[]>();
  for (const [bankId, items] of bankCategories) {
    const name = bankNames[bankId] ?? '';
    for (const item of items) {
      const key = `${item.category_id}`;
      const existing = categoryToBanks.get(key);
      const entry = { bank_id: bankId, percentage: item.percentage, bankName: name };
      if (!existing) {
        categoryToBanks.set(key, [entry]);
      } else {
        existing.push(entry);
      }
    }
  }

  const categoryMeta = new Map<string, { category_id: number; category_name: string }>();
  for (const [, items] of bankCategories) {
    for (const item of items) {
      const key = `${item.category_id}`;
      if (!categoryMeta.has(key)) {
        categoryMeta.set(key, { category_id: item.category_id, category_name: item.category_name });
      }
    }
  }

  const sortedCategories = Array.from(categoryToBanks.keys()).sort((a, b) => {
    const metaA = categoryMeta.get(a)!;
    const metaB = categoryMeta.get(b)!;
    const idxA = essentialSortIndex(metaA.category_name, synonymsMap);
    const idxB = essentialSortIndex(metaB.category_name, synonymsMap);
    if (idxA !== idxB) return idxA - idxB;
    const maxPctA = Math.max(...categoryToBanks.get(a)!.map(x => x.percentage));
    const maxPctB = Math.max(...categoryToBanks.get(b)!.map(x => x.percentage));
    return maxPctB - maxPctA;
  });

  const remaining: Record<number, number> = { ...bankLimits };
  const result = new Map<number, string[]>();

  for (const key of sortedCategories) {
    const banksWithCategory = categoryToBanks.get(key)!.filter(b => (remaining[b.bank_id] ?? 0) > 0);
    if (banksWithCategory.length === 0) continue;
    banksWithCategory.sort((x, y) => {
      if (y.percentage !== x.percentage) return y.percentage - x.percentage;
      return getBankPriority(x.bankName) - getBankPriority(y.bankName);
    });
    const chosen = banksWithCategory[0];
    remaining[chosen.bank_id] = (remaining[chosen.bank_id] ?? 0) - 1;
    const meta = categoryMeta.get(key)!;
    const list = result.get(chosen.bank_id) ?? [];
    list.push(meta.category_name);
    result.set(chosen.bank_id, list);
  }

  return result;
}
