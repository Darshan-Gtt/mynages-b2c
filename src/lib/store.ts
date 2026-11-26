import { useSyncExternalStore } from 'react';
import { createNewUserDb, createSampleDb, DB_VERSION } from '../data/seed';
import type { Db } from './types';

const KEY = 'mynages.b2c.db';
const listeners = new Set<() => void>();
let db: Db = load();

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Db;
      if (p.version === DB_VERSION) return p;
    }
  } catch { /* fall back */ }
  return createSampleDb();
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota */ } }
const emit = () => listeners.forEach((l) => l());

export const getDb = () => db;
export function setDb(fn: (d: Db) => Db) { db = fn(db); persist(); emit(); }
export function resetSample() { db = createSampleDb(); persist(); emit(); }
export function resetNewUser(name?: string, mobile?: string) { db = createNewUserDb(name, mobile); persist(); emit(); }
const sub = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) { db = load(); emit(); } });
export const useDb = (): Db => useSyncExternalStore(sub, () => db);
export function nextCode(d: Db, series: string): { code: string; counters: Db['counters'] } {
  const n = (d.counters[series] ?? 0) + 1;
  return { code: `${series}-${String(n).padStart(4, '0')}`, counters: { ...d.counters, [series]: n } };
}
persist();
