import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar, CheckCircle2, Download, Edit3, Eye, FileText, HeartPulse, MessageCircle, Phone, Plus, RefreshCw, Search, ShieldCheck, Smartphone, Star, Syringe, Trash2, Wrench, Link2, TrendingUp,
} from 'lucide-react';
import { getDb, useDb } from '../lib/store';
import { useMe } from '../lib/session';
import { useVisible } from '../lib/hooks';
import { canEdit } from '../lib/access';
import { deleteCoverage, deleteDoc, deleteService, removeRow, upsert } from '../lib/actions';
import { QrCode } from '../components/ui/Qr';
import { assetValue, covLabel, covState, contactName, memberName, withRelation } from '../lib/compute';
import { addDays, cx, daysUntil, download, fileSize, fmtDate, inr, sum, today, toCsv, uid } from '../lib/utils';
import { PHONE_CONTACTS } from '../data/seed';
import { CONTACT_TYPES } from '../data/masters';
import { CovBadge, MenuBtn, TopBar } from '../components/common';
import { Badge, Empty, KV, Pills, Segmented } from '../components/ui/Misc';
import { ActionSheet, Confirm, Sheet, type SheetAction } from '../components/ui/Modal';
import { FormSheet } from '../components/ui/EntityForm';
import { HBars } from '../components/ui/Charts';
import { useToast } from '../components/ui/Toast';
import { useEd } from '../components/editors/Editors';
import { MonthCalendar } from '../components/MonthCalendar';
import type { Contact, Coverage, Doc, MedicalRecord, Vaccination } from '../lib/types';

type SheetState = null | { title: string; actions: SheetAction[] };
const typeLabel = (t: string) => t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// ---------------------------------------------------------------- Documents (PRD §9)
export function DocumentsPage() {
  const { db, me, docs } = useVisible();
  const { open } = useEd();
  const toast = useToast();
  const [by, setBy] = useState<'person' | 'asset' | 'category'>('person');
  const [q, setQ] = useState('');
  const [onlyExp, setOnlyExp] = useState(false);
  const [view, setView] = useState<Doc | null>(null);
  const [del, setDel] = useState<Doc | null>(null);
  const list = docs.filter((d) => (!q || `${d.title} ${d.number ?? ''} ${d.category} ${d.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())) && (!onlyExp || (d.expiryDate && daysUntil(d.expiryDate) <= 60)));
  const ownerLabel = (d: Doc) => (d.ownerType === 'member' ? memberName(db, d.ownerId) : db.assets.find((a) => a.id === d.ownerId)?.name ?? '—');
  const groups = useMemo(() => {
    const g = new Map<string, Doc[]>();
    for (const d of list) {
      const k = by === 'person' ? (d.ownerType === 'member' ? memberName(db, d.ownerId) : '') : by === 'asset' ? (d.ownerType === 'asset' ? ownerLabel(d) : '') : d.category;
      if (!k) continue;
      g.set(k, [...(g.get(k) ?? []), d]);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, by, db]);
  return (
    <div className="page">
      <TopBar title="Documents" back="/more" sub={`${docs.length} documents · ${fileSize(sum(docs, (d) => d.size))}`} actions={<button className="icon-btn" aria-label="Add document" onClick={() => open({ kind: 'document', ownerType: by === 'asset' ? 'asset' : 'member' })}><Plus size={20} /></button>} />
      <div className="pad-x stack" style={{ gap: 8 }}>
        <label className="search-box"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, number, tag…" aria-label="Search documents" /></label>
        <div className="row-wrap" style={{ gap: 6 }}>
          <Segmented label="Group by" value={by} onChange={setBy} options={[{ value: 'person', label: 'Person' }, { value: 'asset', label: 'Asset' }, { value: 'category', label: 'Category' }]} />
          <button className={cx('chip-toggle')} aria-pressed={onlyExp} onClick={() => setOnlyExp(!onlyExp)}>Expiring in 60 days</button>
        </div>
      </div>
      {groups.length === 0 && <Empty icon={<FileText size={20} />} title={q || onlyExp ? 'No matching documents' : 'No documents yet'}><button className="btn btn-sm btn-primary" onClick={() => open({ kind: 'document' })}><Plus size={14} /> Add document</button></Empty>}
      {groups.map(([k, ds]) => (
        <section key={k} className="msection">
          <div className="msection-head"><h3>{k} · {ds.length}</h3></div>
          <div className="list">
            {ds.map((d) => (
              <button key={d.id} className="mrow" onClick={() => setView(d)}>
                <span className="icon-tile sm"><FileText size={16} /></span>
                <span className="row-text"><b>{d.title}{d.starred && <Star size={11} style={{ display: 'inline', marginLeft: 4 }} fill="currentColor" />}</b><em>{by === 'category' ? ownerLabel(d) : d.category}{d.number ? ` · ${d.number}` : ''}{d.space === 'private' ? ' · 🔒' : ''}</em></span>
                {d.expiryDate && (daysUntil(d.expiryDate) < 0 ? <Badge tone="danger">Expired</Badge> : daysUntil(d.expiryDate) <= 60 ? <Badge tone="warning">Exp {fmtDate(d.expiryDate).slice(0, 6)}</Badge> : null)}
              </button>
            ))}
          </div>
        </section>
      ))}
      <button className="fab" aria-label="Add document" onClick={() => open({ kind: 'document' })}><Plus size={22} /></button>
      {view && (
        <Sheet open onClose={() => setView(null)} title={view.title} subtitle={`${view.category} · ${ownerLabel(view)}`}
          footer={<>
            <button className="btn btn-sm" onClick={() => { download(view.fileName, `Mynages demo file: ${view.title}`, 'text/plain'); toast({ type: 'success', title: 'Downloaded' }); }}><Download size={14} /> Download</button>
            <button className="btn btn-sm" onClick={() => toast({ type: 'info', title: 'Share link created', message: 'Expires in 7 days (simulated)' })}><Link2 size={14} /> Share</button>
            {canEdit(me, view) && <button className="btn btn-sm" onClick={() => { const d = view; setView(null); open({ kind: 'document', doc: d }); }}><Edit3 size={14} /> Edit</button>}
            {canEdit(me, view) && <button className="btn btn-sm btn-danger-outline" onClick={() => { setDel(view); setView(null); }}><Trash2 size={14} /></button>}
          </>}>
          <div className="doc-preview"><FileText size={36} /><b>{view.fileName}</b><span className="xs muted">{view.pages} page{view.pages > 1 ? 's' : ''} · {fileSize(view.size)}</span></div>
          <KV rows={[['Number', view.number], ['Issued by', view.issuer], ['Issued', view.issueDate && fmtDate(view.issueDate)], ['Expires', view.expiryDate && fmtDate(view.expiryDate)], ['Tags', view.tags.join(', ')], ['Notes', view.notes], ['Space', view.space === 'private' ? 'Private' : 'Family']]} />
          {view.ownerType === 'asset' && <Link to={`/assets/${view.ownerId}`} className="btn btn-sm" style={{ marginTop: 12 }}><Eye size={14} /> Open asset 360°</Link>}
          {view.ownerType === 'member' && <Link to={`/more/family/${view.ownerId}`} className="btn btn-sm" style={{ marginTop: 12 }}><Eye size={14} /> Open {memberName(db, view.ownerId).split(' ')[0]}’s profile</Link>}
        </Sheet>
      )}
      <Confirm open={!!del} title="Delete document?" message={`${del?.title} will be removed. Any expiry reminder stays until you cancel it.`} onConfirm={() => { if (del) { deleteDoc(del.id); toast({ type: 'success', title: 'Document deleted' }); } }} onClose={() => setDel(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- Insurance (PRD §6.2)
export function InsurancePage() {
  const { db, me, coverages, obligations } = useVisible();
  const { open } = useEd();
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState<'policies' | 'calendar'>('policies');
  const [f, setF] = useState<'all' | 'asset' | 'person' | 'attention'>('all');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [del, setDel] = useState<Coverage | null>(null);
  const pols = coverages.filter((c) => c.kind === 'insurance' && !c.supersededById);
  const shown = pols.filter((c) => f === 'all' || (f === 'asset' ? c.linkedType === 'asset' : f === 'person' ? c.linkedType === 'member' : covState(c) !== 'active')).sort((a, b) => a.endDate.localeCompare(b.endDate));
  const annual = sum(pols, (c) => (c.premium ?? 0) * (c.premiumFrequency === 'monthly' ? 12 : c.premiumFrequency === 'quarterly' ? 4 : c.premiumFrequency === 'half_yearly' ? 2 : c.premiumFrequency === 'single' ? 0 : 1));
  const health = sum(pols.filter((c) => c.policyType === 'health'), (c) => c.sumInsured ?? 0);
  const life = sum(pols.filter((c) => ['term', 'life', 'endowment'].includes(c.policyType ?? '')), (c) => c.sumInsured ?? 0);
  const premiums = obligations.filter((o) => o.status === 'open' && (o.type === 'insurance_premium' || o.coverageId));
  const covered = (c: Coverage) => (c.linkedType === 'asset' ? db.assets.find((a) => a.id === c.assetId)?.name : c.insured.map((i) => memberName(db, i.memberId).split(' ')[0]).join(', '));
  const acts = (c: Coverage): SheetAction[] => [
    { label: c.linkedType === 'asset' ? 'Open asset 360°' : 'Open insured person', icon: <Eye size={17} />, onClick: () => nav(c.linkedType === 'asset' ? `/assets/${c.assetId}#coverage` : `/more/family/${c.insured[0]?.memberId}`) },
    { label: 'Renew', icon: <RefreshCw size={17} />, onClick: () => open({ kind: 'renew', coverage: c }), hidden: !canEdit(me, c) },
    { label: 'Edit', icon: <Edit3 size={17} />, onClick: () => open({ kind: 'coverage', coverage: c }), hidden: !canEdit(me, c) },
    { label: 'Call agent', icon: <Phone size={17} />, onClick: () => { window.location.href = `tel:${db.contacts.find((x) => x.id === c.agentContactId)?.phone}`; }, hidden: !c.agentContactId },
    { label: 'Delete', icon: <Trash2 size={17} />, danger: true, onClick: () => setDel(c), hidden: !canEdit(me, c) },
  ];
  return (
    <div className="page">
      <TopBar title="Insurance" back="/more" actions={<button className="icon-btn" aria-label="Add policy" onClick={() => open({ kind: 'coverage', insurance: true })}><Plus size={20} /></button>} />
      <div className="mini-stats pad-x">
        <div><span className="xs muted">Annual premium</span><b>{inr(annual, { compact: true })}</b></div>
        <div><span className="xs muted">Health cover</span><b>{inr(health, { compact: true })}</b></div>
        <div><span className="xs muted">Life cover</span><b>{inr(life, { compact: true })}</b></div>
      </div>
      <Pills value={tab} onChange={setTab} items={[{ id: 'policies', label: 'Policies', count: pols.length }, { id: 'calendar', label: 'Premium calendar', count: premiums.length }]} />
      {tab === 'policies' ? (
        <>
          <div className="pad-x" style={{ margin: '4px 0 8px' }}><Segmented label="Filter" value={f} onChange={setF} options={[{ value: 'all', label: 'All' }, { value: 'asset', label: 'Assets' }, { value: 'person', label: 'People' }, { value: 'attention', label: 'Needs attention' }]} /></div>
          <div className="list">
            {shown.length === 0 && <Empty icon={<ShieldCheck size={20} />} title="No policies here" />}
            {shown.map((c) => (
              <button key={c.id} className={cx('mrow', covState(c) === 'lapsed' && 'danger')} onClick={() => setSheet({ title: `${c.provider} · ${c.number}`, actions: acts(c) })}>
                <span className="icon-tile sm"><ShieldCheck size={16} /></span>
                <span className="row-text"><b style={{ textTransform: 'capitalize' }}>{covLabel(c)} · {c.provider}</b><em>{covered(c)} · {c.sumInsured ? `cover ${inr(c.sumInsured, { compact: true })} · ` : ''}{c.premium ? `${inr(c.premium)}/${c.premiumFrequency === 'monthly' ? 'mo' : c.premiumFrequency === 'single' ? 'once' : 'yr'}` : ''}</em></span>
                <CovBadge c={c} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <MonthCalendar
          items={[
            ...premiums.map((o) => ({ id: o.id, date: o.dueDate, title: o.title, tone: (daysUntil(o.dueDate) < 0 ? 'danger' : daysUntil(o.dueDate) <= 15 ? 'warning' : 'info') as 'danger' | 'warning' | 'info' })),
            ...pols.filter((c) => c.maturityDate).map((c) => ({ id: `mat_${c.id}`, date: c.maturityDate!, title: `${c.provider} matures · ${inr(c.maturityValue)}`, tone: 'success' as const })),
          ]}
          render={(its, d) => (
            <>
              <p className="xs muted" style={{ margin: '8px 0' }}>{fmtDate(d)}</p>
              {its.length === 0 && <p className="small muted">No premium due this day. Dots show due dates.</p>}
              {its.map((x) => {
                const o = premiums.find((p) => p.id === x.id);
                return (
                  <div key={x.id} className="mrow">
                    <span className="row-text"><b>{x.title}</b><em>{o?.amount ? inr(o.amount) : ''}{o?.autoRenew ? ' · auto-debit' : ''}</em></span>
                    {o && canEdit(me, o) && <button className="btn btn-xs btn-primary" onClick={() => open({ kind: 'complete', obligation: o })}>Mark paid</button>}
                  </div>
                );
              })}
              <p className="small" style={{ marginTop: 12 }}><b>Next 12 months:</b> {inr(sum(premiums.filter((o) => daysUntil(o.dueDate) <= 365), (o) => o.amount ?? 0))} across {premiums.filter((o) => daysUntil(o.dueDate) <= 365).length} premiums</p>
            </>
          )} />
      )}
      {sheet && <ActionSheet open onClose={() => setSheet(null)} title={sheet.title} actions={sheet.actions} />}
      <Confirm open={!!del} title="Delete policy?" message="Its open renewal reminder is removed too. History of earlier terms is kept." onConfirm={() => { if (del) { deleteCoverage(del.id); toast({ type: 'success', title: 'Policy deleted' }); } }} onClose={() => setDel(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- Warranties & AMC
export function WarrantiesPage() {
  const { db, me, coverages } = useVisible();
  const { open } = useEd();
  const nav = useNavigate();
  const [f, setF] = useState<'active' | 'expiring' | 'expired' | 'all'>('all');
  const [sheet, setSheet] = useState<SheetState>(null);
  const ws = coverages.filter((c) => c.kind !== 'insurance' && !c.supersededById).filter((c) => f === 'all' || (f === 'expired' ? covState(c) === 'lapsed' : covState(c) === f)).sort((a, b) => a.endDate.localeCompare(b.endDate));
  return (
    <div className="page">
      <TopBar title="Warranties & AMC" back="/more" actions={<button className="icon-btn" aria-label="Add warranty" onClick={() => open({ kind: 'coverage' })}><Plus size={20} /></button>} />
      <div className="pad-x" style={{ marginBottom: 8 }}><Segmented label="Filter" value={f} onChange={setF} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'expiring', label: '≤ 30 days' }, { value: 'expired', label: 'Expired' }]} /></div>
      <div className="list">
        {ws.length === 0 && <Empty icon={<ShieldCheck size={20} />} title="Nothing here" />}
        {ws.map((c) => {
          const a = db.assets.find((x) => x.id === c.assetId);
          return (
            <button key={c.id} className="mrow" onClick={() => setSheet({ title: `${covLabel(c)} — ${a?.name}`, actions: [
              { label: 'Open asset 360°', icon: <Eye size={17} />, onClick: () => nav(`/assets/${c.assetId}#coverage`) },
              { label: c.kind === 'amc' ? 'Renew AMC' : 'Extend warranty', icon: <RefreshCw size={17} />, onClick: () => open({ kind: 'renew', coverage: c }), hidden: !canEdit(me, c) },
              { label: 'Edit', icon: <Edit3 size={17} />, onClick: () => open({ kind: 'coverage', coverage: c }), hidden: !canEdit(me, c) },
              { label: 'Call service contact', icon: <Phone size={17} />, onClick: () => { window.location.href = `tel:${db.contacts.find((x) => x.id === c.agentContactId)?.phone}`; }, hidden: !c.agentContactId },
            ] })}>
              <span className="icon-tile sm"><ShieldCheck size={16} /></span>
              <span className="row-text"><b>{a?.name ?? '—'}</b><em>{covLabel(c)} · {c.provider} · till {fmtDate(c.endDate)}{c.premium ? ` · ${inr(c.premium)}` : ''}</em></span>
              <CovBadge c={c} />
            </button>
          );
        })}
      </div>
      {sheet && <ActionSheet open onClose={() => setSheet(null)} title={sheet.title} actions={sheet.actions} />}
    </div>
  );
}

// ---------------------------------------------------------------- Maintenance (PRD §6.3)
export function MaintenancePage() {
  const { db, me, assets } = useVisible();
  const { open } = useEd();
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState<'schedules' | 'log' | 'manuals'>('schedules');
  const [sheet, setSheet] = useState<SheetState>(null);
  const ids = new Set(assets.map((a) => a.id));
  const scheds = db.schedules.filter((s) => ids.has(s.assetId) && s.active).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const logs = db.services.filter((s) => ids.has(s.assetId)).sort((a, b) => b.date.localeCompare(a.date));
  const manuals = db.docs.filter((d) => d.ownerType === 'asset' && ids.has(d.ownerId) && d.category === 'Service');
  const aName = (id: string) => db.assets.find((a) => a.id === id)?.name ?? '—';
  return (
    <div className="page">
      <TopBar title="Maintenance" back="/more" />
      <Pills value={tab} onChange={setTab} items={[{ id: 'schedules', label: 'Schedules', count: scheds.length }, { id: 'log', label: 'Service log', count: logs.length }, { id: 'manuals', label: 'Manuals & job cards', count: manuals.length }]} />
      {tab === 'schedules' && (
        <div className="list">
          {scheds.length === 0 && <Empty icon={<Wrench size={20} />} title="No schedules" ><p className="small">Add one from an asset’s 360° page → Service.</p></Empty>}
          {scheds.map((s) => {
            const d = daysUntil(s.nextDue);
            const a = db.assets.find((x) => x.id === s.assetId)!;
            return (
              <div key={s.id} className={cx('mrow', d < 0 && 'danger')}>
                <span className="icon-tile sm"><Wrench size={16} /></span>
                <Link to={`/assets/${s.assetId}#service`} className="row-text" style={{ color: 'inherit' }}><b>{s.title}</b><em>{aName(s.assetId)} · every {s.intervalDays >= 30 ? `${Math.round(s.intervalDays / 30)} mo` : `${s.intervalDays} days`}{s.contactId ? ` · ${contactName(db, s.contactId)}` : ''}</em></Link>
                <Badge tone={d < 0 ? 'danger' : d <= 14 ? 'warning' : 'info'}>{d < 0 ? `Overdue ${-d}d` : d === 0 ? 'Today' : `In ${d}d`}</Badge>
                {canEdit(me, a) && <button className="btn btn-xs" onClick={() => open({ kind: 'service', assetId: s.assetId, scheduleId: s.id })}>Log</button>}
              </div>
            );
          })}
        </div>
      )}
      {tab === 'log' && (
        <div className="list">
          <p className="xs muted pad-x">Total this year: <b>{inr(sum(logs.filter((l) => l.date >= `${new Date().getFullYear()}-01-01`), (l) => l.cost))}</b></p>
          {logs.length === 0 && <Empty icon={<Wrench size={20} />} title="No services logged" />}
          {logs.map((l) => {
            const a = db.assets.find((x) => x.id === l.assetId)!;
            return (
              <div key={l.id} className="mrow">
                <span className="date-chip"><b>{new Date(l.date).getDate()}</b><em>{new Date(l.date).toLocaleDateString('en-IN', { month: 'short' })}</em></span>
                <span className="row-text"><b>{l.workDone}</b><em>{aName(l.assetId)} · {l.provider}{l.reading ? ` · ${l.reading}` : ''}</em></span>
                <b className="small">{l.cost ? inr(l.cost) : 'Free'}</b>
                {canEdit(me, a) && <MenuBtn onClick={() => setSheet({ title: l.workDone, actions: [
                  { label: 'Open asset 360°', icon: <Eye size={17} />, onClick: () => nav(`/assets/${l.assetId}#service`) },
                  { label: 'Delete entry', icon: <Trash2 size={17} />, danger: true, onClick: () => { deleteService(l.id); toast({ type: 'success', title: 'Service entry deleted', message: 'Its expense was removed too' }); } },
                ] })} />}
              </div>
            );
          })}
        </div>
      )}
      {tab === 'manuals' && (
        <div className="list">
          {manuals.length === 0 && <Empty icon={<FileText size={20} />} title="No manuals yet" />}
          {manuals.map((d) => <Link key={d.id} to={`/assets/${d.ownerId}#documents`} className="mrow"><span className="icon-tile sm"><FileText size={16} /></span><span className="row-text"><b>{d.title}</b><em>{aName(d.ownerId)} · {d.pages} pages</em></span></Link>)}
          <button className="mrow" onClick={() => open({ kind: 'document', ownerType: 'asset', category: 'Service' })}><span className="icon-tile sm"><Plus size={16} /></span><span className="row-text"><b>Upload a manual or job card</b></span></button>
        </div>
      )}
      {sheet && <ActionSheet open onClose={() => setSheet(null)} title={sheet.title} actions={sheet.actions} />}
    </div>
  );
}

// ---------------------------------------------------------------- Contacts (VEN-01..07)
export function ContactsPage() {
  const db = useDb();
  const me = useMe()!;
  const { open } = useEd();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [sel, setSel] = useState<Contact | null>(null);
  const [imp, setImp] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const [del, setDel] = useState<Contact | null>(null);
  const list = db.contacts.filter((c) => (type === 'all' || c.type === type) && (!q || `${c.name} ${c.phone} ${c.notes ?? ''}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name));
  const mapped = (id: string) => db.assetContacts.filter((x) => x.contactId === id);
  const existing = new Set(db.contacts.map((c) => c.phone));
  const editable = canEdit(me);
  return (
    <div className="page">
      <TopBar title="Contacts" back="/more" sub={`${db.contacts.length} contacts`} actions={editable && <>
        <button className="icon-btn" aria-label="Import from phone" onClick={() => { setPick([]); setImp(true); }}><Smartphone size={19} /></button>
        <button className="icon-btn" aria-label="Add contact" onClick={() => open({ kind: 'contact' })}><Plus size={20} /></button>
      </>} />
      <div className="pad-x stack" style={{ gap: 8 }}>
        <label className="search-box"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number" aria-label="Search contacts" /></label>
      </div>
      <div className="cat-scroll" style={{ marginTop: 8 }}>
        {['all', ...CONTACT_TYPES].map((t) => <button key={t} className={cx('cat-chip', type === t && 'on')} onClick={() => setType(t)}>{t === 'all' ? 'All' : typeLabel(t)}</button>)}
      </div>
      <div className="list">
        {list.length === 0 && <Empty icon={<Phone size={20} />} title="No contacts" />}
        {list.map((c) => (
          <div key={c.id} className="mrow">
            <button className="row-text" style={{ textAlign: 'left', background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer' }} onClick={() => setSel(c)}><b>{c.name}{c.fromPhone && <Smartphone size={11} style={{ display: 'inline', marginLeft: 4 }} />}</b><em>{typeLabel(c.type)} · {c.phone}{mapped(c.id).length ? ` · ${mapped(c.id).length} asset${mapped(c.id).length > 1 ? 's' : ''}` : ''}</em></button>
            <a className="icon-btn sm" href={`tel:${c.phone}`} aria-label={`Call ${c.name}`}><Phone size={16} /></a>
            <a className="icon-btn sm" href={`https://wa.me/91${c.phone}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${c.name}`}><MessageCircle size={16} /></a>
          </div>
        ))}
      </div>
      {sel && (
        <Sheet open onClose={() => setSel(null)} title={sel.name} subtitle={typeLabel(sel.type)}
          footer={editable ? <><button className="btn btn-sm" onClick={() => { const c = sel; setSel(null); open({ kind: 'contact', contact: c }); }}><Edit3 size={14} /> Edit</button><button className="btn btn-sm btn-danger-outline" onClick={() => { setDel(sel); setSel(null); }}><Trash2 size={14} /> Delete</button></> : undefined}>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <a className="btn btn-primary btn-sm" href={`tel:${sel.phone}`}><Phone size={14} /> Call</a>
            <a className="btn btn-sm" href={`https://wa.me/91${sel.phone}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>
          </div>
          <KV rows={[['Phone', sel.phone], ['Email', sel.email], ['Notes', sel.notes], ['Source', sel.fromPhone ? 'Imported from phone' : 'Added in Mynages']]} />
          <b className="small" style={{ display: 'block', margin: '14px 0 6px' }}>Linked to</b>
          {mapped(sel.id).length === 0 ? <p className="xs muted">Not linked to any asset. Link from an asset’s 360° → Contacts.</p> : mapped(sel.id).map((m) => <Link key={m.id} to={`/assets/${m.assetId}#contacts`} className="mrow" onClick={() => setSel(null)}><span className="row-text"><b>{db.assets.find((a) => a.id === m.assetId)?.name}</b><em>{m.purpose}</em></span></Link>)}
        </Sheet>
      )}
      <Sheet open={imp} onClose={() => setImp(false)} title="Import from phone" subtitle="Pick the people you call for home, vehicle, health…" full
        footer={<button className="btn btn-primary" disabled={!pick.length} onClick={() => {
          pick.forEach((ph) => { const p = PHONE_CONTACTS.find((x) => x.phone === ph)!; upsert('contacts', { id: uid('ct'), name: p.name, phone: p.phone, type: /dr\.|doctor/i.test(p.name) ? 'doctor' : /agent|lic/i.test(p.name) ? 'insurance_agent' : /bank|rm/i.test(p.name) ? 'other' : /neha|rahul/i.test(p.name) ? 'family_friend' : 'service_provider', fromPhone: true }); });
          toast({ type: 'success', title: `${pick.length} contact${pick.length > 1 ? 's' : ''} imported` }); setImp(false);
        }}>Import {pick.length || ''}</button>}>
        <p className="xs muted" style={{ marginBottom: 10 }}>Simulated address book. Only the contacts you select are saved; nothing else leaves your phone.</p>
        <div className="action-list">
          {PHONE_CONTACTS.map((p) => {
            const has = existing.has(p.phone);
            return (
              <label key={p.phone} className={cx('action-item', has && 'disabled')}>
                <input type="checkbox" disabled={has} checked={has || pick.includes(p.phone)} onChange={(e) => setPick(e.target.checked ? [...pick, p.phone] : pick.filter((x) => x !== p.phone))} />
                <span className="grow">{p.name}<em>{p.phone}{has ? ' · already in Mynages' : ''}</em></span>
              </label>
            );
          })}
        </div>
      </Sheet>
      <Confirm open={!!del} title="Delete contact?" message="It is unlinked from every asset." onConfirm={() => { if (del) { removeContact(del.id); toast({ type: 'success', title: 'Contact deleted' }); } }} onClose={() => setDel(null)} />
    </div>
  );
}
function removeContact(id: string) {
  removeRow('contacts', id);
  getDb().assetContacts.filter((x) => x.contactId === id).forEach((x) => removeRow('assetContacts', x.id));
}

// ---------------------------------------------------------------- Savings & investments (P1, Family Plus)
export function SavingsPage() {
  const { db, assets } = useVisible();
  const { open } = useEd();
  const nav = useNavigate();
  const sav = assets.filter((a) => a.categoryId === 'c_sav' && !a.archived);
  const rows = sav.map((a) => ({ a, invested: Number(a.fields.invested_amount ?? a.purchaseCost ?? 0), current: assetValue(db, a).value, maturity: a.fields.maturity_date as string | undefined }));
  const inv = sum(rows, (r) => r.invested);
  const cur = sum(rows, (r) => r.current);
  const pols = db.coverages.filter((c) => c.maturityDate && !c.supersededById);
  const maturities = [
    ...rows.filter((r) => r.maturity).map((r) => ({ id: r.a.id, title: r.a.name, date: r.maturity!, value: Number(r.a.fields.maturity_value ?? 0) || undefined, to: `/assets/${r.a.id}` })),
    ...pols.map((c) => ({ id: c.id, title: `${c.provider} ${c.policyType}`, date: c.maturityDate!, value: c.maturityValue, to: '/more/insurance' })),
  ].filter((m) => daysUntil(m.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const vals = db.valuations.filter((v) => sav.some((a) => a.id === v.assetId)).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="page">
      <TopBar title="Savings & investments" back="/more" actions={<button className="icon-btn" aria-label="Add investment" onClick={() => open({ kind: 'asset' })}><Plus size={20} /></button>} />
      <div className="mini-stats pad-x">
        <div><span className="xs muted">Invested</span><b>{inr(inv, { compact: true })}</b></div>
        <div><span className="xs muted">Current value</span><b>{inr(cur, { compact: true })}</b></div>
        <div><span className="xs muted">Gain</span><b className={cur >= inv ? 'text-success' : 'text-danger'}>{inv ? `${(((cur - inv) / inv) * 100).toFixed(1)}%` : '—'}</b></div>
      </div>
      <p className="xs muted pad-x" style={{ marginTop: 6 }}>Values are what you enter — Mynages doesn’t link to banks or brokers. Private items are only in their owner’s totals.</p>
      <section className="msection"><div className="msection-head"><h3>By instrument</h3></div>
        <div className="pad-x"><HBars data={rows.map((r) => ({ label: r.a.name, value: r.current, key: r.a.id, sub: `${withRelation(db, r.a.ownerMemberId)}${r.a.space === 'private' ? ' · 🔒' : ''}` }))} format={(n) => inr(n, { compact: true })} onSelect={(k) => nav(`/assets/${k}`)} /></div>
      </section>
      <section className="msection"><div className="msection-head"><h3><Calendar size={15} style={{ display: 'inline', verticalAlign: -2 }} /> Upcoming maturities</h3></div>
        <div className="list">{maturities.length === 0 ? <p className="small muted pad-x">None.</p> : maturities.map((m) => <Link key={m.id} to={m.to} className="mrow"><span className="row-text"><b>{m.title}</b><em>{fmtDate(m.date)}{m.value ? ` · ${inr(m.value)}` : ''}</em></span><Badge tone={daysUntil(m.date) <= 60 ? 'warning' : 'info'}>{daysUntil(m.date) <= 60 ? `${daysUntil(m.date)} days` : `${Math.round(daysUntil(m.date) / 30)} mo`}</Badge></Link>)}</div>
      </section>
      <section className="msection"><div className="msection-head"><h3><TrendingUp size={15} style={{ display: 'inline', verticalAlign: -2 }} /> Value history</h3></div>
        <div className="list">
          {vals.length === 0 && <p className="small muted pad-x">No valuation updates yet.</p>}
          {vals.slice(0, 8).map((v) => <div key={v.id} className="mrow"><span className="row-text"><b>{db.assets.find((a) => a.id === v.assetId)?.name}</b><em>{fmtDate(v.date)} · by {memberName(db, v.by).split(' ')[0]}{v.note ? ` · ${v.note}` : ''}</em></span><b className="small">{inr(v.value, { compact: true })}</b></div>)}
          <div className="row-wrap pad-x" style={{ gap: 6, marginTop: 6 }}>{sav.map((a) => <button key={a.id} className="btn btn-xs" onClick={() => open({ kind: 'valuation', assetId: a.id })}>Update {a.name.split(' ')[0]}</button>)}</div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Health records (P1)
export function HealthPage() {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const who = params.get('member') ?? 'all';
  const [tab, setTab] = useState<'records' | 'vax'>('records');
  const [rec, setRec] = useState<MedicalRecord | 'new' | null>(null);
  const [vx, setVx] = useState<Vaccination | 'new' | null>(null);
  const people = db.members.filter((m) => m.state !== 'removed' && m.state !== 'declined');
  const recs = db.medical.filter((r) => who === 'all' || r.memberId === who).sort((a, b) => b.date.localeCompare(a.date));
  const vax = db.vaccinations.filter((v) => who === 'all' || v.memberId === who).sort((a, b) => (a.status === b.status ? (a.dueDate ?? a.givenDate ?? '').localeCompare(b.dueDate ?? b.givenDate ?? '') : a.status === 'due' ? -1 : 1));
  const editable = canEdit(me);
  return (
    <div className="page">
      <TopBar title="Health records" back="/more" actions={editable && <button className="icon-btn" aria-label="Add" onClick={() => (tab === 'records' ? setRec('new') : setVx('new'))}><Plus size={20} /></button>} />
      <div className="cat-scroll">
        <button className={cx('cat-chip', who === 'all' && 'on')} onClick={() => setParams({})}>Everyone</button>
        {people.map((m) => <button key={m.id} className={cx('cat-chip', who === m.id && 'on')} onClick={() => setParams({ member: m.id })}>{m.name.split(' ')[0]}</button>)}
      </div>
      <Pills value={tab} onChange={setTab} items={[{ id: 'records', label: 'Records', count: recs.length }, { id: 'vax', label: 'Vaccinations & check-ups', count: vax.filter((v) => v.status === 'due').length }]} />
      {tab === 'records' ? (
        <div className="list">
          {recs.length === 0 && <Empty icon={<HeartPulse size={20} />} title="No records" />}
          {recs.map((r) => (
            <button key={r.id} className="mrow" onClick={() => editable && setRec(r)}>
              <span className="date-chip"><b>{new Date(r.date).getDate()}</b><em>{new Date(r.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</em></span>
              <span className="row-text"><b>{r.title}</b><em>{memberName(db, r.memberId).split(' ')[0]} · {typeLabel(r.type)}{r.hospital ? ` · ${r.hospital}` : ''}{r.doctorContactId ? ` · ${contactName(db, r.doctorContactId)}` : ''}</em></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="list">
          {vax.length === 0 && <Empty icon={<Syringe size={20} />} title="Nothing scheduled" />}
          {vax.map((v) => {
            const d = v.dueDate ? daysUntil(v.dueDate) : 0;
            return (
              <div key={v.id} className={cx('mrow', v.status === 'due' && d < 0 && 'danger')}>
                <span className="icon-tile sm">{v.itemType === 'vaccination' ? <Syringe size={16} /> : <HeartPulse size={16} />}</span>
                <button className="row-text" style={{ textAlign: 'left', background: 'none', border: 0, padding: 0, color: 'inherit', cursor: editable ? 'pointer' : 'default' }} onClick={() => editable && setVx(v)}><b>{v.name}</b><em>{memberName(db, v.memberId).split(' ')[0]} · {v.status === 'done' ? `given ${fmtDate(v.givenDate)}` : `due ${fmtDate(v.dueDate)}`}{v.provider ? ` · ${v.provider}` : ''}</em></button>
                {v.status === 'due' ? (editable ? <button className="btn btn-xs btn-primary" onClick={() => { upsert('vaccinations', { ...v, status: 'done', givenDate: today() }); toast({ type: 'success', title: 'Marked done', message: v.name }); }}><CheckCircle2 size={13} /> Done</button> : <Badge tone={d < 0 ? 'danger' : 'info'}>{d < 0 ? 'Overdue' : 'Due'}</Badge>) : <Badge tone={v.status === 'done' ? 'success' : 'neutral'}>{v.status}</Badge>}
              </div>
            );
          })}
        </div>
      )}
      <p className="xs muted pad" style={{ paddingTop: 4 }}>Health records are stored for reference only — Mynages gives no medical advice.</p>
      {rec && (
        <FormSheet<Record<string, unknown>> open onClose={() => setRec(null)} title={rec === 'new' ? 'Add health record' : 'Edit record'}
          fields={[
            { key: 'memberId', label: 'For', type: 'select', required: true, options: people.map((m) => ({ value: m.id, label: m.name })) },
            { key: 'type', label: 'Type', type: 'select', required: true, options: ['prescription', 'lab_report', 'discharge_summary', 'scan', 'other'].map((x) => ({ value: x, label: typeLabel(x) })) },
            { key: 'title', label: 'Title', type: 'text', required: true, full: true, placeholder: 'e.g. HbA1c report' },
            { key: 'date', label: 'Date', type: 'date', required: true, validate: (x) => (String(x) > today() ? 'Can’t be in the future' : undefined) },
            { key: 'hospital', label: 'Hospital / lab', type: 'text' },
            { key: 'doctorContactId', label: 'Doctor', type: 'select', options: db.contacts.filter((c) => c.type === 'doctor').map((c) => ({ value: c.id, label: c.name })) },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          initial={rec === 'new' ? { memberId: who !== 'all' ? who : undefined, type: 'prescription', date: today() } : { ...rec }}
          after={() => rec !== 'new' ? <button type="button" className="btn btn-danger-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { removeRow('medical', rec.id); toast({ type: 'success', title: 'Record deleted' }); setRec(null); }}><Trash2 size={14} /> Delete</button> : null}
          onSubmit={(v) => { upsert('medical', { ...(rec === 'new' ? { createdBy: me.id } : rec), id: rec === 'new' ? uid('mr') : rec.id, memberId: String(v.memberId), type: v.type as MedicalRecord['type'], title: String(v.title), date: String(v.date), hospital: (v.hospital as string) || undefined, doctorContactId: (v.doctorContactId as string) || undefined, notes: (v.notes as string) || undefined } as MedicalRecord); toast({ type: 'success', title: rec === 'new' ? 'Record added' : 'Record updated' }); setRec(null); }} />
      )}
      {vx && (
        <FormSheet<Record<string, unknown>> open onClose={() => setVx(null)} title={vx === 'new' ? 'Add vaccination / check-up' : vx.name}
          fields={[
            { key: 'memberId', label: 'For', type: 'select', required: true, options: people.map((m) => ({ value: m.id, label: m.name })) },
            { key: 'itemType', label: 'Kind', type: 'select', required: true, options: [{ value: 'vaccination', label: 'Vaccination' }, { value: 'checkup', label: 'Check-up' }] },
            { key: 'name', label: 'Name', type: 'text', required: true, full: true, placeholder: 'e.g. MMR booster, Annual eye check-up' },
            { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'due', label: 'Due' }, { value: 'done', label: 'Done' }, { value: 'skipped', label: 'Skipped' }] },
            { key: 'dueDate', label: 'Due date', type: 'date', required: (v) => v.status === 'due', showIf: (v) => v.status === 'due' },
            { key: 'givenDate', label: 'Done on', type: 'date', required: (v) => v.status === 'done', showIf: (v) => v.status === 'done' },
            { key: 'provider', label: 'Clinic / doctor', type: 'text' },
          ]}
          initial={vx === 'new' ? { memberId: who !== 'all' ? who : undefined, itemType: 'vaccination', status: 'due', dueDate: addDays(today(), 30) } : { ...vx }}
          after={() => vx !== 'new' ? <button type="button" className="btn btn-danger-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { removeRow('vaccinations', vx.id); toast({ type: 'success', title: 'Deleted' }); setVx(null); }}><Trash2 size={14} /> Delete</button> : null}
          onSubmit={(v) => { upsert('vaccinations', { id: vx === 'new' ? uid('vx') : vx.id, memberId: String(v.memberId), itemType: v.itemType as Vaccination['itemType'], name: String(v.name), status: v.status as Vaccination['status'], dueDate: (v.dueDate as string) || undefined, givenDate: (v.givenDate as string) || undefined, provider: (v.provider as string) || undefined }); toast({ type: 'success', title: 'Saved' }); setVx(null); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- QR labels
export function QrPage() {
  const { db, assets } = useVisible();
  const toast = useToast();
  const [params] = useSearchParams();
  const [sel, setSel] = useState<string[]>(() => (params.get('ids') ? params.get('ids')!.split(',') : []));
  const [preview, setPreview] = useState(false);
  const live = assets.filter((a) => !a.archived);
  const chosen = live.filter((a) => sel.includes(a.id));
  return (
    <div className="page">
      <TopBar title="QR labels" back="/more" sub="Stick on an asset · scan to open its 360°" />
      <div className="row between pad-x" style={{ marginBottom: 6 }}>
        <span className="small">{sel.length} selected</span>
        <div className="row" style={{ gap: 6 }}><button className="btn btn-xs" onClick={() => setSel(sel.length === live.length ? [] : live.map((a) => a.id))}>{sel.length === live.length ? 'Clear' : 'Select all'}</button><button className="btn btn-xs btn-primary" disabled={!sel.length} onClick={() => setPreview(true)}>Preview & print</button></div>
      </div>
      <div className="list">
        {live.map((a) => (
          <label key={a.id} className="mrow">
            <input type="checkbox" className="check-lg" checked={sel.includes(a.id)} onChange={(e) => setSel(e.target.checked ? [...sel, a.id] : sel.filter((x) => x !== a.id))} />
            <span className="row-text"><b>{a.name}</b><em>{a.code} · {db.subcategories.find((s) => s.id === a.subcategoryId)?.name}</em></span>
          </label>
        ))}
      </div>
      <Sheet open={preview} onClose={() => setPreview(false)} title={`${chosen.length} label${chosen.length > 1 ? 's' : ''}`} full
        footer={<><button className="btn" onClick={() => { download('mynages-qr-labels.csv', toCsv(chosen.map((a) => ({ code: a.code, name: a.name, url: `${location.origin}${import.meta.env.BASE_URL}assets/${a.id}` })))); toast({ type: 'success', title: 'Label sheet exported' }); }}><Download size={14} /> CSV</button><button className="btn btn-primary" onClick={() => { toast({ type: 'info', title: 'Sent to printer (simulated)', message: 'A4 · 2 × 5 labels' }); setPreview(false); }}>Print</button></>}>
        <div className="qr-sheet">
          {chosen.map((a) => <QrLabel key={a.id} id={a.id} name={a.name} code={a.code} family={db.settings.familyName} />)}
        </div>
        <p className="xs muted" style={{ marginTop: 10 }}>Scanning shows the asset only to signed-in family members. Others see a “found this item?” page — planned (lost & found).</p>
      </Sheet>
    </div>
  );
}
function QrLabel({ id, name, code, family }: { id: string; name: string; code: string; family: string }) {
  return <div className="qr-label"><QrCode value={`${location.origin}${import.meta.env.BASE_URL}assets/${id}`} size={84} /><span className="row-text"><b>{name}</b><em>{code}</em><em>{family}</em></span></div>;
}

