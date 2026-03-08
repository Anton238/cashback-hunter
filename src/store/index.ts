import { create } from 'zustand';
import type { Bank, Category, CashbackEntry, CategorySummary } from '../lib/api';
import { apiBanks, apiCategories, apiCashback, groupByCategory } from '../lib/api';
import { getDefaultMonth, type MonthOption } from '../lib/months';

interface AppState {
  // Выбранный месяц
  selectedMonth: MonthOption;
  setSelectedMonth: (m: MonthOption) => void;

  // Данные
  banks: Bank[];
  categories: Category[];
  cashbackEntries: CashbackEntry[];
  categorySummaries: CategorySummary[];

  // Загрузка
  loading: boolean;
  error: string | null;

  // Действия
  loadBanks: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadCashback: (month: number, year: number) => Promise<void>;
  refreshAll: () => Promise<void>;

  createBank: (name: string) => Promise<Bank>;
  updateBank: (id: number, data: Partial<Bank>) => Promise<void>;
  deleteBank: (id: number) => Promise<void>;

  createCategory: (name: string) => Promise<Category>;

  saveCashbackEntry: (data: {
    bank_id: number;
    category_id: number;
    percentage: number;
    month: number;
    year: number;
    photo_local_key?: string;
  }) => Promise<CashbackEntry>;

  updateCashbackEntry: (id: number, percentage: number, photoKey?: string) => Promise<void>;
  deleteCashbackEntry: (id: number) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  selectedMonth: getDefaultMonth(),
  setSelectedMonth: (m) => {
    set({ selectedMonth: m });
    get().loadCashback(m.month, m.year);
  },

  banks: [],
  categories: [],
  cashbackEntries: [],
  categorySummaries: [],
  loading: false,
  error: null,

  loadBanks: async () => {
    const banks = await apiBanks.list();
    set({ banks });
  },

  loadCategories: async () => {
    const categories = await apiCategories.list();
    set({ categories });
  },

  loadCashback: async (month, year) => {
    set({ loading: true, error: null });
    try {
      const entries = await apiCashback.list(month, year);
      const summaries = groupByCategory(entries);
      set({ cashbackEntries: entries, categorySummaries: summaries });
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  refreshAll: async () => {
    const { selectedMonth } = get();
    set({ loading: true, error: null });
    try {
      const [banks, categories, entries] = await Promise.all([
        apiBanks.list(),
        apiCategories.list(),
        apiCashback.list(selectedMonth.month, selectedMonth.year),
      ]);
      const summaries = groupByCategory(entries);
      set({ banks, categories, cashbackEntries: entries, categorySummaries: summaries });
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  createBank: async (name) => {
    const bank = await apiBanks.create(name);
    set(s => ({ banks: [...s.banks, bank].sort((a, b) => a.name.localeCompare(b.name)) }));
    return bank;
  },

  updateBank: async (id, data) => {
    const updated = await apiBanks.update(id, data);
    set(s => ({ banks: s.banks.map(b => b.id === id ? updated : b) }));
  },

  deleteBank: async (id) => {
    await apiBanks.delete(id);
    set(s => ({ banks: s.banks.filter(b => b.id !== id) }));
  },

  createCategory: async (name) => {
    const category = await apiCategories.create(name);
    set(s => ({
      categories: s.categories.some(c => c.id === category.id)
        ? s.categories
        : [...s.categories, category].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return category;
  },

  saveCashbackEntry: async (data) => {
    const entry = await apiCashback.create(data);
    await get().loadCashback(data.month, data.year);
    return entry;
  },

  updateCashbackEntry: async (id, percentage, photoKey) => {
    await apiCashback.update(id, percentage, photoKey);
    const { selectedMonth } = get();
    await get().loadCashback(selectedMonth.month, selectedMonth.year);
  },

  deleteCashbackEntry: async (id) => {
    await apiCashback.delete(id);
    const { selectedMonth } = get();
    await get().loadCashback(selectedMonth.month, selectedMonth.year);
    await get().loadCategories();
  },
}));
