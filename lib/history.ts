import { SearchParams } from './searchBuilder';

const HISTORY_KEY = 'xradar_history';
const MAX_HISTORY = 20;

export interface HistoryEntry {
  id: string;
  query: string;
  url: string;
  params: SearchParams;
  createdAt: string;
  label: string;
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSearch(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry {
  const history = getHistory();
  const newEntry: HistoryEntry = {
    ...entry,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  // Remove duplicates
  const filtered = history.filter((h) => h.query !== entry.query);
  const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return newEntry;
}

export function deleteSearch(id: string): HistoryEntry[] {
  const history = getHistory().filter((h) => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
