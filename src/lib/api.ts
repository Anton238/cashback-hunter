import { API_BASE } from './constants';

// #region agent log
const _debugLog = (payload: Record<string, unknown>) => {
  fetch('http://127.0.0.1:7244/ingest/3e9386ca-8456-4709-acf2-45add08b0809', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, timestamp: Date.now(), location: 'api.ts' }),
  }).catch(() => {});
};
if (typeof API_BASE !== 'undefined') {
  _debugLog({ message: 'API_BASE at load', data: { API_BASE }, hypothesisId: 'H1' });
}
// #endregion

export interface Bank {
  id: number;
  name: string;
  updated_at: string | null;
}

export interface Category {
  id: number;
  name: string;
}

export interface CashbackEntry {
  id: number;
  bank_id: number;
  category_id: number;
  percentage: number;
  month: number;
  year: number;
  photo_local_key: string | null;
  created_at: string;
  bank_name: string;
  category_name: string;
}

export interface CategorySummary {
  category_id: number;
  category_name: string;
  max_percentage: number;
  bank_name: string;
  bank_id: number;
  entries: CashbackEntry[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  // #region agent log
  _debugLog({ message: 'request start', data: { url, path }, hypothesisId: 'H2' });
  // #endregion
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  // #region agent log
  const contentType = res.headers.get('Content-Type') ?? '';
  const looksLikeHtml = contentType.includes('text/html') || res.status === 200 && contentType.trim() === '';
  _debugLog({
    message: 'response',
    data: { status: res.status, ok: res.ok, contentType, looksLikeHtml },
    hypothesisId: looksLikeHtml ? 'H4' : 'H3',
  });
  // #endregion
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    // #region agent log
    _debugLog({
      message: 'parse error',
      data: { error: String(e), bodyPreview: text.slice(0, 120) },
      hypothesisId: 'H5',
    });
    // #endregion
    throw e;
  }
}

// Banks
export const apiBanks = {
  list: () => request<Bank[]>('/banks'),
  create: (name: string) => request<Bank>('/banks', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id: number, data: Partial<Bank>) => request<Bank>(`/banks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ success: boolean }>(`/banks/${id}`, { method: 'DELETE' }),
};

// Categories
export const apiCategories = {
  list: () => request<Category[]>('/categories'),
  create: (name: string) => request<Category>('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id: number, name: string) => request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  delete: (id: number) => request<{ success: boolean }>(`/categories/${id}`, { method: 'DELETE' }),
};

// Cashback
export const apiCashback = {
  list: (month: number, year: number) =>
    request<CashbackEntry[]>(`/cashback?month=${month}&year=${year}`),
  byCategory: (categoryId: number, month: number, year: number) =>
    request<{ id: number; percentage: number; bank_id: number; bank_name: string; photo_local_key: string | null }[]>(
      `/cashback/by-category/${categoryId}?month=${month}&year=${year}`
    ),
  create: (data: {
    bank_id: number;
    category_id: number;
    percentage: number;
    month: number;
    year: number;
    photo_local_key?: string;
  }) => request<CashbackEntry>('/cashback', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, percentage: number, photo_local_key?: string) =>
    request<CashbackEntry>(`/cashback/${id}`, { method: 'PUT', body: JSON.stringify({ percentage, photo_local_key }) }),
  delete: (id: number) =>
    request<{ success: boolean; categoryDeleted: boolean }>(`/cashback/${id}`, { method: 'DELETE' }),
};

// Push
export const apiPush = {
  getVapidKey: () => request<{ key: string }>('/push/vapid-public-key'),
  subscribe: (sub: PushSubscriptionJSON) =>
    request<{ success: boolean }>('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
  unsubscribe: (endpoint: string) =>
    request<{ success: boolean }>('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  scheduleToday: () => request<{ banks: string[] }>('/push/schedule/today'),
  schedule: () => request<{ day: number; banks: string[] }[]>('/push/schedule'),
};

// Группировка кэшбэков по категориям
export function groupByCategory(entries: CashbackEntry[]): CategorySummary[] {
  const map = new Map<number, CategorySummary>();

  for (const entry of entries) {
    const existing = map.get(entry.category_id);
    if (!existing) {
      map.set(entry.category_id, {
        category_id: entry.category_id,
        category_name: entry.category_name,
        max_percentage: entry.percentage,
        bank_name: entry.bank_name,
        bank_id: entry.bank_id,
        entries: [entry],
      });
    } else {
      existing.entries.push(entry);
      if (entry.percentage > existing.max_percentage) {
        existing.max_percentage = entry.percentage;
        existing.bank_name = entry.bank_name;
        existing.bank_id = entry.bank_id;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    b.max_percentage - a.max_percentage
  );
}
