import { useEffect, useState } from 'react';
import { BookUser, Check, ChevronDown, Loader2, Phone, Plus, Search, X } from 'lucide-react';
import { Sheet } from './Modal';
import { Field, Input } from './Form';
import { getDb, useDb } from '../../lib/store';
import { upsert } from '../../lib/actions';
import { readPhoneBook, type PhoneBook, type PhoneEntry } from '../../lib/phonebook';
import { cx, uid } from '../../lib/utils';
import type { Contact } from '../../lib/types';

const typeLabel = (t: string) => t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * Opens the phone's address book and lets the user pick ONE person.
 * Android app: live contacts (asks permission). Chrome on Android: system picker. Desktop: sample list.
 */
export function PhoneBookSheet({ onPick, onClose, title = 'Choose from phone book' }: { onPick: (p: PhoneEntry) => void; onClose: () => void; title?: string }) {
  const [book, setBook] = useState<PhoneBook | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    let live = true;
    readPhoneBook().then((b) => {
      if (!live) return;
      if (b.source === 'cancelled') { onClose(); return; }
      // The system picker already let the user choose: one person → use it straight away.
      if (b.source === 'picker' && b.list.length === 1) { onPick(b.list[0]); onClose(); return; }
      setBook(b);
    });
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const list = (book?.list ?? []).filter((p) => !q || `${p.name} ${p.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet open onClose={onClose} title={title} full>
      {!book ? <div className="empty"><Loader2 size={24} className="spinner" /><p className="small">Opening your phone book…</p></div>
        : book.source === 'denied' ? <div className="alert alert-warning small">Contacts permission was not given. Allow it in phone Settings → Apps → Mynages → Permissions → Contacts, then try again.</div>
        : book.source === 'error' ? <div className="alert alert-danger small">Couldn’t read the phone book{book.message ? ` (${book.message})` : ''}. Please try again.</div>
        : (
          <>
            <p className="xs muted" style={{ marginBottom: 8 }}>{book.source === 'device' ? `${book.list.length} contacts on this phone. Only the one you tap is saved in Mynages.` : book.source === 'picker' ? 'Contacts you shared — tap one.' : 'Sample address book — in the Android app this shows your real phone contacts.'}</p>
            {book.list.length > 8 && <label className="search-box" style={{ marginBottom: 8 }}><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number" aria-label="Search phone book" /></label>}
            <div className="action-list">
              {list.map((p) => (
                <button key={p.phone} type="button" className="action-item" onClick={() => { onPick(p); onClose(); }}>
                  <span className="icon-tile sm"><Phone size={15} /></span>
                  <span className="grow">{p.name}<em>{p.phone}</em></span>
                </button>
              ))}
              {!list.length && <p className="xs muted">No contacts found.</p>}
            </div>
          </>
        )}
    </Sheet>
  );
}

/** Small "From phone book" button that fills a name + number. */
export function PhoneBookButton({ onPick, label = 'From phone book' }: { onPick: (p: PhoneEntry) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-xs" onClick={() => setOpen(true)}><BookUser size={13} /> {label}</button>
      {open && <PhoneBookSheet onPick={onPick} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Saves a phone-book person as a Mynages contact (or returns the existing one with the same number). */
export function contactFromPhone(p: PhoneEntry, type: Contact['type']): string {
  const found = getDb().contacts.find((c) => c.phone === p.phone);
  if (found) return found.id;
  const id = uid('ct');
  upsert('contacts', { id, name: p.name, phone: p.phone, type, fromPhone: true });
  return id;
}

/**
 * Contact chooser used everywhere a contact is picked: saved Mynages contacts, the phone book, or a quick new one.
 * Value is a contact id.
 */
export function ContactSelect({ value, onChange, type = 'service_provider', label = 'Contact', invalid, prefer }: {
  value?: string; onChange: (id: string | undefined) => void; type?: Contact['type']; label?: string; invalid?: boolean; prefer?: Contact['type'][];
}) {
  const db = useDb();
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState(false);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [nn, setNn] = useState({ name: '', phone: '' });
  const [err, setErr] = useState<string>();
  const cur = db.contacts.find((c) => c.id === value);
  const rank = (c: Contact) => ((prefer ?? [type]).includes(c.type) ? 0 : 1);
  const list = db.contacts.filter((c) => !q || `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const done = (id?: string) => { onChange(id); setOpen(false); setAdding(false); setQ(''); };
  const saveNew = () => {
    const name = nn.name.trim();
    const phone = nn.phone.replace(/\D/g, '');
    if (name.length < 2 || !/\p{L}/u.test(name)) { setErr('Enter a name'); return; }
    if (phone.length < 6 || phone.length > 15) { setErr('Enter a valid phone number'); return; }
    const ex = getDb().contacts.find((c) => c.phone === phone);
    if (ex) { done(ex.id); return; }
    const id = uid('ct');
    upsert('contacts', { id, name, phone, type });
    setNn({ name: '', phone: '' }); setErr(undefined);
    done(id);
  };
  return (
    <>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" aria-label={label} aria-invalid={invalid || undefined} className={cx('select select-btn grow', invalid && 'invalid', !cur && 'placeholder')} onClick={() => setOpen(true)}>
          <span className="ellipsis">{cur ? `${cur.name} · ${cur.phone}` : 'Choose a contact'}</span><ChevronDown size={14} aria-hidden="true" />
        </button>
        {cur && <button type="button" className="icon-btn sm" aria-label={`Clear ${label}`} onClick={() => onChange(undefined)}><X size={15} /></button>}
      </div>
      {open && (
        <Sheet open onClose={() => setOpen(false)} title={label} subtitle="From your Mynages contacts or your phone book" full>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            <button type="button" className="btn btn-sm grow" onClick={() => setBook(true)}><BookUser size={14} /> From phone book</button>
            <button type="button" className="btn btn-sm grow" aria-pressed={adding} onClick={() => setAdding(!adding)}><Plus size={14} /> New contact</button>
          </div>
          {adding && (
            <div className="card pad stack-sm" style={{ marginBottom: 10 }}>
              <Field label="Name" required><Input aria-label="New contact name" maxLength={60} autoCapitalize="words" value={nn.name} onChange={(e) => { setNn({ ...nn, name: e.target.value }); setErr(undefined); }} placeholder="e.g. Ramesh — LIC agent" /></Field>
              <Field label="Phone" required><Input aria-label="New contact phone" inputMode="tel" maxLength={16} value={nn.phone} onChange={(e) => { setNn({ ...nn, phone: e.target.value.replace(/[^\d+ ]/g, '') }); setErr(undefined); }} placeholder="98765 43210" /></Field>
              {err && <span className="field-error" role="alert">{err}</span>}
              <button type="button" className="btn btn-primary btn-sm" onClick={saveNew}>Save & choose</button>
            </div>
          )}
          {db.contacts.length > 6 && <label className="search-box" style={{ marginBottom: 8 }}><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search saved contacts" aria-label="Search saved contacts" /></label>}
          <div className="action-list">
            {cur && <button type="button" className="action-item" onClick={() => done(undefined)}><span className="icon-tile sm"><X size={15} /></span><span className="grow">No contact</span></button>}
            {list.map((c) => (
              <button key={c.id} type="button" className={cx('action-item', c.id === value && 'on')} onClick={() => done(c.id)}>
                <span className="icon-tile sm"><Phone size={15} /></span>
                <span className="grow">{c.name}<em>{typeLabel(c.type)} · {c.phone}</em></span>
                {c.id === value && <Check size={16} />}
              </button>
            ))}
            {!list.length && <p className="xs muted">{q ? 'No match.' : 'No saved contacts yet — pick from your phone book or add a new one.'}</p>}
          </div>
        </Sheet>
      )}
      {book && <PhoneBookSheet onPick={(p) => done(contactFromPhone(p, type))} onClose={() => setBook(false)} />}
    </>
  );
}
