/**
 * Reads the phone's address book.
 * - Android app: Capacitor Contacts plugin (asks for the Contacts permission, then reads the live list).
 * - Phone browser with the Contact Picker API (Chrome on Android): the system picker, user chooses who to share.
 * - Anywhere else (desktop browser): a sample address book so the flow can still be tried.
 */
import { PHONE_CONTACTS } from '../data/seed';
import { isNativeApp } from './utils';

export interface PhoneEntry { name: string; phone: string }
export type PhoneBook =
  | { source: 'device' | 'picker' | 'sample'; list: PhoneEntry[] }
  | { source: 'denied' | 'cancelled' | 'error'; list: []; message?: string };

/** Keep digits; drop a leading country code / trunk zero for Indian numbers. */
export function normalisePhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

function tidy(list: PhoneEntry[]): PhoneEntry[] {
  const seen = new Set<string>();
  return list
    .map((x) => ({ name: x.name.trim() || x.phone, phone: normalisePhone(x.phone) }))
    .filter((x) => x.phone.length >= 6 && !seen.has(x.phone) && seen.add(x.phone))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type PickerContact = { name?: string[]; tel?: string[] };
type ContactsManager = { select: (props: string[], opts: { multiple: boolean }) => Promise<PickerContact[]> };

export const hasContactPicker = () => !isNativeApp() && 'contacts' in navigator && 'ContactsManager' in window;

export async function readPhoneBook(): Promise<PhoneBook> {
  if (isNativeApp()) {
    try {
      const { Contacts } = await import('@capacitor-community/contacts');
      let perm = await Contacts.checkPermissions();
      if (perm.contacts !== 'granted') perm = await Contacts.requestPermissions();
      if (perm.contacts !== 'granted') return { source: 'denied', list: [] };
      const res = await Contacts.getContacts({ projection: { name: true, phones: true } });
      const list: PhoneEntry[] = [];
      for (const c of res.contacts) for (const p of c.phones ?? []) if (p.number) list.push({ name: c.name?.display ?? [c.name?.given, c.name?.family].filter(Boolean).join(' ') ?? '', phone: p.number });
      return { source: 'device', list: tidy(list) };
    } catch (e) {
      return { source: 'error', list: [], message: e instanceof Error ? e.message : String(e) };
    }
  }
  if (hasContactPicker()) {
    try {
      const picked = await (navigator as unknown as { contacts: ContactsManager }).contacts.select(['name', 'tel'], { multiple: true });
      if (!picked.length) return { source: 'cancelled', list: [] };
      return { source: 'picker', list: tidy(picked.flatMap((c) => (c.tel ?? []).map((t) => ({ name: c.name?.[0] ?? '', phone: t })))) };
    } catch {
      return { source: 'cancelled', list: [] };
    }
  }
  return { source: 'sample', list: tidy(PHONE_CONTACTS) };
}
