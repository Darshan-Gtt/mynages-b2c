import type { Asset, Coverage, Db, Member, Obligation, ReminderPreset, Task } from './types';
import { addDays, daysUntil, today } from './utils';

export const memberName = (db: Db, id?: string) => db.members.find((m) => m.id === id)?.name ?? '—';
export const firstName = (db: Db, id?: string) => memberName(db, id).split(' ')[0];
/** "Sneha (Spouse)" — assignees are always shown with relation (PRD §8.1). */
export function withRelation(db: Db, id?: string, me?: Member | null) {
  const m = db.members.find((x) => x.id === id);
  if (!m) return '—';
  if (me && m.id === me.id) return `${m.name.split(' ')[0]} (you)`;
  return `${m.name.split(' ')[0]} (${m.relation === 'Self' ? 'Owner' : m.relation})`;
}
export function age(dob?: string) {
  if (!dob) return undefined;
  const b = new Date(dob);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
export const catName = (db: Db, id?: string) => db.categories.find((c) => c.id === id)?.name ?? '—';
export const subName = (db: Db, id?: string) => db.subcategories.find((c) => c.id === id)?.name ?? '—';
export const propName = (db: Db, id?: string) => db.properties.find((p) => p.id === id)?.name ?? '—';
export const contactName = (db: Db, id?: string) => db.contacts.find((c) => c.id === id)?.name ?? '—';
export const statusOf = (db: Db, id: string) => db.statuses.find((s) => s.id === id);

export type CovState = 'active' | 'expiring' | 'lapsed' | 'history';
export function covState(c: Coverage): CovState {
  if (c.supersededById) return 'history';
  const d = daysUntil(c.endDate);
  return d < 0 ? 'lapsed' : d <= 30 ? 'expiring' : 'active';
}
export const covLabel = (c: Coverage) => c.kind === 'insurance' ? `${(c.policyType ?? 'insurance').replace('_', ' ')} insurance` : c.kind === 'amc' ? 'AMC' : c.kind === 'extended_warranty' ? 'Extended warranty' : 'Warranty';

export type ObState = 'upcoming' | 'due' | 'overdue' | 'completed' | 'cancelled';
export function obState(o: Obligation): ObState {
  if (o.status !== 'open') return o.status;
  const d = daysUntil(o.dueDate);
  return d < 0 ? 'overdue' : d <= 7 ? 'due' : 'upcoming';
}
export function taskOverdue(t: Task) {
  if (t.status === 'done' || t.status === 'cancelled') return false;
  const d = daysUntil(t.dueDate);
  if (d < 0) return true;
  if (d === 0 && t.dueTime) { const [h, m] = t.dueTime.split(':').map(Number); const n = new Date(); return n.getHours() * 60 + n.getMinutes() > h * 60 + m; }
  return false;
}

/** Current value: latest manual valuation, or straight-line estimate for depreciating subcategories (PRD §6.6). */
export function assetValue(db: Db, a: Asset): { value: number; asOf?: string; estimated: boolean } {
  const v = db.valuations.filter((x) => x.assetId === a.id).sort((x, y) => y.date.localeCompare(x.date))[0];
  if (v) return { value: v.value, asOf: v.date, estimated: false };
  const sub = db.subcategories.find((s) => s.id === a.subcategoryId);
  const cost = a.purchaseCost ?? Number(a.fields.invested_amount ?? 0) ?? 0;
  if (sub?.valuation === 'depreciation' && sub.depRate && a.purchaseDate) {
    const years = Math.max(0, (Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 86_400_000));
    return { value: Math.round(Math.max(cost * 0.1, cost * (1 - (sub.depRate / 100) * years))), asOf: today(), estimated: true };
  }
  if (a.fields.current_value) return { value: Number(a.fields.current_value), estimated: false };
  return { value: cost, estimated: false };
}

export const lifecycleCost = (db: Db, a: Asset) => (a.purchaseCost ?? 0) + db.expenses.filter((e) => e.assetId === a.id).reduce((s, e) => s + e.amount, 0);

export interface Alert { tone: 'danger' | 'warning' | 'info'; text: string; section: string }
/** Alerts strip (PRD §7.3.2). */
export function alertsFor(db: Db, a: Asset): Alert[] {
  const out: Alert[] = [];
  const covs = db.coverages.filter((c) => c.assetId === a.id && !c.supersededById);
  for (const c of covs) {
    const st = covState(c);
    if (st === 'lapsed') out.push({ tone: 'danger', text: `${covLabel(c)} lapsed ${-daysUntil(c.endDate)} days ago`, section: 'coverage' });
    if (st === 'expiring') out.push({ tone: 'warning', text: `${covLabel(c)} expires in ${daysUntil(c.endDate)} days`, section: 'coverage' });
  }
  if ((a.categoryId === 'c_veh' && a.subcategoryId !== 's_cycle') || a.categoryId === 'c_prop') {
    if (!covs.some((c) => c.kind === 'insurance' && covState(c) !== 'lapsed')) out.push({ tone: 'danger', text: 'No active insurance', section: 'coverage' });
  }
  const od = db.obligations.filter((o) => o.assetId === a.id && obState(o) === 'overdue');
  if (od.length) out.push({ tone: 'danger', text: `${od.length} overdue: ${od[0].title}`, section: 'due' });
  const ot = db.tasks.filter((t) => t.assetId === a.id && taskOverdue(t));
  if (ot.length) out.push({ tone: 'warning', text: `${ot.length} overdue task${ot.length > 1 ? 's' : ''}`, section: 'tasks' });
  if (a.purchaseCost && !db.docs.some((d) => d.ownerType === 'asset' && d.ownerId === a.id && d.category === 'Purchase')) out.push({ tone: 'info', text: 'No purchase invoice uploaded', section: 'documents' });
  const st = statusOf(db, a.statusId);
  if (st && /repair|lost/i.test(st.name)) out.push({ tone: /lost/i.test(st.name) ? 'danger' : 'warning', text: `Status: ${st.name}`, section: 'details' });
  return out;
}

export function nextDue(db: Db, assetId: string) {
  const xs: { label: string; date: string; amount?: number }[] = [];
  db.obligations.filter((o) => o.assetId === assetId && o.status === 'open').forEach((o) => xs.push({ label: o.title, date: o.dueDate, amount: o.amount }));
  db.tasks.filter((t) => t.assetId === assetId && (t.status === 'pending' || t.status === 'in_progress')).forEach((t) => xs.push({ label: t.title, date: t.dueDate }));
  return xs.sort((a, b) => a.date.localeCompare(b.date))[0];
}

/** When a reminder preset fires for an item due on dueDate (at dueTime). Whole-day presets fire at their set time (9 AM unless chosen). */
export function reminderAt(p: ReminderPreset, dueDate: string, dueTime?: string): number {
  const days = p.minutesBefore / 1440;
  if (p.atTime || (p.minutesBefore > 0 && Number.isInteger(days))) return new Date(`${addDays(dueDate, -days)}T${p.atTime ?? '09:00'}:00`).getTime();
  return new Date(`${dueDate}T${dueTime || '09:00'}:00`).getTime() - p.minutesBefore * 60_000;
}

export function nextReminder(db: Db, due: string, presetIds: string[], dueTime?: string) {
  const xs = presetIds.map((id) => db.presets.find((p) => p.id === id)).filter((p): p is ReminderPreset => !!p).map((p) => reminderAt(p, due, dueTime)).filter((x) => x >= Date.now()).sort((a, b) => a - b);
  return xs[0] ? new Date(xs[0]).toISOString() : undefined;
}
