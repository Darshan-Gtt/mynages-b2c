import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, ClipboardList, FileText, IndianRupee, Loader2, Lock, Package, Phone, ScanLine, Sparkles, Bell, Crown } from 'lucide-react';
import { FormSheet, type FieldSpec, type Opt } from '../ui/EntityForm';
import { Sheet } from '../ui/Modal';
import { FileDrop, type PickedFile } from '../ui/Form';
import { useToast } from '../ui/Toast';
import { AssetSheet } from './AssetSheet';
import { getDb, useDb } from '../../lib/store';
import { useMe, useSpace } from '../../lib/session';
import { canCreateIn, entitlement, visible, type Gate } from '../../lib/access';
import {
  ActionError, changePlan, changeStatus, completeObligation, inviteMember, mapContact, renewCoverage, saveCoverage, saveDoc, saveExpense, saveMember, saveObligation,
  saveService, saveTask, saveValuation, upsert,
} from '../../lib/actions';
import { addDays, addMonths, inr, sleep, today, uid } from '../../lib/utils';
import { CONTACT_TYPES, OBLIGATION_TYPES, PLANS, POLICY_TYPES, RELATIONS, planOf, COLORS } from '../../data/masters';
import type { Asset, Contact, Coverage, Doc, Expense, Member, Obligation, Space, Task } from '../../lib/types';

export type Ed =
  | { kind: 'add' }
  | { kind: 'asset'; asset?: Asset }
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
  | { kind: 'snap' }
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
const RECUR: Opt[] = [{ value: 'none', label: 'Does not repeat' }, { value: 'monthly', label: 'Every month' }, { value: 'quarterly', label: 'Every 3 months' }, { value: 'half_yearly', label: 'Every 6 months' }, { value: 'yearly', label: 'Every year' }];

function Active({ ed, close, open, gate }: { ed: Ed; close: () => void; open: (e: Ed) => void; gate: Api['gate'] }) {
  const db = useDb();
  const me = useMe()!;
  const space = useSpace();
  const toast = useToast();
  const navigate = useNavigate();
  const [file, setFile] = useState<PickedFile>();
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
    case 'asset': return <AssetSheet asset={ed.asset} onClose={close} />;

    case 'coverage': {
      const c = ed.coverage;
      const person = c ? c.linkedType === 'member' : !!ed.memberId || (!ed.assetId && ed.insurance);
      const fields: FieldSpec<V>[] = [
        { key: 'linkedType', label: 'Covers', type: 'select', required: true, disabled: !!c || !!ed.assetId || !!ed.memberId, options: [{ value: 'asset', label: 'An asset' }, { value: 'member', label: 'Family members (health, life…)' }] },
        { key: 'assetId', label: 'Asset', type: 'select', required: (v) => v.linkedType === 'asset', showIf: (v) => v.linkedType === 'asset', options: assetOpts, disabled: !!ed.assetId || !!c },
        { key: 'kind', label: 'Type', type: 'select', required: true, showIf: (v) => v.linkedType === 'asset', options: [{ value: 'insurance', label: 'Insurance' }, { value: 'warranty', label: 'Warranty' }, { value: 'extended_warranty', label: 'Extended warranty' }, { value: 'amc', label: 'AMC' }] },
        { key: 'policyType', label: 'Policy type', type: 'select', required: (v) => v.kind === 'insurance' || v.linkedType === 'member', showIf: (v) => v.kind === 'insurance' || v.linkedType === 'member', options: (v) => POLICY_TYPES.filter((p) => (v.linkedType === 'member' ? p.group !== 'asset' : p.group === 'asset')).map((p) => ({ value: p.id, label: p.label })) },
        { key: 'insured', label: 'Insured members', type: 'multiselect', required: (v) => v.linkedType === 'member', showIf: (v) => v.linkedType === 'member', options: memberOpts() },
        { key: 'provider', label: 'Insurer / provider', type: 'text', required: true, placeholder: 'e.g. Star Health, LG, Kent' },
        { key: 'number', label: 'Policy / contract no.', type: 'text', required: true },
        { key: 'startDate', label: 'Start', type: 'date', required: true },
        { key: 'endDate', label: 'End / expiry', type: 'date', required: true, validate: (v, f) => (String(v) <= String(f.startDate) ? 'Must be after the start' : undefined) },
        { key: 'sumInsured', label: 'Sum insured', type: 'currency', showIf: (v) => v.kind === 'insurance' || v.linkedType === 'member' },
        { key: 'premium', label: 'Premium / cost', type: 'currency', showIf: (v) => v.kind !== 'warranty' },
        { key: 'premiumFrequency', label: 'Premium paid', type: 'select', showIf: (v) => v.kind === 'insurance' || v.linkedType === 'member', options: [{ value: 'yearly', label: 'Yearly' }, { value: 'half_yearly', label: 'Half-yearly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'monthly', label: 'Monthly' }, { value: 'single', label: 'Single premium' }] },
        { key: 'maturityDate', label: 'Maturity date', type: 'date', showIf: (v) => ['endowment', 'ulip', 'life'].includes(String(v.policyType)) },
        { key: 'maturityValue', label: 'Maturity value', type: 'currency', showIf: (v) => ['endowment', 'ulip', 'life'].includes(String(v.policyType)) },
        { key: 'nominee', label: 'Nominee', type: 'text', showIf: (v) => v.linkedType === 'member' },
        { key: 'agentContactId', label: 'Agent / service contact', type: 'select', options: db.contacts.map((x) => ({ value: x.id, label: x.name })) },
        ...(!c ? [{ key: 'reminder', label: 'Reminder', type: 'checkbox', hint: 'Remind the family before it expires' } as FieldSpec<V>] : []),
      ];
      return (
        <FormSheet<V> open onClose={close} title={c ? 'Edit coverage' : person ? 'Add a policy' : 'Add insurance / warranty'} fields={fields}
          initial={c ? { ...c, insured: c.insured.map((i) => i.memberId) } : { linkedType: person ? 'member' : 'asset', assetId: ed.assetId, insured: ed.memberId ? [ed.memberId] : [], kind: person || ed.insurance ? 'insurance' : 'warranty', startDate: today(), endDate: addMonths(today(), 12), premiumFrequency: 'yearly', reminder: true }}
          onSubmit={(v) => {
            const lt = v.linkedType as 'asset' | 'member';
            const os = lt === 'asset' ? ownerSpace(String(v.assetId)) : c ? { space: c.space, privateOwnerId: c.privateOwnerId } : ownerSpace();
            const row: Coverage = {
              ...(c ?? { createdBy: me.id, createdAt: new Date().toISOString() } as Coverage), id: c?.id ?? uid('cov'), linkedType: lt, assetId: lt === 'asset' ? String(v.assetId) : undefined,
              kind: lt === 'member' ? 'insurance' : (v.kind as Coverage['kind']), policyType: (v.policyType as Coverage['policyType']) || undefined,
              insured: lt === 'member' ? (v.insured as string[]).map((id) => ({ memberId: id, cover: v.sumInsured ? Number(v.sumInsured) : undefined })) : [],
              provider: String(v.provider), number: String(v.number), startDate: String(v.startDate), endDate: String(v.endDate), sumInsured: v.sumInsured ? Number(v.sumInsured) : undefined,
              premium: v.premium ? Number(v.premium) : undefined, premiumFrequency: (v.premiumFrequency as Coverage['premiumFrequency']) || undefined, maturityDate: (v.maturityDate as string) || undefined,
              maturityValue: v.maturityValue ? Number(v.maturityValue) : undefined, nominee: (v.nominee as string) || undefined, agentContactId: (v.agentContactId as string) || undefined, ...os,
            };
            saveCoverage(row, !!v.reminder);
            ok(c ? 'Coverage updated' : 'Coverage added', v.reminder ? 'Renewal reminder set' : undefined);
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
      return (
        <FormSheet<V> open onClose={close} title={o ? 'Edit reminder' : 'New reminder'}
          fields={[
            { key: 'title', label: 'What’s due', type: 'text', required: true, full: true, placeholder: 'e.g. PUC — Activa' },
            { key: 'type', label: 'Type', type: 'select', required: true, options: OBLIGATION_TYPES.map((t) => ({ value: t.id, label: t.label })), effect: (val) => ({ reminders: OBLIGATION_TYPES.find((t) => t.id === val)?.presets }) },
            { key: 'assetId', label: 'For asset', type: 'select', options: assetOpts, emptyLabel: 'None', disabled: !!ed.assetId },
            { key: 'memberId', label: 'For person', type: 'select', options: memberOpts(), emptyLabel: 'None', showIf: (v) => !v.assetId },
            { key: 'dueDate', label: 'Due date', type: 'date', required: true },
            { key: 'amount', label: 'Amount', type: 'currency' },
            { key: 'recurrence', label: 'Repeats', type: 'select', required: true, options: RECUR },
            { key: 'autoRenew', label: 'Auto-renew', type: 'checkbox', hint: 'Renews automatically (remind me to cancel if not needed)' },
            { key: 'reminders', label: 'Remind me', type: 'multiselect', options: presetOpts(), validate: (x) => ((x as string[] | undefined)?.length ? undefined : 'Pick at least one') },
            { key: 'contactId', label: 'Contact to call', type: 'select', options: db.contacts.map((x) => ({ value: x.id, label: x.name })) },
          ]}
          initial={o ? { ...o } : { title: '', type: 'custom', assetId: ed.assetId, memberId: ed.memberId, dueDate: addDays(today(), 30), recurrence: 'none', reminders: ['rp_7d', 'rp_1d'] }}
          after={(v) => <p className="xs muted" style={{ marginTop: 10 }}>{ownerSpace(v.assetId as string).space === 'private' ? '🔒 Private — only you will be reminded.' : `Everyone in ${db.settings.familyName} with reminders on will be notified.`}</p>}
          onSubmit={(v) => {
            const os = o ? { space: o.space, privateOwnerId: o.privateOwnerId } : ownerSpace(v.assetId as string);
            saveObligation({ ...(o ?? { status: 'open', createdBy: me.id, createdAt: new Date().toISOString() } as Obligation), id: o?.id ?? uid('ob'), title: String(v.title), type: v.type as Obligation['type'], assetId: (v.assetId as string) || undefined, memberId: v.assetId ? undefined : (v.memberId as string) || undefined, dueDate: String(v.dueDate), amount: v.amount ? Number(v.amount) : undefined, recurrence: v.recurrence as Obligation['recurrence'], autoRenew: !!v.autoRenew, reminders: v.reminders as string[], contactId: (v.contactId as string) || undefined, ...os });
            ok(o ? 'Reminder updated' : 'Reminder added');
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
            { key: 'dueTime', label: 'Time', type: 'time', hint: 'Blank = all day' },
            { key: 'priority', label: 'Priority', type: 'select', required: true, options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }] },
            { key: 'recurrence', label: 'Repeats', type: 'select', required: true, options: RECUR },
            { key: 'assetId', label: 'About asset', type: 'select', options: assetOpts, emptyLabel: 'None', disabled: !!ed.assetId },
            { key: 'memberId', label: 'About person', type: 'select', options: memberOpts(), emptyLabel: 'None', showIf: (v) => !v.assetId },
            { key: 'reminders', label: 'Remind', type: 'multiselect', options: presetOpts() },
            { key: 'description', label: 'Notes', type: 'textarea' },
          ]}
          initial={t ? { ...t } : { title: '', assigneeId: me.id, dueDate: addDays(today(), 2), priority: 'medium', recurrence: 'none', assetId: ed.assetId, memberId: ed.memberId, reminders: ['rp_1d'] }}
          onSubmit={(v) => {
            const os = t ? { space: t.space, privateOwnerId: t.privateOwnerId } : ownerSpace(v.assetId as string);
            saveTask({ ...(t ?? { status: 'pending', createdBy: me.id, createdAt: new Date().toISOString() } as Task), id: t?.id ?? uid('t'), title: String(v.title), assigneeId: String(v.assigneeId), dueDate: String(v.dueDate), dueTime: (v.dueTime as string) || undefined, priority: v.priority as Task['priority'], recurrence: v.recurrence as Task['recurrence'], assetId: (v.assetId as string) || undefined, memberId: v.assetId ? undefined : (v.memberId as string) || undefined, reminders: (v.reminders as string[]) ?? [], description: (v.description as string) || undefined, ...os });
            ok(t ? 'Task updated' : 'Task added', v.assigneeId !== me.id ? `${db.members.find((m) => m.id === v.assigneeId)?.name.split(' ')[0]} has been notified` : undefined);
          }} />
      );
    }

    case 'document': {
      const doc = ed.doc;
      const cats = db.settings.docCategories;
      return (
        <FormSheet<V> open onClose={close} title={doc ? 'Edit document' : 'Add document'}
          fields={[
            { key: 'ownerType', label: 'Belongs to', type: 'select', required: true, disabled: !!ed.ownerId || !!doc, options: [{ value: 'asset', label: 'An asset' }, { value: 'member', label: 'A person' }], effect: (x) => ({ ownerId: undefined, category: x === 'member' ? cats.person[0] : cats.asset[0] }) },
            { key: 'ownerId', label: 'Which one', type: 'select', required: true, disabled: !!ed.ownerId || !!doc, options: (v) => (v.ownerType === 'member' ? memberOpts() : assetOpts) },
            { key: 'title', label: 'Title', type: 'text', required: true, full: true, placeholder: 'e.g. Aadhaar card, RC, Warranty card' },
            { key: 'category', label: 'Category', type: 'select', required: true, options: (v) => (v.ownerType === 'member' ? cats.person : cats.asset).map((x) => ({ value: x, label: x })) },
            { key: 'number', label: 'Document no.', type: 'text' },
            { key: 'issuer', label: 'Issued by', type: 'text' },
            { key: 'issueDate', label: 'Issue date', type: 'date' },
            { key: 'expiryDate', label: 'Expiry date', type: 'date', hint: doc ? undefined : 'We’ll remind 30 and 7 days before' },
            { key: 'tags', label: 'Tags', type: 'text' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          initial={doc ? { ...doc, tags: doc.tags.join(', ') } : { ownerType: ed.ownerType ?? 'asset', ownerId: ed.ownerId, category: ed.category ?? (ed.ownerType === 'member' ? cats.person[0] : cats.asset[0]), title: '' }}
          before={() => !doc ? <div className="row" style={{ gap: 8, marginBottom: 12 }}><button type="button" className="btn btn-sm" onClick={() => setFile({ name: `Scan_${new Date().toISOString().slice(0, 10)}.pdf`, size: 420_000, type: 'application/pdf' })}><ScanLine size={14} /> Scan with camera</button><span className="xs muted">or upload below</span></div> : null}
          after={() => !doc ? <div className="field" style={{ marginTop: 12 }}><span className="field-label">File <span className="req">*</span></span><FileDrop value={file} onChange={setFile} accept="image/*,.pdf" hint="Photo or PDF · up to 10 MB" /></div> : null}
          submitLabel={doc ? 'Save' : 'Save document'}
          onSubmit={(v) => {
            if (!doc && !file) throw new ActionError('Scan or upload the document');
            const os = doc ? { space: doc.space, privateOwnerId: doc.privateOwnerId } : v.ownerType === 'asset' ? ownerSpace(String(v.ownerId)) : ownerSpace();
            saveDoc({ ...(doc ?? { createdBy: me.id, createdAt: new Date().toISOString(), fileName: file!.name, size: file!.size, pages: 1 } as Doc), id: doc?.id ?? uid('doc'), title: String(v.title), category: String(v.category), ownerType: v.ownerType as Doc['ownerType'], ownerId: String(v.ownerId), number: (v.number as string) || undefined, issuer: (v.issuer as string) || undefined, issueDate: (v.issueDate as string) || undefined, expiryDate: (v.expiryDate as string) || undefined, tags: String(v.tags ?? '').split(',').map((x) => x.trim()).filter(Boolean), notes: (v.notes as string) || undefined, ...os });
            ok(doc ? 'Document updated' : 'Document saved');
          }} />
      );
    }

    case 'service': {
      const sch = db.schedules.filter((s) => s.assetId === ed.assetId);
      return (
        <FormSheet<V> open onClose={close} title="Log service"
          fields={[
            { key: 'date', label: 'Date', type: 'date', required: true, validate: (x) => (String(x) > today() ? 'Can’t be in the future' : undefined) },
            { key: 'provider', label: 'Done by', type: 'text', required: true, placeholder: 'Service centre or technician' },
            { key: 'workDone', label: 'Work done', type: 'textarea', required: true },
            { key: 'cost', label: 'Cost', type: 'currency', hint: 'Added to this asset’s expenses' },
            { key: 'reading', label: 'Reading', type: 'text', placeholder: 'e.g. 48,210 km' },
            { key: 'scheduleId', label: 'Against schedule', type: 'select', options: sch.map((s) => ({ value: s.id, label: s.title })), emptyLabel: 'Unscheduled' },
          ]}
          initial={{ date: today(), cost: 0, scheduleId: ed.scheduleId, provider: db.contacts.find((c) => c.id === sch.find((s) => s.id === ed.scheduleId)?.contactId)?.name ?? '' }}
          onSubmit={(v) => { saveService({ id: uid('sv'), assetId: ed.assetId, date: String(v.date), provider: String(v.provider), workDone: String(v.workDone), cost: Number(v.cost) || 0, reading: (v.reading as string) || undefined, scheduleId: (v.scheduleId as string) || undefined, createdBy: me.id }); ok('Service logged'); }} />
      );
    }

    case 'schedule':
      return (
        <FormSheet<V> open onClose={close} title="Service schedule"
          fields={[{ key: 'title', label: 'What', type: 'text', required: true, full: true, placeholder: 'e.g. RO filter change' }, { key: 'intervalDays', label: 'Every (days)', type: 'number', required: true, min: 1 }, { key: 'nextDue', label: 'Next due', type: 'date', required: true }, { key: 'contactId', label: 'Who does it', type: 'select', options: db.contacts.map((c) => ({ value: c.id, label: c.name })) }]}
          initial={{ intervalDays: 90, nextDue: addDays(today(), 30), title: '' }}
          onSubmit={(v) => { upsert('schedules', { id: uid('sc'), assetId: ed.assetId, title: String(v.title), intervalDays: Number(v.intervalDays), nextDue: String(v.nextDue), contactId: (v.contactId as string) || undefined, active: true }); ok('Schedule added'); }} />
      );

    case 'expense': {
      const e = ed.expense;
      return (
        <FormSheet<V> open onClose={close} title={e ? 'Edit expense' : 'Add expense'}
          fields={[
            { key: 'assetId', label: 'Asset', type: 'select', required: true, options: assetOpts, disabled: !!ed.assetId || !!e },
            { key: 'type', label: 'Type', type: 'select', required: true, options: ['Fuel', 'Service', 'Repairs & painting', 'Spares', 'Insurance', 'AMC', 'Tax', 'Bills', 'Society maintenance', 'Subscription', 'Accessories', 'Other'].map((x) => ({ value: x, label: x })) },
            { key: 'amount', label: 'Amount', type: 'currency', required: true, min: 1 },
            { key: 'date', label: 'Date', type: 'date', required: true },
            { key: 'paidBy', label: 'Paid by', type: 'select', required: true, options: memberOpts() },
            { key: 'notes', label: 'Notes', type: 'text', full: true },
          ]}
          initial={e ? { ...e } : { assetId: ed.assetId, type: 'Fuel', date: today(), paidBy: me.id }}
          onSubmit={(v) => { saveExpense({ ...(e ?? { createdBy: me.id } as Expense), id: e?.id ?? uid('ex'), assetId: String(v.assetId), type: String(v.type), amount: Number(v.amount), date: String(v.date), paidBy: String(v.paidBy), notes: (v.notes as string) || undefined }); ok(e ? 'Expense updated' : 'Expense added', inr(Number(v.amount))); }} />
      );
    }

    case 'valuation':
      return (
        <FormSheet<V> open onClose={close} title="Update current value"
          fields={[{ key: 'value', label: 'Current value', type: 'currency', required: true, min: 1 }, { key: 'date', label: 'As of', type: 'date', required: true }, { key: 'note', label: 'Source', type: 'text', placeholder: 'e.g. Broker estimate, gold rate ₹7,400/g', full: true }]}
          initial={{ date: today() }}
          before={() => <p className="xs muted" style={{ marginBottom: 12 }}>Every update is kept as history and drawn on the value chart.</p>}
          onSubmit={(v) => { saveValuation(ed.assetId, String(v.date), Number(v.value), (v.note as string) || undefined); ok('Value updated'); }} />
      );

    case 'mapContact':
      return (
        <FormSheet<V> open onClose={close} title="Who do you call for this?"
          fields={[
            { key: 'contactId', label: 'Contact', type: 'select', required: true, full: true, options: db.contacts.map((c) => ({ value: c.id, label: c.name })), hint: 'Add or import contacts from More → Contacts' },
            { key: 'purpose', label: 'Purpose', type: 'text', required: true, full: true, placeholder: 'Repair: RO technician · Warranty renewal: brand service centre' },
          ]}
          initial={{}}
          onSubmit={(v) => { mapContact(ed.assetId, String(v.contactId), String(v.purpose)); ok('Contact mapped'); }} />
      );

    case 'contact': {
      const c = ed.contact;
      return (
        <FormSheet<V> open onClose={close} title={c ? 'Edit contact' : 'New contact'}
          fields={[{ key: 'name', label: 'Name', type: 'text', required: true, full: true }, { key: 'type', label: 'Type', type: 'select', required: true, options: CONTACT_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ').replace(/^\w/, (x) => x.toUpperCase()) })) }, { key: 'phone', label: 'Phone', type: 'tel', required: true }, { key: 'email', label: 'Email', type: 'email' }, { key: 'notes', label: 'Notes', type: 'textarea' }]}
          initial={c ? { ...c } : { type: 'service_provider' }}
          onSubmit={(v) => { upsert('contacts', { ...(c ?? {}), ...(v as unknown as Contact), id: c?.id ?? uid('ct') }); ok(c ? 'Contact updated' : 'Contact added'); }} />
      );
    }

    case 'status': {
      const a = db.assets.find((x) => x.id === ed.assetId)!;
      return (
        <FormSheet<V> open onClose={close} title="Change status"
          fields={[
            { key: 'statusId', label: 'New status', type: 'select', required: true, full: true, options: db.statuses.filter((s) => s.id !== a.statusId).map((s) => ({ value: s.id, label: s.name })), effect: () => ({ reason: undefined }) },
            { key: 'reason', label: 'Reason', type: 'select', required: true, options: (v) => (db.statuses.find((s) => s.id === v.statusId)?.reasons ?? []).map((r) => ({ value: r, label: r })) },
            { key: 'lostDate', label: 'Date lost / stolen', type: 'date', required: (v) => v.statusId === 'st_lost', showIf: (v) => v.statusId === 'st_lost', hint: 'Insurers ask for the exact date' },
            { key: 'place', label: 'Where', type: 'text', required: (v) => v.statusId === 'st_lost', showIf: (v) => v.statusId === 'st_lost' },
            { key: 'fir', label: 'Police FIR / complaint no.', type: 'text', showIf: (v) => v.statusId === 'st_lost', hint: 'Needed for a theft claim' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          initial={{}}
          before={() => <p className="xs muted" style={{ marginBottom: 12 }}>Current: {db.statuses.find((s) => s.id === a.statusId)?.name}. Changes are kept in the timeline.</p>}
          onSubmit={(v) => {
            const extra = v.statusId === 'st_lost' ? ` · ${v.lostDate} at ${v.place}${v.fir ? ` · FIR ${v.fir}` : ''}` : '';
            changeStatus(a.id, String(v.statusId), String(v.reason), `${(v.notes as string) ?? ''}${extra}`.trim() || undefined);
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
            { key: 'relation', label: 'Relation', type: 'select', required: true, options: RELATIONS.filter((r) => r !== 'Self' || m?.relation === 'Self').map((r) => ({ value: r, label: r })), disabled: m?.relation === 'Self' },
            { key: 'dob', label: 'Date of birth', type: 'date' },
            { key: 'gender', label: 'Gender', type: 'select', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'other', label: 'Other' }] },
            { key: 'mobile', label: 'Mobile', type: 'tel', hint: 'Needed only to invite them to join', validate: (x) => (x && !/^[6-9]\d{9}$/.test(String(x)) ? 'Enter a 10-digit mobile' : undefined) },
            { key: 'email', label: 'Email', type: 'email' },
          ]}
          initial={m ? { ...m } : {}}
          before={() => !m ? <p className="xs muted" style={{ marginBottom: 12 }}>Add children or elderly parents as profiles — keep their documents, policies and health records without them needing the app.</p> : null}
          onSubmit={(v) => { saveMember({ ...(m ?? { state: 'profile', color: COLORS[db.members.length % COLORS.length], createdAt: new Date().toISOString() } as Member), id: m?.id ?? uid('m'), name: String(v.name), relation: String(v.relation), dob: (v.dob as string) || undefined, gender: (v.gender as Member['gender']) || undefined, mobile: (v.mobile as string) || undefined, email: (v.email as string) || undefined }); ok(m ? 'Saved' : 'Profile added'); }} />
      );
    }

    case 'invite': {
      const m = db.members.find((x) => x.id === ed.memberId)!;
      return (
        <FormSheet<V> open onClose={close} title={`Invite ${m.name.split(' ')[0]}`}
          fields={[
            { key: 'mobile', label: 'Mobile', type: 'tel', required: true, validate: (x) => (!/^[6-9]\d{9}$/.test(String(x)) ? 'Enter a 10-digit mobile' : undefined) },
            { key: 'role', label: 'Role', type: 'select', required: true, options: [{ value: 'adult', label: 'Adult member — add & edit family items' }, { value: 'view_only', label: 'View-only — sees items, gets reminders' }] },
            { key: 'channel', label: 'Send by', type: 'select', required: true, options: [{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'sms', label: 'SMS' }] },
          ]}
          initial={{ mobile: m.mobile ?? '', role: ['Son', 'Daughter', 'Father', 'Mother', 'Grandparent'].includes(m.relation) ? 'view_only' : 'adult', channel: 'whatsapp' }}
          before={() => <div className="wa-preview"><b>WhatsApp preview</b><p>{db.members.find((x) => x.id === me.id)?.name.split(' ')[0]} wants to add you to <b>{db.settings.familyName}</b> on Mynages. Tap to join: mynages.com/invite/…</p></div>}
          submitLabel="Send invite"
          onSubmit={(v) => {
            if (!gate('member')) return;
            saveMember({ ...m, mobile: String(v.mobile) });
            inviteMember(m.id, v.channel as 'whatsapp' | 'sms', v.role as 'adult' | 'view_only');
            ok('Invite sent', `${m.name.split(' ')[0]} joins automatically after signing in with +91 ${String(v.mobile).slice(0, 2)}••••••${String(v.mobile).slice(-2)}`);
          }} />
      );
    }

    case 'snap': return <SnapSheet onClose={close} />;

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
                <div className="row between"><b>{g.suggest.name}</b><span><b>{inr(g.suggest.yearly)}</b><span className="xs muted">/yr</span></span></div>
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
function SnapSheet({ onClose }: { onClose: () => void }) {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const [stage, setStage] = useState<'pick' | 'reading' | 'review'>('pick');
  const [sample, setSample] = useState<'policy' | 'invoice'>('policy');
  const [vals, setVals] = useState<Record<string, string>>({});
  const read = async (s: 'policy' | 'invoice') => {
    setSample(s); setStage('reading'); await sleep(1600);
    setVals(s === 'policy'
      ? { provider: 'Tata AIG', number: '0160124437 00', policyType: 'motor', asset: 'a_activa', startDate: today(), endDate: addDays(addMonths(today(), 12), -1), premium: '2380', sumInsured: '56000' }
      : { title: 'Philips Air Fryer HD9252', brand: 'Philips', model: 'HD9252/90', price: '8999', date: addDays(today(), -2), seller: 'Amazon.in', invoice: 'IN-BOM4-2026-118822', warrantyMonths: '24' });
    setStage('review');
  };
  const set = (k: string, v: string) => setVals({ ...vals, [k]: v });
  const confirm = () => {
    if (sample === 'policy') {
      const a = db.assets.find((x) => x.id === vals.asset);
      if (!a) { toast({ type: 'error', title: 'Choose which asset this policy covers' }); return; }
      saveCoverage({ id: uid('cov'), kind: 'insurance', policyType: 'motor', linkedType: 'asset', assetId: a.id, insured: [], provider: vals.provider, number: vals.number, startDate: vals.startDate, endDate: vals.endDate, premium: Number(vals.premium), sumInsured: Number(vals.sumInsured), premiumFrequency: 'yearly', space: a.space, privateOwnerId: a.privateOwnerId, createdBy: me.id, createdAt: new Date().toISOString() }, true);
      saveDoc({ id: uid('doc'), title: `Motor policy — ${vals.provider}`, category: 'Coverage', ownerType: 'asset', ownerId: a.id, number: vals.number, issuer: vals.provider, expiryDate: vals.endDate, tags: ['scanned'], fileName: 'policy_scan.pdf', size: 310_000, pages: 3, space: a.space, privateOwnerId: a.privateOwnerId, createdBy: me.id, createdAt: new Date().toISOString() });
      toast({ type: 'success', title: 'Policy saved', message: `${a.name}: insurance, document and renewal reminder` });
    } else {
      toast({ type: 'info', title: 'Continue in Add asset', message: 'Pick Home appliances → choose a type; we’ve noted the invoice details' });
    }
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Snap a document" subtitle="Preview of AI capture (planned P1) — nothing is saved until you confirm" full>
      {stage === 'pick' && (
        <div className="stack">
          <div className="snap-cam"><Camera size={36} /><span className="small">Point the camera at a policy, invoice, warranty card or RC</span></div>
          <p className="xs muted">Demo: pick a sample to “scan”.</p>
          <button className="mrow" onClick={() => read('policy')}><span className="icon-tile sm"><FileText size={16} /></span><span className="row-text"><b>Two-wheeler insurance policy</b><em>Tata AIG · 3 pages</em></span></button>
          <button className="mrow" onClick={() => read('invoice')}><span className="icon-tile sm"><FileText size={16} /></span><span className="row-text"><b>Amazon invoice</b><em>Air fryer · 1 page</em></span></button>
        </div>
      )}
      {stage === 'reading' && <div className="empty"><Loader2 size={28} className="spinner" /><h4>Reading the document…</h4><p className="small">Finding insurer, policy number, dates and amounts</p></div>}
      {stage === 'review' && (
        <div className="stack">
          <div className="alert alert-info small"><Sparkles size={15} /> Check what we found. Edit anything that’s wrong, then confirm.</div>
          {Object.entries(vals).map(([k, v]) => (
            <div className="field" key={k}>
              <span className="field-label">{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
              {k === 'asset' ? (
                <select className="select" value={v} onChange={(e) => set(k, e.target.value)}>
                  <option value="">Choose asset</option>
                  {db.assets.filter((a) => a.categoryId === 'c_veh' && visible(a, me)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : <input className="input" value={v} onChange={(e) => set(k, e.target.value)} />}
            </div>
          ))}
          <div className="row"><button className="btn grow" onClick={() => setStage('pick')}>Scan again</button><button className="btn btn-primary grow" onClick={confirm}><Check size={15} /> Confirm & save</button></div>
        </div>
      )}
    </Sheet>
  );
}

export { PLANS };
