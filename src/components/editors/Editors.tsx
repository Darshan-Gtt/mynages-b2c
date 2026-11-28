import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CalendarClock, Check, ClipboardList, FileText, IndianRupee, Loader2, Lock, Package, Phone, Plus, ScanLine, Sparkles, Bell, Crown, X } from 'lucide-react';
import { FormSheet, type FieldSpec, type Opt } from '../ui/EntityForm';
import { Sheet } from '../ui/Modal';
import { FileDrop, Select, type PickedFile } from '../ui/Form';
import { ContactSelect, PhoneBookButton } from '../ui/ContactPick';
import { PhoneInput } from '../ui/PhoneInput';
import { COUNTRIES, countryOf, validMobile } from '../../data/countries';
import { useToast } from '../ui/Toast';
import { AssetSheet } from './AssetSheet';
import { DocFieldSheet, docFieldSpec, docFieldsOf, type DocKind } from './DocFields';
import { getDb, setDb, useDb } from '../../lib/store';
import { useMe, useSpace } from '../../lib/session';
import { canCreateIn, entitlement, visible, type Gate } from '../../lib/access';
import {
  ActionError, changePlan, changeStatus, completeObligation, inviteMember, mapContact, renewCoverage, saveCoverage, saveDoc, saveExpense, saveMember, saveObligation,
  saveAsset, saveService, saveTask, saveValuation, upsert,
} from '../../lib/actions';
import { addDays, addMonths, cx, fmt12, inr, planPrice, sleep, today, uid } from '../../lib/utils';
import { checkValue, ruleFor, type FieldType } from '../../lib/rules';
import { CONTACT_TYPES, OBLIGATION_TYPES, PLANS, POLICY_TYPES, RELATIONS, planOf, COLORS } from '../../data/masters';
import type { Asset, Contact, Coverage, Doc, Expense, Member, Obligation, Space, Task } from '../../lib/types';

export type Ed =
  | { kind: 'add' }
  | { kind: 'asset'; asset?: Asset; categoryId?: string; onSaved?: (id: string) => void }
  | { kind: 'coverage'; assetId?: string; memberId?: string; coverage?: Coverage; insurance?: boolean }
  | { kind: 'renew'; coverage: Coverage }
  | { kind: 'obligation'; assetId?: string; memberId?: string; obligation?: Obligation }
  | { kind: 'complete'; obligation: Obligation }
  | { kind: 'task'; assetId?: string; memberId?: string; task?: Task }
  | { kind: 'document'; ownerType?: 'asset' | 'member'; ownerId?: string; doc?: Doc; category?: string }
  | { kind: 'service'; assetId: string; scheduleId?: string }
  | { kind: 'schedule'; assetId: string }
  | { kind: 'expense'; assetId?: string; expense?: Expense }
  | { kind: 'valuation'; assetId: string }
  | { kind: 'mapContact'; assetId: string }
  | { kind: 'contact'; contact?: Contact }
  | { kind: 'status'; assetId: string }
  | { kind: 'member'; member?: Member }
  | { kind: 'invite'; memberId: string }
  | { kind: 'snap'; onSaved?: (assetId: string) => void }
  | { kind: 'upgrade'; gate: Gate };

interface Api { open: (e: Ed) => void; gate: (kind: Parameters<typeof entitlement>[1]) => boolean }
const Ctx = createContext<Api>({ open: () => {}, gate: () => true });
export const useEd = () => useContext(Ctx);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [ed, setEd] = useState<Ed | null>(null);
  const open = useCallback((e: Ed) => setEd(e), []);
  const gate = useCallback((kind: Parameters<typeof entitlement>[1]) => {
    const g = entitlement(getDb(), kind);
    if (!g.ok) setEd({ kind: 'upgrade', gate: g });
    return g.ok;
  }, []);
  const api = useMemo(() => ({ open, gate }), [open, gate]);
  return <Ctx.Provider value={api}>{children}{ed && <Active ed={ed} close={() => setEd(null)} open={open} gate={gate} />}</Ctx.Provider>;
}

type V = Record<string, unknown>;
const presetOpts = () => getDb().presets.map((p) => ({ value: p.id, label: p.label }));
const RECUR: Opt[] = [{ value: 'none', label: 'Does not repeat' }, { value: 'monthly', label: 'Every month' }, { value: 'quarterly', label: 'Every 3 months' }, { value: 'half_yearly', label: 'Every 6 months' }, { value: 'yearly', label: 'Every year' }, { value: 'custom', label: 'Custom — pick dates & times' }];
/** Reminder types that involve paying money — only these ask for an amount. */
const MONEY_TYPES = ['insurance_premium', 'amc_renewal', 'subscription_renewal', 'tax', 'puc', 'registration', 'loan_emi', 'bill', 'contribution', 'custom'];
const fmtSlot = (s: string) => { const [d, t] = s.split('T'); return `${new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${t}`; };

/** Custom repeat: the user adds each next date + time by hand. */
function CustomDates({ value, onChange, after }: { value: string[]; onChange: (v: string[]) => void; after: string }) {
  const [d, setD] = useState('');
  const [t, setT] = useState('');
  const [err, setErr] = useState<string>();
  const add = () => {
    if (!d || !t) { setErr('Pick both a date and a time'); return; }
    const slot = `${d}T${t}`;
    if (slot <= after) { setErr('Must be after the first reminder date & time'); return; }
    if (value.includes(slot)) { setErr('Already added'); return; }
    onChange([...value, slot].sort()); setD(''); setT(''); setErr(undefined);
  };
  return (
    <div className="stack-sm">
      <span className="xs muted">After the first one, remind again on:</span>
      {value.map((s) => (
        <div key={s} className="slot-row"><CalendarClock size={15} /><span className="grow small">{fmtSlot(s)}</span><button type="button" className="icon-btn sm" aria-label="Remove date" onClick={() => onChange(value.filter((x) => x !== s))}><X size={15} /></button></div>
      ))}
      <div className="slot-add">
        <input className="input" type="date" aria-label="Repeat date" value={d} min={after.slice(0, 10)} onChange={(e) => setD(e.target.value)} />
        <input className="input" type="time" aria-label="Repeat time" value={t} onChange={(e) => setT(e.target.value)} />
        <button type="button" className="btn btn-sm" onClick={add}><Plus size={14} /> Add</button>
      </div>
      {err && <span className="field-error" role="alert">{err}</span>}
    </div>
  );
}
const customDatesField = (): FieldSpec<V> => ({
  key: 'customDates', label: 'Repeat on', type: 'custom', showIf: (v) => v.recurrence === 'custom',
  render: (val, set, v) => <CustomDates value={(val as string[] | undefined) ?? []} onChange={set} after={`${v.dueDate ?? ''}T${v.dueTime || '00:00'}`} />,
  validate: (val, v) => { const xs = (val as string[] | undefined) ?? []; if (!xs.length) return 'Add at least one date & time'; if (xs.some((x) => x <= `${v.dueDate}T${v.dueTime || '00:00'}`)) return 'Every date must be after the first one'; return undefined; },
});

/** Contact field: saved contacts, phone book or a quick new one. */
const contactField = (key: string, label: string, type: Contact['type'], extra: Partial<FieldSpec<V>> = {}): FieldSpec<V> => ({
  key, label, type: 'custom', render: (val, set) => <ContactSelect value={val as string | undefined} onChange={set} type={type} label={label} />, ...extra,
});
/** Mobile with country code: value is { iso, num }. */
type Mob = { iso: string; num: string };
const isoOfDial = (dial?: string) => COUNTRIES.find((c) => c.dial === (dial ?? '91'))?.iso ?? 'IN';
const mobileField = (key: string, label: string, required: boolean | ((v: V) => boolean), hint?: string): FieldSpec<V> => ({
  key, label, type: 'custom', required: (v) => (typeof required === 'function' ? required(v) : required), hint,
  render: (val, set) => { const m = (val as Mob | undefined) ?? { iso: 'IN', num: '' }; return <PhoneInput iso={m.iso} onIso={(iso) => set({ ...m, iso })} value={m.num} onChange={(num) => set(num || m.iso !== 'IN' ? { ...m, num } : undefined)} />; },
  validate: (val) => { const m = val as Mob | undefined; if (!m?.num) return undefined; return validMobile(countryOf(m.iso), m.num) ? undefined : `Enter a valid ${countryOf(m.iso).name} mobile number`; },
});
/** Phone-book entry → { iso, num } (Indian numbers lose +91; others keep their digits). */
const mobFromBook = (phone: string): Mob => { const d = phone.replace(/\D/g, ''); const c = COUNTRIES.find((x) => x.iso !== 'IN' && d.startsWith(x.dial) && d.length - x.dial.length >= x.min && d.length - x.dial.length <= x.max); return c ? { iso: c.iso, num: d.slice(c.dial.length) } : { iso: 'IN', num: d.slice(-10) }; };
const OTHER = '__other';

function Active({ ed, close, open, gate }: { ed: Ed; close: () => void; open: (e: Ed) => void; gate: Api['gate'] }) {
  const db = useDb();
  const me = useMe()!;
  const space = useSpace();
  const toast = useToast();
  const navigate = useNavigate();
  const [file, setFile] = useState<PickedFile>();
  const [docField, setDocField] = useState<null | { kind: DocKind; name: string }>(null);
  const ok = (t: string, m?: string) => { toast({ type: 'success', title: t, message: m }); close(); };
  const assetOpts: Opt[] = db.assets.filter((a) => !a.archived && visible(a, me)).map((a) => ({ value: a.id, label: `${a.name}${a.space === 'private' ? ' 🔒' : ''}` }));
  const memberOpts = (joinedOnly = false): Opt[] => db.members.filter((m) => (joinedOnly ? m.state === 'joined' || m.state === 'self' : m.state !== 'removed' && m.state !== 'declined')).map((m) => ({ value: m.id, label: `${m.name.split(' ')[0]} (${m.id === me.id ? 'you' : m.relation === 'Self' ? 'Owner' : m.relation})` }));
  const ownerSpace = (assetId?: string): { space: Space; privateOwnerId?: string } => {
    const a = db.assets.find((x) => x.id === assetId);
    if (a) return { space: a.space, privateOwnerId: a.privateOwnerId };
    return canCreateIn(me, space) ? { space, privateOwnerId: space === 'private' ? me.id : undefined } : { space: 'private', privateOwnerId: me.id };
  };

  switch (ed.kind) {
    case 'add': {
      const items = [
        { icon: <Package size={20} />, label: 'Asset', sub: 'Car, flat, gadget, gold, FD…', run: () => gate('asset') && open({ kind: 'asset' }) },
        { icon: <Camera size={20} />, label: 'Snap a document', sub: 'Policy, invoice, warranty card — we fill the form', run: () => open({ kind: 'snap' }), badge: 'Preview' },
        { icon: <ClipboardList size={20} />, label: 'Task', sub: 'Something someone must do', run: () => open({ kind: 'task' }) },
        { icon: <Bell size={20} />, label: 'Reminder', sub: 'Renewal, premium, tax, bill, subscription', run: () => open({ kind: 'obligation' }) },
        { icon: <IndianRupee size={20} />, label: 'Expense', sub: 'Fuel, repair, service on an asset', run: () => open({ kind: 'expense' }) },
        { icon: <Phone size={20} />, label: 'Contact', sub: 'Technician, agent, doctor, CA', run: () => open({ kind: 'contact' }) },
        { icon: <FileText size={20} />, label: 'Document', sub: 'For an asset or a family member', run: () => open({ kind: 'document' }) },
      ];
      return (
        <Sheet open onClose={close} title="Add">
          <div className="add-grid">
            {items.map((i) => (
              <button key={i.label} className="add-item" onClick={() => { if (!gate('write')) return; close(); setTimeout(i.run, 10); }}>
                <span className="icon-tile">{i.icon}</span>
                <span className="row-text"><b>{i.label}{i.badge && <span className="badge tone-warning" style={{ marginLeft: 6, height: 18 }}>{i.badge}</span>}</b><em>{i.sub}</em></span>
              </button>
            ))}
          </div>
        </Sheet>
      );
    }
    case 'asset': return <AssetSheet asset={ed.asset} categoryId={ed.categoryId} onSaved={ed.onSaved} onClose={close} />;

    case 'coverage': {
      const c = ed.coverage;
      const hasRem = !!c && db.obligations.some((o) => o.coverageId === c.id && o.status === 'open');
      const person = c ? c.linkedType === 'member' : !!ed.memberId || (!ed.assetId && ed.insurance);
      const fields: FieldSpec<V>[] = [
        { key: 'linkedType', label: 'Covers', type: 'select', required: true, disabled: !!c || !!ed.assetId || !!ed.memberId, options: [{ value: 'asset', label: 'An asset' }, { value: 'member', label: 'Family members (health, life…)' }] },
        { key: 'assetId', label: 'Asset', type: 'select', required: (v) => v.linkedType === 'asset', showIf: (v) => v.linkedType === 'asset', options: assetOpts, disabled: !!ed.assetId || !!c },
        { key: 'kind', label: 'Type', type: 'select', required: true, showIf: (v) => v.linkedType === 'asset', options: [{ value: 'insurance', label: 'Insurance' }, { value: 'warranty', label: 'Warranty' }, { value: 'extended_warranty', label: 'Extended warranty' }, { value: 'amc', label: 'AMC' }] },
        { key: 'policyType', label: 'Policy type', type: 'select', required: (v) => v.kind === 'insurance' || v.linkedType === 'member', showIf: (v) => v.kind === 'insurance' || v.linkedType === 'member', options: (v) => POLICY_TYPES.filter((p) => (v.linkedType === 'member' ? p.group !== 'asset' : p.group === 'asset')).map((p) => ({ value: p.id, label: p.label })) },
        { key: 'insured', label: 'Insured members', type: 'multiselect', required: (v) => v.linkedType === 'member', showIf: (v) => v.linkedType === 'member', options: memberOpts() },
        { key: 'provider', label: 'Insurer / provider', type: 'text', required: true, placeholder: 'e.g. Star Health, LG, Kent' },
        contactField('providerContactId', 'Provider contact (helpline / branch)', 'service_provider', { hint: 'Optional — pick from your phone book or add the number' }),
        { key: 'number', label: 'Policy / contract no. (printed on the policy or warranty card)', type: 'text', required: true },
        { key: 'startDate', label: 'Start', type: 'date', required: true },
        { key: 'endDate', label: 'End / expiry', type: 'date', required: true, validate: (v, f) => (String(v) <= String(f.startDate) ? 'Must be after the start' : undefined) },
        { key: 'sumInsured', label: 'Sum insured (most the insurer will pay)', type: 'currency', showIf: (v) => v.kind === 'insurance' || v.linkedType === 'member' },
        { key: 'premium', label: 'Premium / cost', type: 'currency', showIf: (v) => v.kind !== 'warranty' },
        { key: 'premiumFrequency', label: 'Premium paid', type: 'select', showIf: (v) => v.kind === 'insurance' || v.linkedType === 'member', options: [{ value: 'yearly', label: 'Yearly' }, { value: 'half_yearly', label: 'Half-yearly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'monthly', label: 'Monthly' }, { value: 'single', label: 'Single premium' }] },
        { key: 'maturityDate', label: 'Maturity date', type: 'date', showIf: (v) => ['endowment', 'ulip', 'life'].includes(String(v.policyType)) },
        { key: 'maturityValue', label: 'Maturity value', type: 'currency', showIf: (v) => ['endowment', 'ulip', 'life'].includes(String(v.policyType)) },
        { key: 'nominee', label: 'Nominee (who receives the claim money)', type: 'text', showIf: (v) => v.linkedType === 'member' },
        contactField('agentContactId', 'Agent / service contact', 'insurance_agent', { hint: 'The person you call for claims or service — from phone book or saved contacts' }),
        ...(!hasRem ? [
          { key: 'reminder', label: 'Reminder', type: 'checkbox', hint: 'Remind the family before it expires' } as FieldSpec<V>,
          { key: 'remindDays', label: 'How many days before expiry', type: 'number', min: 1, required: (v) => !!v.reminder, showIf: (v) => !!v.reminder, validate: (x) => (Number(x) > 365 ? 'At most 365 days' : undefined) } as FieldSpec<V>,
          { key: 'remindTime', label: 'At what time', type: 'time', required: (v) => !!v.reminder, showIf: (v) => !!v.reminder } as FieldSpec<V>,
        ] : []),
      ];
      return (
        <FormSheet<V> open onClose={close} title={c ? 'Edit coverage' : person ? 'Add a policy' : 'Add insurance / warranty'} fields={fields}
          initial={c ? { ...c, insured: c.insured.map((i) => i.memberId) } : { linkedType: person ? 'member' : 'asset', assetId: ed.assetId, insured: ed.memberId ? [ed.memberId] : [], kind: person || ed.insurance ? 'insurance' : 'warranty', startDate: today(), endDate: addMonths(today(), 12), premiumFrequency: 'yearly', reminder: true, remindDays: person || ed.insurance ? 30 : 15, remindTime: '09:00' }}
          after={(v) => (v.reminder && !hasRem ? <p className="xs muted" style={{ marginTop: 10 }}>🔔 We’ll remind on {v.endDate && v.remindDays ? new Date(addDays(String(v.endDate), -Number(v.remindDays))).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '…'}{v.remindTime ? ` at ${fmt12(String(v.remindTime))}` : ''}. It is added to Tasks & reminders → Reminders.</p> : null)}
          onSubmit={(v) => {
            const lt = v.linkedType as 'asset' | 'member';
            const os = lt === 'asset' ? ownerSpace(String(v.assetId)) : c ? { space: c.space, privateOwnerId: c.privateOwnerId } : ownerSpace();
            const row: Coverage = {
              ...(c ?? { createdBy: me.id, createdAt: new Date().toISOString() } as Coverage), id: c?.id ?? uid('cov'), linkedType: lt, assetId: lt === 'asset' ? String(v.assetId) : undefined,
              kind: lt === 'member' ? 'insurance' : (v.kind as Coverage['kind']), policyType: (v.policyType as Coverage['policyType']) || undefined,
              insured: lt === 'member' ? (v.insured as string[]).map((id) => ({ memberId: id, cover: v.sumInsured ? Number(v.sumInsured) : undefined })) : [],
              provider: String(v.provider), number: String(v.number), startDate: String(v.startDate), endDate: String(v.endDate), sumInsured: v.sumInsured ? Number(v.sumInsured) : undefined,
              premium: v.premium ? Number(v.premium) : undefined, premiumFrequency: (v.premiumFrequency as Coverage['premiumFrequency']) || undefined, maturityDate: (v.maturityDate as string) || undefined,
              maturityValue: v.maturityValue ? Number(v.maturityValue) : undefined, nominee: (v.nominee as string) || undefined, agentContactId: (v.agentContactId as string) || undefined, providerContactId: (v.providerContactId as string) || undefined, ...os,
            };
            const rem = v.reminder && !hasRem ? { days: Number(v.remindDays), time: String(v.remindTime) } : false;
            saveCoverage(row, rem);
            ok(c ? 'Coverage updated' : 'Coverage added', rem ? `Reminder set: ${rem.days} days before expiry, ${fmt12(rem.time)} — see Tasks & reminders` : undefined);
          }} />
      );
    }

    case 'renew': {
      const c = ed.coverage;
      const len = Math.round((new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / 86_400_000);
      return (
        <FormSheet<V> open onClose={close} title={`Renew ${c.provider}`}
          fields={[{ key: 'number', label: 'New policy / contract no.', type: 'text', required: true, full: true }, { key: 'startDate', label: 'Start', type: 'date', required: true }, { key: 'endDate', label: 'End', type: 'date', required: true }, { key: 'premium', label: 'Premium paid', type: 'currency', showIf: () => c.kind !== 'warranty' }, { key: 'sumInsured', label: 'Sum insured', type: 'currency', showIf: () => c.kind === 'insurance' }]}
          initial={{ number: '', startDate: addDays(c.endDate, 1), endDate: addDays(c.endDate, len + 1), premium: c.premium, sumInsured: c.sumInsured }}
          before={() => <p className="xs muted" style={{ marginBottom: 12 }}>The current one moves to history; the premium is recorded as an expense and a new reminder is set.</p>}
          submitLabel="Renew"
          onSubmit={(v) => { renewCoverage(c.id, { number: String(v.number), startDate: String(v.startDate), endDate: String(v.endDate), premium: v.premium ? Number(v.premium) : undefined, sumInsured: v.sumInsured ? Number(v.sumInsured) : undefined }); ok('Renewed', 'New reminder set before the next expiry'); }} />
      );
    }

    case 'obligation': {
      const o = ed.obligation;
      const saved = db.settings.reminderTypes ?? [];
      const typeOpts: Opt[] = [...OBLIGATION_TYPES.filter((t) => t.id !== 'custom').map((t) => ({ value: t.id, label: t.label })), ...saved.map((n) => ({ value: `c:${n}`, label: n })), { value: 'custom', label: '+ Custom — name your own' }];
      const typeId = (val: unknown) => (String(val ?? '').startsWith('c:') ? 'custom' : String(val ?? ''));
      const initType = o ? (o.type === 'custom' && o.customType && saved.includes(o.customType) ? `c:${o.customType}` : o.type) : 'bill';
      return (
        <FormSheet<V> open onClose={close} title={o ? 'Edit reminder' : 'New reminder'}
          fields={[
            { key: 'title', label: 'What’s it for', type: 'text', required: true, full: true, placeholder: 'e.g. PUC — Activa, Electricity bill' },
            { key: 'type', label: 'Type', type: 'select', required: true, options: typeOpts, hint: 'Sets sensible “remind me” times. Choose Custom to create your own type.', effect: (val) => ({ reminders: OBLIGATION_TYPES.find((t) => t.id === typeId(val))?.presets }) },
            { key: 'customType', label: 'Name this type', type: 'text', required: (v) => v.type === 'custom', showIf: (v) => v.type === 'custom', placeholder: 'e.g. Gas cylinder booking', hint: 'Saved — it shows in the Type list next time', validate: (x) => (OBLIGATION_TYPES.some((t) => t.label.toLowerCase() === String(x).trim().toLowerCase()) ? 'This type already exists in the list' : undefined) },
            { key: 'assetId', label: 'For asset', type: 'select', options: assetOpts, emptyLabel: 'None', disabled: !!ed.assetId },
            { key: 'memberId', label: 'For person', type: 'select', options: memberOpts(), emptyLabel: 'None', showIf: (v) => !v.assetId },
            { key: 'dueDate', label: 'Reminder date', type: 'date', required: true },
            { key: 'dueTime', label: 'Time', type: 'time', required: true },
            { key: 'amount', label: 'Amount to pay', type: 'currency', showIf: (v) => MONEY_TYPES.includes(typeId(v.type)), hint: 'Optional — shown on the reminder and added to expenses when you mark it paid' },
            { key: 'recurrence', label: 'Repeats', type: 'select', required: true, options: RECUR },
            customDatesField(),
            { key: 'autoRenew', label: 'Auto-renew', type: 'checkbox', hint: 'Renews automatically (remind me to cancel if not needed)', showIf: (v) => ['subscription_renewal', 'amc_renewal', 'insurance_premium'].includes(typeId(v.type)) },
            { key: 'reminders', label: 'Remind me', type: 'multiselect', options: presetOpts(), validate: (x) => ((x as string[] | undefined)?.length ? undefined : 'Pick at least one') },
            contactField('contactId', 'Who to call (optional)', 'service_provider', { hint: 'e.g. your insurance agent or technician — the reminder gets a Call button' }),
          ]}
          initial={o ? { ...o, type: initType, dueTime: o.dueTime ?? '09:00', customDates: o.customDates ?? [] } : { title: '', type: initType, assetId: ed.assetId, memberId: ed.memberId, dueDate: addDays(today(), 30), dueTime: '', recurrence: 'none', customDates: [], reminders: OBLIGATION_TYPES.find((t) => t.id === initType)?.presets ?? ['rp_1d'] }}
          after={(v) => <p className="xs muted" style={{ marginTop: 10 }}>{ownerSpace(v.assetId as string).space === 'private' ? '🔒 Private — only you will be reminded.' : `Everyone in ${db.settings.familyName} with reminders on will be notified.`}</p>}
          onSubmit={(v) => {
            const os = o ? { space: o.space, privateOwnerId: o.privateOwnerId } : ownerSpace(v.assetId as string);
            const tid = typeId(v.type);
            const customType = String(v.type).startsWith('c:') ? String(v.type).slice(2) : tid === 'custom' ? String(v.customType ?? '').trim() : undefined;
            const money = MONEY_TYPES.includes(tid);
            saveObligation({ ...(o ?? { status: 'open', createdBy: me.id, createdAt: new Date().toISOString() } as Obligation), id: o?.id ?? uid('ob'), title: String(v.title), type: tid as Obligation['type'], customType, assetId: (v.assetId as string) || undefined, memberId: v.assetId ? undefined : (v.memberId as string) || undefined, dueDate: String(v.dueDate), dueTime: String(v.dueTime), amount: money && v.amount ? Number(v.amount) : undefined, recurrence: v.recurrence as Obligation['recurrence'], customDates: v.recurrence === 'custom' ? (v.customDates as string[]) : undefined, autoRenew: !!v.autoRenew, reminders: v.reminders as string[], contactId: (v.contactId as string) || undefined, ...os });
            const isNewType = !!customType && !saved.some((x) => x.toLowerCase() === customType.toLowerCase());
            if (isNewType) setDb((d) => ({ ...d, settings: { ...d.settings, reminderTypes: [...(d.settings.reminderTypes ?? []), customType!] } }));
            ok(o ? 'Reminder updated' : 'Reminder added', isNewType ? `“${customType}” saved as a reminder type` : undefined);
          }} />
      );
    }

    case 'complete': {
      const o = ed.obligation;
      return (
        <FormSheet<V> open onClose={close} title="Mark paid / renewed"
          fields={[{ key: 'paidOn', label: 'Paid / renewed on', type: 'date', required: true, validate: (x) => (String(x) > today() ? 'Can’t be in the future' : undefined) }, { key: 'amount', label: 'Amount paid', type: 'currency' }, { key: 'note', label: 'Receipt / note', type: 'text', full: true }]}
          initial={{ paidOn: today(), amount: o.amount ?? '' }}
          before={() => <p className="small" style={{ marginBottom: 12 }}><b>{o.title}</b><br /><span className="xs muted">{o.recurrence !== 'none' ? 'The next one is added automatically.' : 'One-off item.'} Pending reminders stop.</span></p>}
          submitLabel="Mark paid"
          onSubmit={(v) => { const n = completeObligation(o.id, String(v.paidOn), v.amount ? Number(v.amount) : undefined, (v.note as string) || undefined); ok('Marked paid', n ? `Next due ${new Date(n.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : undefined); }} />
      );
    }

    case 'task': {
      const t = ed.task;
      const sp = t ? t.space : ownerSpace(ed.assetId).space;
      return (
        <FormSheet<V> open onClose={close} title={t ? 'Edit task' : 'New task'}
          fields={[
            { key: 'title', label: 'Task', type: 'text', required: true, full: true, placeholder: 'e.g. Book AC service' },
            { key: 'assigneeId', label: 'Assign to', type: 'select', required: true, options: sp === 'private' ? memberOpts(true).filter((x) => x.value === me.id) : memberOpts(true), hint: 'Family members who have joined the app' },
            { key: 'dueDate', label: 'Due date', type: 'date', required: true },
            { key: 'dueTime', label: 'Time', type: 'time', required: true },
            { key: 'priority', label: 'Priority', type: 'select', required: true, options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }] },
            { key: 'recurrence', label: 'Repeats', type: 'select', required: true, options: RECUR },
            customDatesField(),
            { key: 'assetId', label: 'About asset', type: 'select', options: assetOpts, emptyLabel: 'None', disabled: !!ed.assetId },
            { key: 'memberId', label: 'About person', type: 'select', options: memberOpts(), emptyLabel: 'None', showIf: (v) => !v.assetId },
            { key: 'reminders', label: 'Remind', type: 'multiselect', options: presetOpts() },
            { key: 'description', label: 'Notes', type: 'textarea' },
          ]}
          initial={t ? { ...t, dueTime: t.dueTime ?? '09:00', customDates: t.customDates ?? [] } : { title: '', assigneeId: me.id, dueDate: addDays(today(), 2), dueTime: '', priority: 'medium', recurrence: 'none', customDates: [], assetId: ed.assetId, memberId: ed.memberId, reminders: ['rp_1d'] }}
          onSubmit={(v) => {
            const os = t ? { space: t.space, privateOwnerId: t.privateOwnerId } : ownerSpace(v.assetId as string);
            saveTask({ ...(t ?? { status: 'pending', createdBy: me.id, createdAt: new Date().toISOString() } as Task), id: t?.id ?? uid('t'), title: String(v.title), assigneeId: String(v.assigneeId), dueDate: String(v.dueDate), dueTime: String(v.dueTime), priority: v.priority as Task['priority'], recurrence: v.recurrence as Task['recurrence'], customDates: v.recurrence === 'custom' ? (v.customDates as string[]) : undefined, assetId: (v.assetId as string) || undefined, memberId: v.assetId ? undefined : (v.memberId as string) || undefined, reminders: (v.reminders as string[]) ?? [], description: (v.description as string) || undefined, ...os });
            ok(t ? 'Task updated' : 'Task added', v.assigneeId !== me.id ? `${db.members.find((m) => m.id === v.assigneeId)?.name.split(' ')[0]} has been notified` : undefined);
          }} />
      );
    }

    case 'document': {
      const doc = ed.doc;
      const cats = db.settings.docCategories;
      const kindOf = (v: V): DocKind => (v.ownerType === 'member' ? 'person' : 'asset');
      // Each category's own fields; keys carry the category so two categories can both have e.g. "Account number".
      const dk = (kind: DocKind, cat: string, key: string) => `df__${kind}_${(kind === 'person' ? cats.person : cats.asset).indexOf(cat)}__${key}`;
      const catFieldSpecs: FieldSpec<V>[] = (['asset', 'person'] as DocKind[]).flatMap((kind) => (kind === 'person' ? cats.person : cats.asset).flatMap((cat) =>
        docFieldsOf(db, kind, cat).map((f, i) => ({ ...docFieldSpec(f, (v) => kindOf(v) === kind && v.category === cat), key: dk(kind, cat, f.key), section: i === 0 ? `${cat} details` : undefined }))));
      const canFields = me.role === 'owner';
      const catOpts = (v: V) => [...(v.ownerType === 'member' ? cats.person : cats.asset).map((x) => ({ value: x, label: x })), { value: OTHER, label: '+ New category' }];
      return (
        <FormSheet<V> open onClose={close} title={doc ? 'Edit document' : 'Add document'}
          fields={[
            { key: 'ownerType', label: 'Belongs to', type: 'select', required: true, disabled: !!ed.ownerId || !!doc, options: [{ value: 'asset', label: 'An asset' }, { value: 'member', label: 'A person' }], effect: (x) => ({ ownerId: undefined, category: x === 'member' ? cats.person[0] : cats.asset[0] }) },
            { key: 'ownerId', label: 'Which one', type: 'select', required: true, disabled: !!ed.ownerId || !!doc, options: (v) => (v.ownerType === 'member' ? memberOpts() : assetOpts) },
            { key: 'title', label: 'Title', type: 'text', required: true, full: true, placeholder: 'e.g. Aadhaar card, RC, Warranty card' },
            { key: 'category', label: 'Category', type: 'select', required: true, options: catOpts },
            { key: 'newCategory', label: 'New category name', type: 'text', required: (v) => v.category === OTHER, showIf: (v) => v.category === OTHER, placeholder: 'e.g. Society papers', hint: `Saved for ${db.settings.familyName} only. After saving, add its own fields from Settings → Document categories`, validate: (x, v) => ((v.ownerType === 'member' ? cats.person : cats.asset).some((c) => c.toLowerCase() === String(x).trim().toLowerCase()) ? 'This category already exists' : String(x).trim().length < 2 ? 'At least 2 letters' : undefined) },
            ...catFieldSpecs,
            { key: 'number', label: 'Document no. (as printed on it)', type: 'text', section: 'More details' },
            { key: 'issuer', label: 'Issued by (office or company)', type: 'text', placeholder: 'e.g. RTO Pune, UIDAI, LG' },
            { key: 'issueDate', label: 'Issue date', type: 'date' },
            { key: 'expiryDate', label: 'Expiry date (if it has one)', type: 'date', hint: doc ? undefined : 'We’ll remind 30 and 7 days before' },
            { key: 'tags', label: 'Tags (words to find it later)', type: 'text', placeholder: 'e.g. original, tax 2025, locker', hint: 'Optional · comma separated · used by search' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          initial={doc ? { ...doc, tags: doc.tags.join(', '), ...Object.fromEntries(Object.entries(doc.fields ?? {}).map(([k, x]) => [dk(doc.ownerType === 'member' ? 'person' : 'asset', doc.category, k), x])) } : { ownerType: ed.ownerType ?? 'asset', ownerId: ed.ownerId, category: ed.category ?? (ed.ownerType === 'member' ? cats.person[0] : cats.asset[0]), title: '' }}
          before={() => !doc ? <div className="row" style={{ gap: 8, marginBottom: 12 }}><button type="button" className="btn btn-sm" onClick={() => setFile({ name: `Scan_${new Date().toISOString().slice(0, 10)}.pdf`, size: 420_000, type: 'application/pdf' })}><ScanLine size={14} /> Scan with camera</button><span className="xs muted">or upload below</span></div> : null}
          after={(v) => <>
            {canFields && v.category && v.category !== OTHER && <div className="row" style={{ gap: 8, marginTop: 12 }}><button type="button" className="btn btn-xs" onClick={() => setDocField({ kind: kindOf(v), name: String(v.category) })}><Plus size={12} /> Add a field to “{String(v.category)}”</button><span className="xs muted">{docFieldsOf(db, kindOf(v), String(v.category)).length ? 'e.g. Policy no., Locker no.' : 'This category has no extra fields yet'}</span></div>}
            {!doc && <div className="field" style={{ marginTop: 12 }}><span className="field-label">File <span className="req">*</span></span><FileDrop value={file} onChange={setFile} accept="image/*,.pdf" hint="Photo or PDF · up to 10 MB" /></div>}
            {docField && <DocFieldSheet kind={docField.kind} name={docField.name} onClose={() => setDocField(null)} />}
          </>}
          submitLabel={doc ? 'Save' : 'Save document'}
          onSubmit={(v) => {
            if (!doc && !file) throw new ActionError('Scan or upload the document');
            let category = String(v.category);
            if (category === OTHER) {
              category = String(v.newCategory).trim();
              const k = v.ownerType === 'member' ? 'person' : 'asset';
              setDb((d) => ({ ...d, settings: { ...d.settings, docCategories: { ...d.settings.docCategories, [k]: [...d.settings.docCategories[k], category] } } }));
            }
            const os = doc ? { space: doc.space, privateOwnerId: doc.privateOwnerId } : v.ownerType === 'asset' ? ownerSpace(String(v.ownerId)) : ownerSpace();
            const fieldsOut: NonNullable<Doc['fields']> = {};
            if (v.category !== OTHER) docFieldsOf(getDb(), kindOf(v), category).forEach((f) => { const x = v[dk(kindOf(v), category, f.key)]; if (x !== undefined && x !== '') fieldsOut[f.key] = f.type === 'number' || f.type === 'currency' ? Number(x) : (x as string | boolean); });
            saveDoc({ ...(doc ?? { createdBy: me.id, createdAt: new Date().toISOString(), fileName: file!.name, size: file!.size, pages: 1 } as Doc), id: doc?.id ?? uid('doc'), title: String(v.title), category, ownerType: v.ownerType as Doc['ownerType'], ownerId: String(v.ownerId), number: (v.number as string) || undefined, issuer: (v.issuer as string) || undefined, issueDate: (v.issueDate as string) || undefined, expiryDate: (v.expiryDate as string) || undefined, tags: String(v.tags ?? '').split(',').map((x) => x.trim()).filter(Boolean), notes: (v.notes as string) || undefined, fields: Object.keys(fieldsOut).length ? fieldsOut : undefined, ...os });
            ok(doc ? 'Document updated' : 'Document saved');
          }} />
      );
    }

    case 'service': {
      const sch = db.schedules.filter((s) => s.assetId === ed.assetId && s.active);
      const sa = db.assets.find((x) => x.id === ed.assetId);
      const hasMeter = sa?.categoryId === 'c_veh' && sa.subcategoryId !== 's_cycle';
      const schContact = sch.find((s) => s.id === ed.scheduleId)?.contactId;
      return (
        <FormSheet<V> open onClose={close} title="Log service"
          fields={[
            { key: 'date', label: 'Date', type: 'date', required: true, validate: (x) => (String(x) > today() ? 'Can’t be in the future' : undefined) },
            contactField('contactId', 'Service person / centre contact', 'service_provider', { hint: 'Optional — pick from phone book or saved contacts; fills “Done by”', effect: (x, v) => (x && !String(v.provider ?? '').trim() ? { provider: db.contacts.find((c) => c.id === x)?.name ?? getDb().contacts.find((c) => c.id === x)?.name } : {}) }),
            { key: 'provider', label: 'Done by', type: 'text', required: true, placeholder: 'Service centre or technician' },
            { key: 'workDone', label: 'Work done', type: 'textarea', required: true },
            { key: 'cost', label: 'Cost', type: 'currency', hint: 'Added to this asset’s expenses' },
            ...(hasMeter ? [{ key: 'reading', label: 'Odometer reading (km at service)', type: 'number', placeholder: 'e.g. 48210' } as FieldSpec<V>] : []),
            ...(sch.length ? [{ key: 'scheduleId', label: 'Part of a service schedule?', type: 'select', options: sch.map((s) => ({ value: s.id, label: `${s.title} (every ${s.intervalDays} days)` })), emptyLabel: 'No — one-off service', hint: 'Choose the schedule this service completes; its next due date moves ahead automatically' } as FieldSpec<V>] : []),
          ]}
          initial={{ date: today(), cost: 0, scheduleId: ed.scheduleId, contactId: schContact, provider: db.contacts.find((c) => c.id === schContact)?.name ?? '' }}
          onSubmit={(v) => { saveService({ id: uid('sv'), assetId: ed.assetId, date: String(v.date), provider: String(v.provider), workDone: String(v.workDone), cost: Number(v.cost) || 0, reading: v.reading ? `${Number(v.reading).toLocaleString('en-IN')} km` : undefined, scheduleId: (v.scheduleId as string) || undefined, contactId: (v.contactId as string) || undefined, createdBy: me.id }); ok('Service logged'); }} />
      );
    }

    case 'schedule':
      return (
        <FormSheet<V> open onClose={close} title="Service schedule"
          fields={[{ key: 'title', label: 'What', type: 'text', required: true, full: true, placeholder: 'e.g. RO filter change' }, { key: 'intervalDays', label: 'Repeat every (number of days)', type: 'number', required: true, min: 1, hint: 'e.g. 90 = every 3 months' }, { key: 'nextDue', label: 'Next due', type: 'date', required: true }, contactField('contactId', 'Who does it', 'service_provider')]}
          initial={{ intervalDays: 90, nextDue: addDays(today(), 30), title: '' }}
          onSubmit={(v) => { upsert('schedules', { id: uid('sc'), assetId: ed.assetId, title: String(v.title), intervalDays: Number(v.intervalDays), nextDue: String(v.nextDue), contactId: (v.contactId as string) || undefined, active: true }); ok('Schedule added'); }} />
      );

    case 'expense': {
      const e = ed.expense;
      const EXP_TYPES = ['Fuel', 'Service', 'Repairs & painting', 'Spares', 'Insurance', 'AMC', 'Tax', 'Bills', 'Society maintenance', 'Subscription', 'Accessories'];
      return (
        <FormSheet<V> open onClose={close} title={e ? 'Edit expense' : 'Add expense'}
          fields={[
            { key: 'assetId', label: 'Asset', type: 'select', required: true, options: assetOpts, disabled: !!ed.assetId || !!e },
            { key: 'type', label: 'Type', type: 'select', required: true, options: [...EXP_TYPES.map((x) => ({ value: x, label: x })), ...(e && !EXP_TYPES.includes(e.type) ? [{ value: e.type, label: e.type }] : []), { value: OTHER, label: 'Other' }] },
            { key: 'typeOther', label: 'What was it for?', type: 'text', required: (v) => v.type === OTHER, showIf: (v) => v.type === OTHER, placeholder: 'e.g. Parking fine, Car wash' },
            { key: 'amount', label: 'Amount', type: 'currency', required: true, min: 1 },
            { key: 'date', label: 'Date', type: 'date', required: true },
            { key: 'paidBy', label: 'Paid by', type: 'select', required: true, options: memberOpts() },
            { key: 'notes', label: 'Notes', type: 'text', full: true },
          ]}
          initial={e ? { ...e } : { assetId: ed.assetId, type: 'Fuel', date: today(), paidBy: me.id }}
          onSubmit={(v) => { saveExpense({ ...(e ?? { createdBy: me.id } as Expense), id: e?.id ?? uid('ex'), assetId: String(v.assetId), type: v.type === OTHER ? String(v.typeOther).trim() : String(v.type), amount: Number(v.amount), date: String(v.date), paidBy: String(v.paidBy), notes: (v.notes as string) || undefined }); ok(e ? 'Expense updated' : 'Expense added', inr(Number(v.amount))); }} />
      );
    }

    case 'valuation':
      return (
        <FormSheet<V> open onClose={close} title="Update current value"
          fields={[{ key: 'value', label: 'Current value', type: 'currency', required: true, min: 1 }, { key: 'date', label: 'As of', type: 'date', required: true }, { key: 'note', label: 'Source (where this value came from)', type: 'text', placeholder: 'e.g. Broker estimate, gold rate ₹7,400/g', full: true }]}
          initial={{ date: today() }}
          before={() => <p className="xs muted" style={{ marginBottom: 12 }}>Every update is kept as history and drawn on the value chart.</p>}
          onSubmit={(v) => { saveValuation(ed.assetId, String(v.date), Number(v.value), (v.note as string) || undefined); ok('Value updated'); }} />
      );

    case 'mapContact':
      return (
        <FormSheet<V> open onClose={close} title="Who do you call for this?"
          fields={[
            contactField('contactId', 'Contact', 'service_provider', { required: true, hint: 'From saved contacts, your phone book, or add a new one' }),
            { key: 'purpose', label: 'Purpose', type: 'text', required: true, full: true, placeholder: 'Repair: RO technician · Warranty renewal: brand service centre' },
          ]}
          initial={{}}
          onSubmit={(v) => { mapContact(ed.assetId, String(v.contactId), String(v.purpose)); ok('Contact mapped'); }} />
      );

    case 'contact': {
      const c = ed.contact;
      return (
        <FormSheet<V> open onClose={close} title={c ? 'Edit contact' : 'New contact'}
          fields={[{ key: 'name', label: 'Name', type: 'text', required: true, full: true }, { key: 'type', label: 'Type', type: 'select', required: true, options: CONTACT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ').replace(/^\w/, (x) => x.toUpperCase()) })) }, { key: 'role', label: 'What do they do?', type: 'text', required: (v) => v.type === 'other', showIf: (v) => v.type === 'other', placeholder: 'e.g. Gardener, Driver, Tailor' }, { key: 'phone', label: 'Phone', type: 'tel', required: true }, { key: 'email', label: 'Email', type: 'email' }, { key: 'notes', label: 'Notes', type: 'textarea' }]}
          initial={c ? { ...c } : { type: 'service_provider' }}
          before={(v, set) => <div className="row" style={{ gap: 8, marginBottom: 12 }}><PhoneBookButton onPick={(p) => set({ name: String(v.name ?? '').trim() ? v.name : p.name, phone: p.phone })} /><span className="xs muted">or type the details</span></div>}
          onSubmit={(v) => { upsert('contacts', { ...(c ?? {}), ...(v as unknown as Contact), role: v.type === 'other' ? (v.role as string) : undefined, id: c?.id ?? uid('ct') }); ok(c ? 'Contact updated' : 'Contact added'); }} />
      );
    }

    case 'status': {
      const a = db.assets.find((x) => x.id === ed.assetId)!;
      return (
        <FormSheet<V> open onClose={close} title="Change status"
          fields={[
            { key: 'statusId', label: 'New status', type: 'select', required: true, full: true, options: db.statuses.filter((s) => s.id !== a.statusId).map((s) => ({ value: s.id, label: s.name })), effect: () => ({ reason: undefined }) },
            { key: 'reason', label: 'Reason', type: 'select', required: true, options: (v) => [...(db.statuses.find((s) => s.id === v.statusId)?.reasons ?? []).filter((r) => r !== 'Other').map((r) => ({ value: r, label: r })), ...(v.statusId ? [{ value: OTHER, label: 'Other' }] : [])] },
            { key: 'reasonOther', label: 'What is the reason?', type: 'text', required: (v) => v.reason === OTHER, showIf: (v) => v.reason === OTHER, placeholder: 'Describe in a few words' },
            { key: 'lostDate', label: 'Date lost / stolen', type: 'date', required: (v) => v.statusId === 'st_lost', showIf: (v) => v.statusId === 'st_lost', hint: 'Insurers ask for the exact date' },
            { key: 'place', label: 'From where', type: 'text', showIf: (v) => v.statusId === 'st_lost', placeholder: 'e.g. Baner market parking' },
            { key: 'fir', label: 'Police FIR / complaint no. (if filed)', type: 'text', showIf: (v) => v.statusId === 'st_lost', hint: 'Needed for a theft claim' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          initial={{}}
          before={() => <p className="xs muted" style={{ marginBottom: 12 }}>Current: {db.statuses.find((s) => s.id === a.statusId)?.name}. Changes are kept in the timeline.</p>}
          onSubmit={(v) => {
            const extra = v.statusId === 'st_lost' ? ` · ${v.lostDate}${v.place ? ` from ${v.place}` : ''}${v.fir ? ` · FIR ${v.fir}` : ''}` : '';
            changeStatus(a.id, String(v.statusId), v.reason === OTHER ? String(v.reasonOther).trim() : String(v.reason), `${(v.notes as string) ?? ''}${extra}`.trim() || undefined);
            const ins = db.coverages.find((c) => c.assetId === a.id && c.kind === 'insurance' && !c.supersededById);
            ok('Status changed', v.statusId === 'st_lost' && ins ? `Insured with ${ins.provider} — call your agent to start a claim` : undefined);
          }} />
      );
    }

    case 'member': {
      const m = ed.member;
      return (
        <FormSheet<V> open onClose={close} title={m ? `Edit ${m.name.split(' ')[0]}` : 'Add a family member'}
          fields={[
            { key: 'name', label: 'Full name', type: 'text', required: true, full: true },
            { key: 'relation', label: 'Relation', type: 'select', required: true, options: [...RELATIONS.filter((r) => (r !== 'Self' || m?.relation === 'Self') && r !== 'Other').map((r) => ({ value: r, label: r })), ...(m && !RELATIONS.includes(m.relation) ? [{ value: m.relation, label: m.relation }] : []), { value: OTHER, label: 'Other' }], disabled: m?.relation === 'Self' },
            { key: 'relationOther', label: 'Relation (type it)', type: 'text', required: (v) => v.relation === OTHER, showIf: (v) => v.relation === OTHER, placeholder: 'e.g. Uncle, Cousin, Daughter-in-law' },
            { key: 'dob', label: 'Date of birth', type: 'date' },
            { key: 'gender', label: 'Gender', type: 'select', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'other', label: 'Other' }] },
            mobileField('mob', 'Mobile', false, 'Needed only to invite them to join'),
            { key: 'email', label: 'Email', type: 'email' },
          ]}
          initial={m ? { ...m, mob: m.mobile ? { iso: isoOfDial(m.dial), num: m.mobile } : undefined } : {}}
          before={(v, set) => <div className="stack-sm" style={{ marginBottom: 12 }}>{!m && <p className="xs muted">Add children or elderly parents as profiles — keep their documents, policies and health records without them needing the app.</p>}<div><PhoneBookButton label="Fill from phone book" onPick={(p) => set({ name: String(v.name ?? '').trim() ? v.name : p.name, mob: mobFromBook(p.phone) })} /></div></div>}
          onSubmit={(v) => { const mob = v.mob as Mob | undefined; saveMember({ ...(m ?? { state: 'profile', color: COLORS[db.members.length % COLORS.length], createdAt: new Date().toISOString() } as Member), id: m?.id ?? uid('m'), name: String(v.name), relation: v.relation === OTHER ? String(v.relationOther).trim() : String(v.relation), dob: (v.dob as string) || undefined, gender: (v.gender as Member['gender']) || undefined, mobile: mob?.num || undefined, dial: mob?.num ? countryOf(mob.iso).dial : undefined, email: (v.email as string) || undefined }); ok(m ? 'Saved' : 'Profile added'); }} />
      );
    }

    case 'invite': {
      const m = db.members.find((x) => x.id === ed.memberId)!;
      return (
        <FormSheet<V> open onClose={close} title={`Invite ${m.name.split(' ')[0]}`}
          fields={[
            mobileField('mob', 'Mobile', true),
            { key: 'role', label: 'Role', type: 'select', required: true, options: [{ value: 'adult', label: 'Adult member — add & edit family items' }, { value: 'view_only', label: 'View-only — sees items, gets reminders' }] },
            { key: 'channel', label: 'Send by', type: 'select', required: true, options: [{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'sms', label: 'SMS' }] },
          ]}
          initial={{ mob: m.mobile ? { iso: isoOfDial(m.dial), num: m.mobile } : undefined, role: ['Son', 'Daughter', 'Father', 'Mother', 'Grandparent'].includes(m.relation) ? 'view_only' : 'adult', channel: 'whatsapp' }}
          before={() => <div className="wa-preview"><b>WhatsApp preview</b><p>{db.members.find((x) => x.id === me.id)?.name.split(' ')[0]} wants to add you to <b>{db.settings.familyName}</b> on Mynages. Tap to join: mynages.com/invite/…</p></div>}
          submitLabel="Send invite"
          onSubmit={(v) => {
            if (!gate('member')) return;
            const mob = v.mob as Mob;
            const dial = countryOf(mob.iso).dial;
            saveMember({ ...m, mobile: mob.num, dial });
            inviteMember(m.id, v.channel as 'whatsapp' | 'sms', v.role as 'adult' | 'view_only');
            ok('Invite sent', `${m.name.split(' ')[0]} joins automatically after signing in with +${dial} ${mob.num.slice(0, 2)}••••••${mob.num.slice(-2)}`);
          }} />
      );
    }

    case 'snap': return <SnapSheet onClose={close} onSaved={ed.onSaved} />;

    case 'upgrade': {
      const g = ed.gate;
      const cur = planOf(db.subscription.planId);
      const owner = me.role === 'owner';
      return (
        <Sheet open onClose={close} title="Upgrade needed">
          <div className="stack">
            <div className="upgrade-hero"><Crown size={22} /><div><b>{g.limit}</b><p className="small">{g.reason}</p></div></div>
            <div className="row between small"><span className="muted">Current plan</span><b>{cur.name}</b></div>
            {g.suggest && (
              <div className="plan-pick on">
                <div className="row between"><b>{g.suggest.name}</b><span><b>{planPrice(g.suggest.yearly)}</b><span className="xs muted">/yr</span></span></div>
                <span className="xs muted">{g.suggest.members ? `Owner + ${g.suggest.members} members` : 'Owner only'} · {g.suggest.assets === Infinity ? 'Unlimited' : g.suggest.assets} assets · {g.suggest.storageGb} GB</span>
              </div>
            )}
            {owner ? (
              <button className="btn btn-primary btn-block" onClick={() => { const p = g.suggest ?? cur; changePlan(p.id, db.subscription.cycle); if (db.subscription.status === 'expired') navigate('/more/settings/plan'); ok(db.subscription.status === 'expired' ? 'Choose how to pay' : `Upgraded to ${p.name}`, 'Applies immediately — try again now'); }}>
                {db.subscription.status === 'expired' ? 'Resubscribe' : `Upgrade to ${g.suggest?.name}`}
              </button>
            ) : <div className="alert alert-info small"><Lock size={14} /> Only the family Owner can change the plan. We’ve let {db.members.find((m) => m.id === db.settings.ownerId)?.name.split(' ')[0]} know.</div>}
            <button className="btn btn-ghost btn-block" onClick={() => { close(); navigate('/more/settings/plan'); }}>Compare plans</button>
          </div>
        </Sheet>
      );
    }
  }
}

/** AI capture preview (AI-01, P1): read a policy / invoice, show extracted values for review, save only on confirm (AC-22). */
function SnapSheet({ onClose, onSaved }: { onClose: () => void; onSaved?: (assetId: string) => void }) {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const navigate = useNavigate();
  const [stage, setStage] = useState<'pick' | 'reading' | 'review'>('pick');
  const [sample, setSample] = useState<'policy' | 'invoice'>('policy');
  const [vals, setVals] = useState<Record<string, string>>({});
  const vehicles = db.assets.filter((a) => a.categoryId === 'c_veh' && !a.archived && visible(a, me));
  const read = async (s: 'policy' | 'invoice') => {
    setSample(s); setStage('reading'); await sleep(1600);
    setVals(s === 'policy'
      ? { provider: 'Tata AIG', number: '0160124437 00', policyType: 'motor', asset: vehicles.find((a) => a.subcategoryId === 's_2w')?.id ?? '__new', vehicle: 'Honda Activa 6G', registration: 'MH12 RT 8890', startDate: today(), endDate: addDays(addMonths(today(), 12), -1), premium: '2380', sumInsured: '56000' }
      : { title: 'LG 8 kg front-load washing machine', brand: 'LG', model: 'FHV1408ZWB', price: '38990', date: addDays(today(), -2), seller: 'Croma, Baner', invoice: 'CRM-PN-2026-118822', warrantyMonths: '24' });
    setStage('review');
  };
  const [verr, setVerr] = useState<Record<string, string | undefined>>({});
  const labelOf = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  const typeOf = (k: string): FieldType => (['premium', 'sumInsured', 'price'].includes(k) ? 'currency' : /date$/i.test(k) || k === 'date' ? 'date' : k === 'warrantyMonths' ? 'number' : 'text');
  const set = (k: string, v: string) => { const r = ruleFor(k, labelOf(k), typeOf(k)); setVals({ ...vals, [k]: r.sanitize ? r.sanitize(v) : v }); setVerr({ ...verr, [k]: undefined }); };
  const stamp = () => ({ createdBy: me.id, createdAt: new Date().toISOString() });
  const confirm = () => {
    const errs: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(vals)) {
      if (k === 'asset' || (['vehicle', 'registration'].includes(k) && vals.asset !== '__new')) continue;
      errs[k] = !v.trim() ? `${labelOf(k)} is required` : checkValue(k === 'date' ? 'purchase date' : k, labelOf(k), typeOf(k), v.trim());
    }
    if (!errs.endDate && vals.startDate && vals.endDate && vals.endDate <= vals.startDate) errs.endDate = 'Must be after the start date';
    setVerr(errs);
    if (Object.values(errs).some(Boolean)) { toast({ type: 'error', title: 'Please fix the highlighted fields' }); return; }
    try {
      let assetId: string;
      if (sample === 'policy') {
        let a = db.assets.find((x) => x.id === vals.asset);
        if (!a && vals.asset !== '__new') { toast({ type: 'error', title: 'Choose which vehicle this policy covers' }); return; }
        if (!a) {
          const [make, ...model] = vals.vehicle.trim().split(/\s+/);
          a = saveAsset({ id: '', code: '', name: vals.vehicle.trim() || 'Two-wheeler', categoryId: 'c_veh', subcategoryId: 's_2w', ownerMemberId: me.id, propertyId: db.properties[0]?.id, statusId: 'st_active', fields: { make: make || 'Honda', model: model.join(' ') || 'Activa', registration_number: vals.registration }, tags: ['scanned'], archived: false, color: '#3B6FB6', space: 'family', ...stamp() }, true);
        }
        saveCoverage({ id: uid('cov'), kind: 'insurance', policyType: 'motor', linkedType: 'asset', assetId: a.id, insured: [], provider: vals.provider, number: vals.number, startDate: vals.startDate, endDate: vals.endDate, premium: Number(vals.premium), sumInsured: Number(vals.sumInsured), premiumFrequency: 'yearly', space: a.space, privateOwnerId: a.privateOwnerId, ...stamp() }, true);
        saveDoc({ id: uid('doc'), title: `Motor policy — ${vals.provider}`, category: 'Coverage', ownerType: 'asset', ownerId: a.id, number: vals.number, issuer: vals.provider, expiryDate: vals.endDate, tags: ['scanned'], fileName: 'policy_scan.pdf', size: 310_000, pages: 3, space: a.space, privateOwnerId: a.privateOwnerId, ...stamp() });
        toast({ type: 'success', title: 'Policy saved', message: `${a.name}: insurance, document and renewal reminder` });
        assetId = a.id;
      } else {
        const a = saveAsset({ id: '', code: '', name: vals.title.trim() || 'Washing machine', categoryId: 'c_app', subcategoryId: 's_wm', ownerMemberId: me.id, propertyId: db.properties[0]?.id, statusId: 'st_active', purchaseDate: vals.date, purchaseCost: Number(vals.price) || undefined, invoiceNo: vals.invoice, fields: { brand: vals.brand, model: vals.model }, tags: ['scanned'], archived: false, color: '#0E9384', space: 'family', ...stamp() }, true);
        const months = Number(vals.warrantyMonths) || 12;
        saveCoverage({ id: uid('cov'), kind: 'warranty', linkedType: 'asset', assetId: a.id, insured: [], provider: vals.brand, number: vals.invoice, startDate: vals.date, endDate: addDays(addMonths(vals.date, months), -1), space: a.space, privateOwnerId: a.privateOwnerId, ...stamp() }, true);
        saveDoc({ id: uid('doc'), title: `Invoice — ${vals.seller}`, category: 'Purchase', ownerType: 'asset', ownerId: a.id, number: vals.invoice, issuer: vals.seller, tags: ['scanned'], fileName: 'invoice_scan.pdf', size: 180_000, pages: 1, space: a.space, privateOwnerId: a.privateOwnerId, ...stamp() });
        toast({ type: 'success', title: 'Asset added from invoice', message: `${a.name}: ${months}-month warranty, invoice and reminder` });
        assetId = a.id;
      }
      onClose();
      navigate(`/assets/${assetId}`);
      onSaved?.(assetId);
    } catch (e) { toast({ type: 'error', title: e instanceof Error ? e.message : 'Could not save' }); }
  };
  return (
    <Sheet open onClose={onClose} title="Snap a document" subtitle="We read the document and fill the details — nothing is saved until you confirm" full>
      {stage === 'pick' && (
        <div className="stack">
          <div className="snap-cam"><Camera size={36} /><span className="small">Point the camera at a policy, invoice, warranty card or RC</span></div>
          <p className="xs muted">Or choose a recent photo:</p>
          <button className="mrow" onClick={() => read('policy')}><span className="icon-tile sm"><FileText size={16} /></span><span className="row-text"><b>Two-wheeler insurance policy</b><em>Tata AIG · 3 pages</em></span></button>
          <button className="mrow" onClick={() => read('invoice')}><span className="icon-tile sm"><FileText size={16} /></span><span className="row-text"><b>Purchase invoice</b><em>Washing machine · 1 page</em></span></button>
        </div>
      )}
      {stage === 'reading' && <div className="empty"><Loader2 size={28} className="spinner" /><h4>Reading the document…</h4><p className="small">Finding insurer, policy number, dates and amounts</p></div>}
      {stage === 'review' && (
        <div className="stack">
          <div className="alert alert-info small"><Sparkles size={15} /> Check what we found. Edit anything that’s wrong, then confirm.</div>
          {Object.entries(vals).filter(([k]) => !(['vehicle', 'registration'].includes(k) && vals.asset !== '__new')).map(([k, v]) => (
            <div className="field" key={k}>
              <span className="field-label">{labelOf(k)}</span>
              {k === 'asset' ? (
                <Select aria-label="Vehicle" value={v} onChange={(e) => set(k, e.target.value)}>
                  {vehicles.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  <option value="__new">Add as a new vehicle</option>
                </Select>
              ) : <input className={cx('input', verr[k] && 'invalid')} type={typeOf(k) === 'date' ? 'date' : 'text'} inputMode={ruleFor(k, labelOf(k), typeOf(k)).inputMode} maxLength={ruleFor(k, labelOf(k), typeOf(k)).maxLength} value={v} onChange={(e) => set(k, e.target.value)} />}
              {verr[k] && <span className="field-error" role="alert">{verr[k]}</span>}
            </div>
          ))}
          <div className="row"><button className="btn grow" onClick={() => setStage('pick')}>Scan again</button><button className="btn btn-primary grow" onClick={confirm}><Check size={15} /> Confirm & save</button></div>
        </div>
      )}
    </Sheet>
  );
}

export { PLANS };
