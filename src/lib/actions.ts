/**
 * Family domain operations. Every screen (Home, lists, Asset 360°, More) calls these, so one change shows up
 * everywhere — lists, 360°, timeline, Home tiles and reminders.
 */
import { getDb, nextCode, setDb } from './store';
import { currentUserId } from './session';
import { addDays, addMonths, fmt12, fmtDate, today, uid } from './utils';
import { reminderAt } from './compute';
import { entitlement } from './access';
import { PLANS, planOf } from '../data/masters';
import type { Asset, Coverage, ReminderPreset, Db, Doc, Event, Expense, Member, Notification, Obligation, Recurrence, ServiceLog, Space, Subscription, Task } from './types';

export class ActionError extends Error {}
const now = () => new Date().toISOString();
const me = () => currentUserId();
const name = (d: Db, id?: string) => d.members.find((m) => m.id === id)?.name.split(' ')[0] ?? 'Someone';

export function withEvent(d: Db, e: Omit<Event, 'id' | 'at' | 'by'> & { by?: string }): Db {
  return { ...d, events: [{ id: uid('ev'), at: now(), by: e.by ?? me(), ...e }, ...d.events].slice(0, 1000) };
}
function notify(d: Db, userId: string | 'all', text: string, link: string | undefined, kind: Notification['kind'], id?: string): Db {
  if (id && d.notifications.some((n) => n.id === id)) return d;
  return { ...d, notifications: [{ id: id ?? uid('nt'), userId, text, link, at: now(), read: false, kind }, ...d.notifications].slice(0, 300) };
}
function guardWrite(d: Db) {
  const g = entitlement(d, 'write');
  if (!g.ok) throw new ActionError(g.reason);
}
const ownerOf = <T extends { space: Space; privateOwnerId?: string }>(x: T) => (x.space === 'private' ? { space: 'private' as Space, privateOwnerId: x.privateOwnerId } : { space: 'family' as Space, privateOwnerId: undefined });

export function nextOccurrence(date: string, r: Recurrence) {
  return r === 'monthly' ? addMonths(date, 1) : r === 'quarterly' ? addMonths(date, 3) : r === 'half_yearly' ? addMonths(date, 6) : r === 'yearly' ? addMonths(date, 12) : null;
}
/** Next occurrence of a repeating task / reminder, including user-picked custom dates. */
function nextOf(x: { dueDate: string; dueTime?: string; recurrence: Recurrence; customDates?: string[] }): Partial<Obligation & Task> | null {
  if (x.recurrence === 'custom') {
    const cur = `${x.dueDate}T${x.dueTime ?? '00:00'}`;
    const rest = (x.customDates ?? []).filter((d) => d > cur).sort();
    if (!rest.length) return null;
    const [d, t] = rest[0].split('T');
    return { dueDate: d, dueTime: t, customDates: rest.slice(1), recurrence: rest.length > 1 ? 'custom' : 'none' };
  }
  const nd = nextOccurrence(x.dueDate, x.recurrence);
  return nd ? { dueDate: nd } : null;
}

/** Generic upsert/delete for simple records (contacts, properties, schedules…). */
export function upsert<K extends keyof Db>(key: K, row: Db[K] extends Array<infer T> ? T & { id: string } : never) {
  setDb((d) => {
    const list = d[key] as unknown as { id: string }[];
    return { ...d, [key]: list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [row, ...list] } as Db;
  });
}
export function removeRow<K extends keyof Db>(key: K, id: string) {
  setDb((d) => ({ ...d, [key]: (d[key] as unknown as { id: string }[]).filter((x) => x.id !== id) } as Db));
}

// ---------------- assets ----------------
/** Duplicate guard (PRD §4.1 rule 7, AC-17): same category, name and serial / registration as an existing family item. */
export function findDuplicate(d: Db, a: Partial<Asset>) {
  const key = (x: Partial<Asset>) => String(x.serialNo || x.fields?.registration_number || x.fields?.imei || '').trim().toLowerCase();
  return d.assets.find((x) => x.id !== a.id && !x.archived && x.space === 'family' && x.categoryId === a.categoryId && (x.name.trim().toLowerCase() === a.name?.trim().toLowerCase() || (key(a) && key(x) === key(a))));
}

export function saveAsset(a: Asset, isNew: boolean): Asset {
  const d0 = getDb();
  guardWrite(d0);
  if (isNew) { const g = entitlement(d0, 'asset'); if (!g.ok) throw new ActionError(g.reason); }
  let saved = a;
  setDb((d) => {
    let next = d;
    if (isNew) {
      const { code, counters } = nextCode(d, 'AST');
      saved = { ...a, id: uid('a'), code, createdBy: me(), createdAt: now() };
      next = { ...next, counters, assets: [saved, ...next.assets] };
      next = withEvent(next, { assetId: saved.id, type: 'created', text: `Added ${saved.name}`, ...ownerOf(saved) });
    } else {
      const old = d.assets.find((x) => x.id === a.id)!;
      saved = { ...a, updatedBy: me(), updatedAt: now() };
      next = { ...next, assets: next.assets.map((x) => (x.id === a.id ? saved : x)) };
      const changed = (['name', 'ownerMemberId', 'propertyId', 'purchaseCost', 'purchaseDate', 'serialNo'] as const).filter((k) => old[k] !== saved[k]);
      if (JSON.stringify(old.fields) !== JSON.stringify(saved.fields)) changed.push('fields' as never);
      next = withEvent(next, { assetId: a.id, type: 'updated', text: `Updated ${changed.length ? changed.map((c) => String(c).replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ') : 'details'}`, ...ownerOf(saved) });
    }
    return next;
  });
  return saved;
}

export function changeStatus(assetId: string, statusId: string, reason: string, notes?: string) {
  setDb((d) => {
    guardWrite(d);
    const a = d.assets.find((x) => x.id === assetId)!;
    const from = d.statuses.find((s) => s.id === a.statusId)?.name;
    const to = d.statuses.find((s) => s.id === statusId)?.name;
    let next: Db = { ...d, assets: d.assets.map((x) => (x.id === assetId ? { ...x, statusId, updatedAt: now(), updatedBy: me() } : x)) };
    next = withEvent(next, { assetId, type: 'status', text: `Status ${from} → ${to}`, reason: `${reason}${notes ? ` — ${notes}` : ''}`, ...ownerOf(a) });
    if (a.space === 'family') next = notify(next, 'all', `${name(d, me())} marked ${a.name} as ${to}`, `/assets/${a.id}`, 'system');
    return next;
  });
}

export function archiveAsset(id: string, archived: boolean) {
  setDb((d) => {
    const a = d.assets.find((x) => x.id === id)!;
    return withEvent({ ...d, assets: d.assets.map((x) => (x.id === id ? { ...x, archived } : x)) }, { assetId: id, type: 'archive', text: archived ? 'Archived — hidden from lists, history kept' : 'Restored from archive', ...ownerOf(a) });
  });
}

export function deleteAsset(id: string) {
  setDb((d) => {
    const keep = <T extends { assetId?: string }>(xs: T[]) => xs.filter((x) => x.assetId !== id);
    return {
      ...d, assets: d.assets.filter((x) => x.id !== id), valuations: keep(d.valuations), coverages: keep(d.coverages), obligations: keep(d.obligations), tasks: keep(d.tasks),
      docs: d.docs.filter((x) => !(x.ownerType === 'asset' && x.ownerId === id)), assetContacts: keep(d.assetContacts), schedules: keep(d.schedules), services: keep(d.services),
      expenses: keep(d.expenses), events: d.events.filter((e) => e.assetId !== id),
    };
  });
}

/** Move between family and private space (PRD §4.1 rule 4) — linked records move with it, and the move is logged. */
export function moveSpace(assetId: string, to: Space) {
  setDb((d) => {
    guardWrite(d);
    const a = d.assets.find((x) => x.id === assetId)!;
    const o = to === 'private' ? { space: 'private' as Space, privateOwnerId: me() } : { space: 'family' as Space, privateOwnerId: undefined };
    const mv = <T extends { assetId?: string; space: Space; privateOwnerId?: string }>(xs: T[]) => xs.map((x) => (x.assetId === assetId ? { ...x, ...o } : x));
    let next: Db = {
      ...d, assets: d.assets.map((x) => (x.id === assetId ? { ...x, ...o } : x)), coverages: mv(d.coverages), obligations: mv(d.obligations), tasks: mv(d.tasks),
      docs: d.docs.map((x) => (x.ownerType === 'asset' && x.ownerId === assetId ? { ...x, ...o } : x)), events: d.events.map((e) => (e.assetId === assetId ? { ...e, ...o } : e)),
    };
    next = withEvent(next, { assetId, type: 'space', text: to === 'private' ? `Moved to ${name(d, me())}'s private space` : 'Moved to the family workspace', ...o });
    if (to === 'family') next = notify(next, 'all', `${name(d, me())} shared ${a.name} with the family`, `/assets/${a.id}`, 'share');
    return next;
  });
}

export function saveValuation(assetId: string, date: string, value: number, note?: string) {
  if (!(value > 0)) throw new ActionError('Enter a value above zero');
  setDb((d) => {
    const a = d.assets.find((x) => x.id === assetId)!;
    return withEvent({ ...d, valuations: [{ id: uid('val'), assetId, date, value, note, by: me() }, ...d.valuations] }, { assetId, type: 'value', text: `Value updated to ₹${value.toLocaleString('en-IN')} (as of ${fmtDate(date)})`, reason: note, ...ownerOf(a) });
  });
}

// ---------------- coverage ----------------
/** Finds (or creates) the preset "N days before, at HH:mm". */
export function presetFor(d: Db, days: number, time: string): { db: Db; id: string } {
  const mins = days * 1440;
  const hit = d.presets.find((p) => p.minutesBefore === mins && (p.atTime ?? '09:00') === time);
  if (hit) return { db: d, id: hit.id };
  const p: ReminderPreset = { id: `rp_c${uid('')}`, label: `${days} day${days === 1 ? '' : 's'} before, ${fmt12(time)}`, minutesBefore: mins, atTime: time };
  return { db: { ...d, presets: [...d.presets, p].sort((a, b) => a.minutesBefore - b.minutesBefore) }, id: p.id };
}

export function saveCoverage(c: Coverage, makeReminder: boolean | { days: number; time: string }) {
  if (c.endDate < c.startDate) throw new ActionError('End date must be after the start date');
  if (c.linkedType === 'member' && !c.insured.length) throw new ActionError('Choose at least one insured family member');
  setDb((d) => {
    guardWrite(d);
    const isNew = !d.coverages.some((x) => x.id === c.id);
    let next: Db = { ...d, coverages: isNew ? [c, ...d.coverages] : d.coverages.map((x) => (x.id === c.id ? c : x)) };
    const a = d.assets.find((x) => x.id === c.assetId);
    const label = c.kind === 'insurance' ? `${c.policyType} insurance` : c.kind === 'amc' ? 'AMC' : 'warranty';
    const linked = next.obligations.find((o) => o.coverageId === c.id && o.status === 'open');
    if (linked) next = { ...next, obligations: next.obligations.map((o) => (o.id === linked.id ? { ...o, dueDate: c.endDate, amount: c.premium ?? o.amount } : o)) };
    else if (makeReminder) {
      let rem = c.kind === 'insurance' ? ['rp_30d', 'rp_15d', 'rp_7d'] : ['rp_15d', 'rp_7d'];
      let dueTime: string | undefined;
      if (typeof makeReminder === 'object') { const r = presetFor(next, makeReminder.days, makeReminder.time); next = r.db; rem = [r.id]; dueTime = makeReminder.time; }
      const title = c.kind === 'warranty' || c.kind === 'extended_warranty' ? `Warranty expiry — ${a?.name}` : c.kind === 'amc' ? `Renew AMC — ${a?.name}` : `Renew ${c.policyType} insurance — ${a?.name ?? c.insured.map((i) => name(d, i.memberId)).join(', ')}`;
      next = { ...next, obligations: [{ id: uid('ob'), title, type: c.kind === 'insurance' ? 'insurance_premium' : c.kind === 'amc' ? 'amc_renewal' : 'warranty_expiry', assetId: c.assetId, memberId: c.insured[0]?.memberId, coverageId: c.id, amount: c.kind === 'warranty' ? undefined : c.premium, dueDate: c.endDate, dueTime, recurrence: c.kind === 'insurance' && c.premiumFrequency && c.premiumFrequency !== 'single' ? (c.premiumFrequency as Recurrence) : 'none', autoRenew: false, reminders: rem, contactId: c.agentContactId ?? c.providerContactId, status: 'open', ...ownerOf(c), createdBy: me(), createdAt: now() } as Obligation, ...next.obligations] };
    }
    next = withEvent(next, { assetId: c.assetId, type: 'coverage', text: `${isNew ? 'Added' : 'Updated'} ${label} ${c.number} (till ${fmtDate(c.endDate)})`, ...ownerOf(c) });
    return next;
  });
}

export function renewCoverage(oldId: string, r: { number: string; startDate: string; endDate: string; premium?: number; sumInsured?: number }) {
  const old = getDb().coverages.find((c) => c.id === oldId)!;
  const fresh: Coverage = { ...old, ...r, id: uid('cov'), supersededById: undefined, createdAt: now(), createdBy: me() };
  setDb((d) => ({
    ...d,
    coverages: d.coverages.map((c) => (c.id === oldId ? { ...c, supersededById: fresh.id } : c)),
    obligations: d.obligations.map((o) => (o.coverageId === oldId && o.status === 'open' ? { ...o, status: 'completed', completedAt: now(), completedBy: me() } : o)),
    expenses: r.premium && old.assetId ? [{ id: uid('ex'), assetId: old.assetId, date: today(), type: old.kind === 'amc' ? 'AMC' : 'Insurance', amount: r.premium, paidBy: me(), notes: `Renewed ${r.number}`, createdBy: me() }, ...d.expenses] : d.expenses,
  }));
  saveCoverage(fresh, true);
}

export function deleteCoverage(id: string) {
  setDb((d) => {
    const c = d.coverages.find((x) => x.id === id)!;
    return withEvent({ ...d, coverages: d.coverages.filter((x) => x.id !== id).map((x) => (x.supersededById === id ? { ...x, supersededById: undefined } : x)), obligations: d.obligations.filter((o) => !(o.coverageId === id && o.status === 'open')) }, { assetId: c.assetId, type: 'coverage', text: `Deleted ${c.number}`, ...ownerOf(c) });
  });
}

// ---------------- profile ----------------
/** Change a member's verified mobile (after OTP). Sign-in, invites and WhatsApp reminders all use the new number. */
export function changeMobile(memberId: string, dial: string, mobile: string) {
  setDb((d) => {
    const clash = d.members.find((m) => m.id !== memberId && m.mobile === mobile && (m.dial ?? '91') === dial && m.state !== 'removed');
    if (clash) throw new ActionError(`This number is already used by ${clash.name.split(' ')[0]} in your family`);
    const m = d.members.find((x) => x.id === memberId)!;
    const next: Db = { ...d, members: d.members.map((x) => (x.id === memberId ? { ...x, mobile, dial } : x)) };
    return notify(next, 'all', `${m.name.split(' ')[0]} changed their mobile number to +${dial} ${mobile.slice(0, 2)}••••••${mobile.slice(-2)}`, '/more/family', 'system');
  });
}

// ---------------- obligations ----------------
export function saveObligation(o: Obligation) {
  if (!o.title.trim()) throw new ActionError('Title is required');
  setDb((d) => {
    guardWrite(d);
    const isNew = !d.obligations.some((x) => x.id === o.id);
    let next: Db = { ...d, obligations: isNew ? [o, ...d.obligations] : d.obligations.map((x) => (x.id === o.id ? o : x)) };
    next = withEvent(next, { assetId: o.assetId, type: 'reminder', text: `${isNew ? 'Reminder added' : 'Reminder updated'}: ${o.title} · due ${fmtDate(o.dueDate)}`, ...ownerOf(o) });
    return next;
  });
}

/** "Mark paid / renewed" closes this occurrence, records the expense and creates the next one (PRD §8.2). */
export function completeObligation(id: string, paidOn: string, amount?: number, note?: string) {
  let created: Obligation | null = null;
  setDb((d) => {
    guardWrite(d);
    const o = d.obligations.find((x) => x.id === id)!;
    let next: Db = { ...d, obligations: d.obligations.map((x) => (x.id === id ? { ...x, status: 'completed', completedAt: `${paidOn}T10:00:00`, completedBy: me(), amount: amount ?? x.amount } : x)), notifications: d.notifications.filter((n) => !n.id.startsWith(`rem_${id}`)) };
    if (amount && o.assetId) next = { ...next, expenses: [{ id: uid('ex'), assetId: o.assetId, date: paidOn, type: o.type === 'insurance_premium' ? 'Insurance' : o.type === 'tax' ? 'Tax' : o.type === 'amc_renewal' ? 'AMC' : o.type === 'subscription_renewal' ? 'Subscription' : o.type === 'bill' ? 'Bills' : 'Other', amount, paidBy: me(), notes: o.title, createdBy: me() }, ...next.expenses] };
    const nd = nextOf(o);
    if (nd) { created = { ...o, ...nd, id: uid('ob'), status: 'open', completedAt: undefined, completedBy: undefined, snoozedUntil: undefined, createdAt: now() }; next = { ...next, obligations: [created, ...next.obligations] }; }
    return withEvent(next, { assetId: o.assetId, type: 'reminder', text: `${o.title} marked paid / renewed on ${fmtDate(paidOn)}`, reason: note, ...ownerOf(o) });
  });
  return created as Obligation | null;
}
export function cancelObligation(id: string) {
  setDb((d) => {
    const o = d.obligations.find((x) => x.id === id)!;
    return withEvent({ ...d, obligations: d.obligations.map((x) => (x.id === id ? { ...x, status: 'cancelled' } : x)), notifications: d.notifications.filter((n) => !n.id.startsWith(`rem_${id}`)) }, { assetId: o.assetId, type: 'reminder', text: `${o.title} cancelled — reminders stopped`, ...ownerOf(o) });
  });
}
export function snooze(id: string, until: string) {
  setDb((d) => ({ ...d, obligations: d.obligations.map((x) => (x.id === id ? { ...x, snoozedUntil: until } : x)), notifications: d.notifications.map((n) => (n.id.startsWith(`rem_${id}`) ? { ...n, read: true } : n)) }));
}

// ---------------- tasks ----------------
export function saveTask(t: Task) {
  if (!t.title.trim()) throw new ActionError('Title is required');
  setDb((d) => {
    guardWrite(d);
    const old = d.tasks.find((x) => x.id === t.id);
    const assignee = d.members.find((m) => m.id === t.assigneeId);
    if (t.space === 'private' && t.assigneeId !== t.privateOwnerId) throw new ActionError('Private tasks can only be assigned to yourself');
    let next: Db = { ...d, tasks: old ? d.tasks.map((x) => (x.id === t.id ? t : x)) : [t, ...d.tasks] };
    if (t.assigneeId !== me() && (!old || old.assigneeId !== t.assigneeId) && assignee && (assignee.state === 'joined' || assignee.state === 'self')) next = notify(next, t.assigneeId, `${name(d, me())} assigned you: ${t.title}`, '/tasks', 'assignment');
    return withEvent(next, { assetId: t.assetId, type: 'task', text: `${old ? 'Task updated' : 'Task added'}: ${t.title} → ${assignee?.name.split(' ')[0]}`, ...ownerOf(t) });
  });
}
export function setTaskStatus(id: string, status: Task['status']) {
  setDb((d) => {
    const t = d.tasks.find((x) => x.id === id)!;
    const done = status === 'done';
    let next: Db = { ...d, tasks: d.tasks.map((x) => (x.id === id ? { ...x, status, completedAt: done ? now() : undefined, completedBy: done ? me() : undefined } : x)), notifications: done || status === 'cancelled' ? d.notifications.filter((n) => !n.id.startsWith(`rem_${id}`)) : d.notifications };
    if (done) {
      const nd = nextOf(t);
      if (nd) next = { ...next, tasks: [{ ...t, ...nd, id: uid('t'), status: 'pending', completedAt: undefined, completedBy: undefined, createdAt: now() }, ...next.tasks] };
      if (t.createdBy !== me()) next = notify(next, t.createdBy, `${name(d, me())} completed: ${t.title}`, '/tasks', 'assignment');
    }
    return withEvent(next, { assetId: t.assetId, type: 'task', text: `Task “${t.title}” → ${status.replace('_', ' ')}`, ...ownerOf(t) });
  });
}

// ---------------- documents ----------------
export function saveDoc(doc: Doc) {
  if (!doc.title.trim()) throw new ActionError('Title is required');
  if (!doc.ownerId) throw new ActionError('Every document belongs to an asset or a family member');
  setDb((d) => {
    guardWrite(d);
    const isNew = !d.docs.some((x) => x.id === doc.id);
    let next: Db = { ...d, docs: isNew ? [doc, ...d.docs] : d.docs.map((x) => (x.id === doc.id ? doc : x)) };
    if (isNew && doc.expiryDate) next = { ...next, obligations: [{ id: uid('ob'), title: `${doc.title} expires${doc.ownerType === 'member' ? ` — ${name(d, doc.ownerId)}` : ''}`, type: 'registration', docId: doc.id, assetId: doc.ownerType === 'asset' ? doc.ownerId : undefined, memberId: doc.ownerType === 'member' ? doc.ownerId : undefined, dueDate: doc.expiryDate, recurrence: 'none', autoRenew: false, reminders: ['rp_30d', 'rp_7d'], status: 'open', ...ownerOf(doc), createdBy: me(), createdAt: now() } as Obligation, ...next.obligations] };
    return withEvent(next, { assetId: doc.ownerType === 'asset' ? doc.ownerId : undefined, type: 'document', text: `${isNew ? 'Document added' : 'Document updated'}: ${doc.title}${doc.ownerType === 'member' ? ` (${name(d, doc.ownerId)})` : ''}`, ...ownerOf(doc) });
  });
}
export function deleteDoc(id: string) {
  setDb((d) => {
    const doc = d.docs.find((x) => x.id === id)!;
    // Its own expiry reminder goes with it; the asset / person it belonged to is not touched.
    const obligations = d.obligations.map((o) => (o.docId === id && o.status === 'open' ? { ...o, status: 'cancelled' as const } : o));
    return withEvent({ ...d, docs: d.docs.filter((x) => x.id !== id), obligations }, { assetId: doc.ownerType === 'asset' ? doc.ownerId : undefined, type: 'document', text: `Document deleted: ${doc.title}`, ...ownerOf(doc) });
  });
}

// ---------------- service & money ----------------
export function saveService(s: ServiceLog) {
  if (!s.workDone.trim()) throw new ActionError('Describe the work done');
  setDb((d) => {
    guardWrite(d);
    const a = d.assets.find((x) => x.id === s.assetId)!;
    const isNew = !d.services.some((x) => x.id === s.id);
    let next: Db = { ...d, services: isNew ? [s, ...d.services] : d.services.map((x) => (x.id === s.id ? s : x)), expenses: d.expenses.filter((e) => e.ref !== `SRV:${s.id}`) };
    if (s.cost > 0) next = { ...next, expenses: [{ id: uid('ex'), assetId: s.assetId, date: s.date, type: 'Service', amount: s.cost, paidBy: me(), ref: `SRV:${s.id}`, createdBy: me() } as Expense, ...next.expenses] };
    if (isNew && s.scheduleId) next = { ...next, schedules: next.schedules.map((x) => (x.id === s.scheduleId ? { ...x, nextDue: addDays(s.date, x.intervalDays) } : x)) };
    return withEvent(next, { assetId: s.assetId, type: 'service', text: `Service logged: ${s.workDone}`, reason: s.cost ? `₹${s.cost.toLocaleString('en-IN')}` : undefined, ...ownerOf(a) });
  });
}
export function deleteService(id: string) {
  setDb((d) => ({ ...d, services: d.services.filter((x) => x.id !== id), expenses: d.expenses.filter((e) => e.ref !== `SRV:${id}`) }));
}
export function saveExpense(e: Expense) {
  if (!(e.amount > 0)) throw new ActionError('Amount must be more than zero');
  setDb((d) => {
    guardWrite(d);
    const a = d.assets.find((x) => x.id === e.assetId)!;
    const isNew = !d.expenses.some((x) => x.id === e.id);
    return withEvent({ ...d, expenses: isNew ? [e, ...d.expenses] : d.expenses.map((x) => (x.id === e.id ? e : x)) }, { assetId: e.assetId, type: 'expense', text: `Expense ${isNew ? 'added' : 'updated'}: ${e.type} ₹${e.amount.toLocaleString('en-IN')} · paid by ${name(d, e.paidBy)}`, ...ownerOf(a) });
  });
}

// ---------------- contacts ----------------
export function mapContact(assetId: string, contactId: string, purpose: string) {
  if (!purpose.trim()) throw new ActionError('Add a purpose, e.g. “Repair: RO technician”');
  setDb((d) => {
    const a = d.assets.find((x) => x.id === assetId)!;
    return withEvent({ ...d, assetContacts: [{ id: uid('ac'), assetId, contactId, purpose }, ...d.assetContacts] }, { assetId, type: 'contact', text: `Contact mapped — ${purpose}: ${d.contacts.find((c) => c.id === contactId)?.name}`, ...ownerOf(a) });
  });
}

// ---------------- family ----------------
export function saveMember(m: Member) {
  setDb((d) => {
    const isNew = !d.members.some((x) => x.id === m.id);
    let next: Db = { ...d, members: isNew ? [...d.members, m] : d.members.map((x) => (x.id === m.id ? m : x)) };
    return withEvent(next, { type: 'family', text: isNew ? `${m.name} added as a family profile` : `${m.name}’s profile updated`, space: 'family' });
  });
}

/** Invite by mobile (PRD §4.3): plan check first, then WhatsApp / SMS with a 7-day link. */
export function inviteMember(memberId: string, channel: 'whatsapp' | 'sms', role: 'adult' | 'view_only') {
  const d0 = getDb();
  const g = entitlement(d0, 'member');
  if (!g.ok) throw new ActionError(g.reason);
  const m = d0.members.find((x) => x.id === memberId)!;
  if (!m.mobile || ((m.dial ?? '91') === '91' ? !/^[6-9]\d{9}$/.test(m.mobile) : !/^\d{6,12}$/.test(m.mobile))) throw new ActionError('Add a valid mobile number to send an invite');
  if (d0.members.some((x) => x.id !== memberId && x.mobile === m.mobile && (x.state === 'joined' || x.state === 'self' || x.state === 'invited'))) throw new ActionError('Someone in the family already uses this mobile number');
  setDb((d) => {
    let next: Db = { ...d, members: d.members.map((x) => (x.id === memberId ? { ...x, state: 'invited', role, invitedAt: now(), inviteExpiresAt: addDays(today(), 7), inviteChannel: channel } : x)) };
    return withEvent(next, { type: 'family', text: `Invite sent to ${m.name} on ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`, space: 'family' });
  });
}
export function cancelInvite(memberId: string) {
  setDb((d) => ({ ...d, members: d.members.map((x) => (x.id === memberId ? { ...x, state: 'profile', invitedAt: undefined, inviteExpiresAt: undefined } : x)) }));
}
/** Simulates the invitee accepting on their phone. */
export function acceptInvite(memberId: string, accept: boolean) {
  setDb((d) => {
    const m = d.members.find((x) => x.id === memberId)!;
    let next: Db = { ...d, members: d.members.map((x) => (x.id === memberId ? { ...x, state: accept ? 'joined' : 'declined', joinedAt: accept ? now() : undefined } : x)) };
    next = withEvent(next, { type: 'family', by: memberId, text: accept ? `${m.name} joined the family (${m.role === 'adult' ? 'adult member' : 'view-only'})` : `${m.name} declined the invite`, space: 'family' });
    return notify(next, d.settings.ownerId, accept ? `${m.name.split(' ')[0]} accepted your invite and joined ${d.settings.familyName}` : `${m.name.split(' ')[0]} declined your invite`, '/more/family', 'invite');
  });
}
export function setRole(memberId: string, role: 'adult' | 'view_only') {
  setDb((d) => withEvent({ ...d, members: d.members.map((x) => (x.id === memberId ? { ...x, role } : x)) }, { type: 'family', text: `${name(d, memberId)} is now ${role === 'adult' ? 'an adult member' : 'view-only'}`, space: 'family' }));
}
/** Removing never deletes family items; the member's private items stay with them (PRD §5.4). */
export function removeMember(memberId: string) {
  setDb((d) => withEvent({ ...d, members: d.members.map((x) => (x.id === memberId ? { ...x, state: 'removed' } : x)) }, { type: 'family', text: `${name(d, memberId)} was removed from the family`, space: 'family' }));
}

// ---------------- subscription ----------------
const price = (planId: string, cycle: 'monthly' | 'yearly') => { const p = planOf(planId); return cycle === 'monthly' ? p.monthly : p.yearly; };
function invoice(d: Db, sub: Subscription, status: 'paid' | 'failed' = 'paid') {
  const amt = price(sub.planId, sub.cycle);
  const { code, counters } = nextCode(d, 'MYN-INV');
  return { inv: { no: code, date: today(), planId: sub.planId, cycle: sub.cycle, amount: amt, gst: Math.round(amt * 0.18), status, method: sub.method.split(' · ')[0] }, counters };
}
/** Upgrades apply now; downgrades at period end and never delete data (PRD §10.3). */
export function changePlan(planId: Subscription['planId'], cycle: Subscription['cycle']) {
  setDb((d) => {
    const s = d.subscription;
    const rank = (id: string) => PLANS.findIndex((p) => p.id === id);
    if (rank(planId) >= rank(s.planId) || s.status === 'expired' || s.status === 'trialing') {
      const sub: Subscription = { ...s, planId, cycle, status: s.status === 'trialing' ? 'trialing' : 'active', pendingPlanId: undefined, periodEnd: s.status === 'expired' ? addMonths(today(), cycle === 'yearly' ? 12 : 1) : s.periodEnd };
      let next: Db = { ...d, subscription: sub };
      if (s.status !== 'trialing') { const { inv, counters } = invoice(next, sub); next = { ...next, counters, subscription: { ...sub, invoices: [inv, ...sub.invoices] } }; }
      return notify(next, d.settings.ownerId, `Plan changed to ${planOf(planId).name} (${cycle})`, '/more/settings/plan', 'billing');
    }
    return notify({ ...d, subscription: { ...s, pendingPlanId: planId } }, d.settings.ownerId, `Downgrade to ${planOf(planId).name} scheduled for ${fmtDate(s.periodEnd)}`, '/more/settings/plan', 'billing');
  });
}
/** Demo control only: switch plan immediately (skips the period-end rule for downgrades). */
export function forcePlan(planId: Subscription['planId']) {
  setDb((d) => ({ ...d, subscription: { ...d.subscription, planId, status: 'active', pendingPlanId: undefined, trialEndsAt: undefined } }));
}
export function setSubStatus(status: Subscription['status']) {
  setDb((d) => {
    let next: Db = { ...d, subscription: { ...d.subscription, status } };
    if (status === 'past_due') { const { inv, counters } = invoice(next, next.subscription, 'failed'); next = notify({ ...next, counters, subscription: { ...next.subscription, invoices: [inv, ...next.subscription.invoices] } }, d.settings.ownerId, 'Renewal payment failed — update your payment method within 7 days', '/more/settings/plan', 'billing'); }
    if (status === 'expired') next = notify(next, 'all', 'The family subscription has ended. Items are view-only until the Owner resubscribes.', '/more/settings/plan', 'billing');
    return next;
  });
}
export function payNow(method?: string) {
  setDb((d) => {
    const sub: Subscription = { ...d.subscription, status: 'active', method: method ?? d.subscription.method, periodEnd: d.subscription.status === 'active' ? d.subscription.periodEnd : addMonths(today(), d.subscription.cycle === 'yearly' ? 12 : 1), trialEndsAt: undefined };
    const { inv, counters } = invoice(d, sub);
    return notify({ ...d, counters, subscription: { ...sub, invoices: [inv, ...sub.invoices] } }, d.settings.ownerId, `Payment received — invoice ${inv.no}`, '/more/settings/plan', 'billing');
  });
}

// ---------------- reminders engine (simulated) ----------------
export function syncReminders(userId: string) {
  setDb((d) => {
    let next = d;
    const items: { key: string; title: string; due: string; time?: string; rem: string[]; link: string; space: Space; owner?: string; assignee?: string }[] = [];
    d.obligations.filter((o) => o.status === 'open' && (!o.snoozedUntil || o.snoozedUntil <= today())).forEach((o) => items.push({ key: o.id, title: o.title, due: o.dueDate, time: o.dueTime, rem: o.reminders, link: o.assetId ? `/assets/${o.assetId}#due` : '/tasks?tab=reminders', space: o.space, owner: o.privateOwnerId }));
    d.tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').forEach((t) => items.push({ key: t.id, title: t.title, due: t.dueDate, time: t.dueTime, rem: t.reminders, link: '/tasks', space: t.space, owner: t.privateOwnerId, assignee: t.assigneeId }));
    for (const it of items) {
      // family items reach every joined member; private items only their owner; tasks also their assignee (PRD §8.4)
      if (it.space === 'private' && it.owner !== userId) continue;
      if (it.assignee && it.assignee !== userId && it.space === 'family' && d.members.find((m) => m.id === userId)?.role === 'view_only') continue;
      const t = new Date(`${it.due}T${it.time || '09:00'}:00`).getTime();
      const fired = it.rem.map((id) => d.presets.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p && reminderAt(p, it.due, it.time) <= Date.now()).sort((a, b) => a.minutesBefore - b.minutesBefore)[0];
      if (!fired) continue;
      const days = Math.round((t - Date.now()) / 86_400_000);
      next = notify(next, userId, `${it.title} ${days < 0 ? `was due ${fmtDate(it.due)}` : days === 0 ? 'is due today' : `is due ${fmtDate(it.due)}`}`, it.link, 'reminder', `rem_${it.key}_${fired.id}_${userId}`);
    }
    return next;
  });
}
export function markRead(ids: string[] | 'all', userId: string) {
  setDb((d) => ({ ...d, notifications: d.notifications.map((n) => ((ids === 'all' && (n.userId === userId || n.userId === 'all')) || (ids !== 'all' && ids.includes(n.id)) ? { ...n, read: true } : n)) }));
}
