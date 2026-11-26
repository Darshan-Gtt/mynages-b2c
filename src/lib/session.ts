import { useSyncExternalStore } from 'react';
import { useDb } from './store';
import type { Member, Space } from './types';

const KEY = 'mynages.b2c.session';
const SPACE = 'mynages.b2c.space';
const listeners = new Set<() => void>();
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
let state = { user: read(KEY), space: (read(SPACE) as Space) || 'family' };
const emit = () => listeners.forEach((l) => l());
const sub = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function signIn(memberId: string) {
  state = { user: memberId, space: 'family' };
  try { localStorage.setItem(KEY, memberId); localStorage.setItem(SPACE, 'family'); } catch { /* ignore */ }
  emit();
}
export function signOut() {
  state = { ...state, user: null };
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  emit();
}
export function setSpace(space: Space) {
  state = { ...state, space };
  try { localStorage.setItem(SPACE, space); } catch { /* ignore */ }
  emit();
}
export const currentUserId = () => state.user ?? 'system';
export const currentSpace = () => state.space;

/** Signed-in member (owner or joined member). */
export function useMe(): Member | null {
  const s = useSyncExternalStore(sub, () => state);
  const db = useDb();
  const m = db.members.find((x) => x.id === s.user);
  return m && (m.state === 'self' || m.state === 'joined') ? m : null;
}
export const useSpace = (): Space => useSyncExternalStore(sub, () => state).space;
