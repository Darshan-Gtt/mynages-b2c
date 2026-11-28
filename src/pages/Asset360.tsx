import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, Archive, ArrowLeft, Bell, CalendarCheck, ChevronDown, ClipboardList, Edit3, FileText, History, IndianRupee, Info, Layers, Lock, MessageCircle,
  Moon, Phone, Plus, Printer, QrCode, RefreshCw, Share2, ShieldCheck, ToggleRight, Trash2, TrendingUp, Users, Wrench, X, MoreVertical, UserCheck,
} from 'lucide-react';
import { useDb } from '../lib/store';
import { useMe } from '../lib/session';
import { canEdit, canMoveSpace, isOwner, visible } from '../lib/access';
import { archiveAsset, cancelObligation, deleteCoverage, deleteDoc, deleteService, moveSpace, removeRow, setTaskStatus, snooze } from '../lib/actions';
import { alertsFor, assetValue, covLabel, covState, lifecycleCost, nextDue, nextReminder, obState, withRelation } from '../lib/compute';
import { addDays, cx, daysUntil, fileSize, fmtDate, fmtDateTime, inr, timeAgo, today } from '../lib/utils';
import { CovBadge, ObBadge, TaskBadge } from '../components/common';
import { AssetIcon } from '../components/Icons';
import { PhotoStrip } from '../components/ui/ImagePicker';
import { Avatar, Badge, Empty, KV } from '../components/ui/Misc';
import { ActionSheet, Confirm, Sheet, type SheetAction } from '../components/ui/Modal';
import { QrCode as Qr } from '../components/ui/Qr';
import { TrendChart } from '../components/ui/Charts';
import { useToast } from '../components/ui/Toast';
import { useEd } from '../components/editors/Editors';
import type { Asset, Doc } from '../lib/types';

type Sid = 'details' | 'coverage' | 'due' | 'tasks' | 'documents' | 'service' | 'contacts' | 'cost' | 'related' | 'sharing' | 'timeline';
const CHIPS: { id: Sid; label: string }[] = [
  { id: 'details', label: 'Details' }, { id: 'coverage', label: 'Coverage' }, { id: 'due', label: 'Due' }, { id: 'tasks', label: 'Tasks' }, { id: 'documents', label: 'Documents' },
  { id: 'service', label: 'Service' }, { id: 'contacts', label: 'Contacts' }, { id: 'cost', label: 'Cost & value' }, { id: 'related', label: 'Related' }, { id: 'sharing', label: 'Sharing' }, { id: 'timeline', label: 'Timeline' },
];
const KEY = 'mynages.b2c.360.collapsed';

export function Asset360Page() {
  const { id } = useParams();
  const db = useDb();
  const me = useMe()!;
  const a = db.assets.find((x) => x.id === id);
  if (!a || !visible(a, me)) {
    return <div className="page"><div className="topbar"><Link to="/assets" className="icon-btn" aria-label="Back"><ArrowLeft size={20} /></Link><h1>Asset</h1></div>
      <Empty icon={<Lock size={20} />} title={a ? 'This is in someone’s private space' : 'Asset not found'}><Link className="btn btn-sm" to="/assets">Back to assets</Link></Empty></div>;
  }
  return <Asset360 a={a} />;
}

function Asset360({ a }: { a: Asset }) {
  const db = useDb();
  const me = useMe()!;
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { open, gate } = useEd();
  const [compact, setCompact] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } });
  const [sheet, setSheet] = useState<null | { title: string; actions: SheetAction[] }>(null);
  const [confirm, setConfirm] = useState<null | { title: string; message: string; run: () => void; label?: string }>(null);
  const [qr, setQr] = useState(false);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [allTimeline, setAllTimeline] = useState(false);
  const editable = canEdit(me, a) && !a.archived;
  const w = (fn: () => void) => () => { if (!editable) { toast({ type: 'info', title: me.role === 'view_only' && a.space === 'family' ? 'View-only members can’t change family items' : 'Read-only' }); return; } if (gate('write')) fn(); };

  useEffect(() => {
    const el = document.getElementById('screen');
    if (!el) return;
    const on = () => setCompact(el.scrollTop > 150);
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);
  const jump = (sid: string) => {
    setCollapsed((c) => { const n = { ...c, [sid]: false }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ } return n; });
    setTimeout(() => document.getElementById(`s-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };
  useEffect(() => { if (loc.hash) jump(loc.hash.slice(1)); else document.getElementById('screen')?.scrollTo(0, 0); }, [a.id, loc.hash]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (sid: string) => setCollapsed((c) => { const n = { ...c, [sid]: !c[sid] }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ } return n; });

  const cat = db.categories.find((c) => c.id === a.categoryId);
  const sub = db.subcategories.find((s) => s.id === a.subcategoryId);
  const status = db.statuses.find((s) => s.id === a.statusId)!;
  const covs = db.coverages.filter((c) => c.assetId === a.id && !c.supersededById);
  const hist = db.coverages.filter((c) => c.assetId === a.id && c.supersededById);
  const obs = db.obligations.filter((o) => o.assetId === a.id && o.status === 'open').sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  const tasks = db.tasks.filter((t) => t.assetId === a.id && visible(t, me));
  const openTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  const doneTasks = tasks.filter((t) => t.status === 'done' || t.status === 'cancelled');
  const docs = db.docs.filter((d) => d.ownerType === 'asset' && d.ownerId === a.id);
  const services = db.services.filter((s) => s.assetId === a.id).sort((x, y) => y.date.localeCompare(x.date));
  const schedules = db.schedules.filter((s) => s.assetId === a.id && s.active);
  const contacts = db.assetContacts.filter((m) => m.assetId === a.id);
  const expenses = db.expenses.filter((e) => e.assetId === a.id).sort((x, y) => y.date.localeCompare(x.date));
  const events = db.events.filter((e) => e.assetId === a.id).sort((x, y) => y.at.localeCompare(x.at));
  const children = db.assets.filter((x) => x.parentId === a.id && visible(x, me));
  const parent = db.assets.find((x) => x.id === a.parentId);
  const nominees = db.nominees.filter((n) => n.items.some((i) => i.type === 'asset' && i.id === a.id));
  const val = assetValue(db, a);
  const lcc = lifecycleCost(db, a);
  const alerts = alertsFor(db, a);
  const nd = nextDue(db, a.id);
  const ins = covs.find((c) => c.kind === 'insurance');
  const war = covs.find((c) => c.kind !== 'insurance');
  const creator = db.members.find((m) => m.id === a.createdBy);
  const trend = useMemo(() => {
    const vs = db.valuations.filter((v) => v.assetId === a.id).sort((x, y) => x.date.localeCompare(y.date));
    const pts = [...(a.purchaseCost && a.purchaseDate ? [{ date: a.purchaseDate, value: a.purchaseCost }] : []), ...vs.map((v) => ({ date: v.date, value: v.value }))];
    if (pts.length < 2 && val.estimated) pts.push({ date: today(), value: val.value });
    return pts.map((p) => ({ label: new Date(p.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), value: p.value }));
  }, [db.valuations, a, val]);

  const quick: { label: string; icon: ReactNode; run: () => void }[] = [
    { label: 'Document', icon: <FileText size={18} />, run: w(() => open({ kind: 'document', ownerType: 'asset', ownerId: a.id })) },
    { label: 'Reminder', icon: <Bell size={18} />, run: w(() => open({ kind: 'obligation', assetId: a.id })) },
    { label: 'Task', icon: <ClipboardList size={18} />, run: w(() => open({ kind: 'task', assetId: a.id })) },
    { label: 'Service', icon: <Wrench size={18} />, run: w(() => open({ kind: 'service', assetId: a.id })) },
    { label: 'Expense', icon: <IndianRupee size={18} />, run: w(() => open({ kind: 'expense', assetId: a.id })) },
    { label: 'Coverage', icon: <ShieldCheck size={18} />, run: w(() => open({ kind: 'coverage', assetId: a.id })) },
    { label: 'Contact', icon: <Phone size={18} />, run: w(() => open({ kind: 'mapContact', assetId: a.id })) },
    { label: 'Status', icon: <ToggleRight size={18} />, run: w(() => open({ kind: 'status', assetId: a.id })) },
    { label: 'Share', icon: <Share2 size={18} />, run: () => jump('sharing') },
    { label: 'Print QR', icon: <QrCode size={18} />, run: () => setQr(true) },
    { label: 'PDF', icon: <Printer size={18} />, run: () => nav(`/assets/${a.id}/pdf`) },
  ];

  const AddBtn = ({ on, label = 'Add' }: { on: () => void; label?: string }) => editable ? <button className="btn btn-xs" onClick={w(on)}><Plus size={13} /> {label}</button> : null;

  return (
    <div className="page a360">
      <div className={cx('a-bar', compact && 'show')}>
        <button className="icon-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/assets'))}><ArrowLeft size={20} /></button>
        <span className="grow ellipsis"><b>{a.name}</b></span>
        <Badge tone={status.tone}>{status.name.split(' ')[0]}</Badge>
        <button className="icon-btn" aria-label="Asset menu" onClick={() => setSheet({ title: a.name, actions: menuActions() })}><MoreVertical size={19} /></button>
      </div>

      <header className="a-hero" style={{ background: `linear-gradient(160deg, ${a.color}, color-mix(in srgb, ${a.color} 45%, #0F2D3D))` }}>
        <div className="row between">
          <button className="icon-btn light" aria-label="Back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/assets'))}><ArrowLeft size={20} /></button>
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn light" aria-label="QR code" onClick={() => setQr(true)}><QrCode size={19} /></button>
            <button className="icon-btn light" aria-label="Asset menu" onClick={() => setSheet({ title: a.name, actions: menuActions() })}><MoreVertical size={19} /></button>
          </div>
        </div>
        <div className="a-hero-id">
          <span className="a-hero-icon">{a.photos?.length ? <img src={a.photos[0]} alt="" className="a-hero-photo" /> : <AssetIcon categoryIcon={cat?.icon} subcategoryId={a.subcategoryId} size={30} />}</span>
          <div style={{ minWidth: 0 }}>
            <h1>{a.name}</h1>
            <p>{cat?.name} › {sub?.name} · {a.code}</p>
          </div>
        </div>
        <div className="row-wrap" style={{ gap: 6 }}>
          <span className="hchip">{status.name}</span>
          <span className="hchip">{withRelation(db, a.ownerMemberId, me)}</span>
          {a.propertyId && <span className="hchip">{db.properties.find((p) => p.id === a.propertyId)?.name}</span>}
          <span className="hchip">{a.space === 'private' ? <><Lock size={11} /> Private</> : <><Users size={11} /> Family</>}</span>
        </div>
      </header>
      {!!a.photos?.length && <PhotoStrip photos={a.photos} />}

      <div className="a-facts">
        <div><em>Current value</em><b>{inr(val.value, { compact: true })}</b><small>{val.estimated ? 'estimated' : val.asOf ? `as of ${fmtDate(val.asOf).slice(0, 6)}` : ''}</small></div>
        <div><em>Insurance</em>{ins ? <b className={covState(ins) === 'lapsed' ? 'text-danger' : covState(ins) === 'expiring' ? 'text-warning' : 'text-success'}>{covState(ins) === 'lapsed' ? 'Lapsed' : `${daysUntil(ins.endDate)}d left`}</b> : <b className="muted">None</b>}<small>{ins?.provider ?? ''}</small></div>
        <div><em>Warranty / AMC</em>{war ? <b className={covState(war) === 'lapsed' ? 'text-danger' : covState(war) === 'expiring' ? 'text-warning' : 'text-success'}>{covState(war) === 'lapsed' ? 'Expired' : `${daysUntil(war.endDate)}d left`}</b> : <b className="muted">None</b>}<small>{war ? (war.kind === 'amc' ? 'AMC' : 'Warranty') : ''}</small></div>
        <div><em>Next due</em><b>{nd ? fmtDate(nd.date).slice(0, 6) : '—'}</b><small className="ellipsis">{nd ? `${nd.amount ? inr(nd.amount, { compact: true }) + ' · ' : ''}${nd.label}` : 'Nothing due'}</small></div>
        <div><em>Purchase</em><b>{a.purchaseCost ? inr(a.purchaseCost, { compact: true }) : '—'}</b><small>{a.purchaseDate ? fmtDate(a.purchaseDate) : ''}</small></div>
        <div><em>Lifecycle cost</em><b>{inr(lcc, { compact: true })}</b><small>purchase + expenses</small></div>
      </div>
      <p className="xs muted pad-x" style={{ marginTop: 4 }}>{openTasks.length} open tasks · {docs.length} documents · {obs.length} reminders · Added by {creator?.id === me.id ? 'you' : creator?.name.split(' ')[0]} on {fmtDate(a.createdAt)}{a.updatedAt && ` · updated ${timeAgo(a.updatedAt)} by ${db.members.find((m) => m.id === a.updatedBy)?.name.split(' ')[0]}`}</p>

      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.map((al, i) => <button key={i} className={cx('alert-chip', al.tone)} onClick={() => jump(al.section)}><AlertTriangle size={13} /> {al.text}</button>)}
        </div>
      )}

      <div className="qa-bar" role="toolbar" aria-label="Quick actions">
        {quick.map((q) => <button key={q.label} className="qa" onClick={q.run}><span>{q.icon}</span>{q.label}</button>)}
      </div>

      <nav className="sec-chips" aria-label="Sections">
        {CHIPS.filter((c) => c.id !== 'related' || children.length || parent).map((c) => <button key={c.id} onClick={() => jump(c.id)}>{c.label}</button>)}
      </nav>

      {a.archived && <div className="banner warning" style={{ margin: '0 12px 10px', borderRadius: 10 }}>Archived — hidden from lists. {canEdit(me, a) && <button className="link-btn" onClick={() => { archiveAsset(a.id, false); toast({ type: 'success', title: 'Restored' }); }}>Restore</button>}</div>}

      <SecBox c={collapsed} t={toggle} id="details" title="Key details" icon={<Info size={15} />} action={editable && <button className="btn btn-xs" onClick={() => open({ kind: 'asset', asset: a })}><Edit3 size={12} /> Edit</button>}>
        <KV rows={[
          ...(sub?.fields ?? []).filter((f) => a.fields[f.key] !== undefined && a.fields[f.key] !== '').map((f) => [f.label, f.type === 'boolean' ? (a.fields[f.key] ? 'Yes' : 'No') : f.type === 'currency' ? inr(Number(a.fields[f.key])) : f.type === 'date' ? fmtDate(String(a.fields[f.key])) : `${a.fields[f.key]}${f.unit ? ` ${f.unit}` : ''}`] as [ReactNode, ReactNode]),
          ['Serial no.', a.serialNo], ['Invoice no.', a.invoiceNo], ['Kept at', db.properties.find((p) => p.id === a.propertyId)?.name], ['Tags', a.tags.join(', ')], ['Notes', a.notes],
        ]} />
      </SecBox>

      <SecBox c={collapsed} t={toggle} id="coverage" title="Coverage" icon={<ShieldCheck size={15} />} count={covs.length} action={<AddBtn on={() => open({ kind: 'coverage', assetId: a.id })} />}>
        {covs.length === 0 ? <Empty icon={<ShieldCheck size={18} />} title="No insurance or warranty yet">{editable && <button className="btn btn-sm btn-primary" onClick={w(() => open({ kind: 'coverage', assetId: a.id }))}>Add coverage</button>}</Empty> : covs.map((c) => (
          <div key={c.id} className="card-row">
            <div className="grow" style={{ minWidth: 0 }}>
              <b className="small" style={{ textTransform: 'capitalize' }}>{covLabel(c)}</b>
              <span className="xs muted" style={{ display: 'block' }}>{c.provider} · {c.number}</span>
              <span className="xs muted">{fmtDate(c.startDate)} – {fmtDate(c.endDate)}{c.premium ? ` · ${inr(c.premium)}` : ''}{c.sumInsured ? ` · cover ${inr(c.sumInsured, { compact: true })}` : ''}</span>
            </div>
            <CovBadge c={c} />
            {editable && <button className="icon-btn sm" aria-label="Coverage actions" onClick={() => setSheet({ title: covLabel(c), actions: [
              { label: 'Renew', icon: <RefreshCw size={17} />, onClick: () => open({ kind: 'renew', coverage: c }) },
              { label: 'Edit', icon: <Edit3 size={17} />, onClick: () => open({ kind: 'coverage', coverage: c }) },
              { label: 'Delete', icon: <Trash2 size={17} />, danger: true, onClick: () => setConfirm({ title: 'Delete coverage?', message: `${c.number} and its reminder will be removed.`, run: () => deleteCoverage(c.id) }) },
            ] })}><MoreVertical size={16} /></button>}
          </div>
        ))}
        {hist.length > 0 && <><button className="link-btn xs" onClick={() => setShowHistory(!showHistory)}><History size={12} /> History ({hist.length})</button>{showHistory && hist.map((c) => <div key={c.id} className="card-row muted"><span className="grow xs">{c.provider} · {c.number}<br />{fmtDate(c.startDate)} – {fmtDate(c.endDate)}</span><Badge>History</Badge></div>)}</>}
      </SecBox>

      <SecBox c={collapsed} t={toggle} id="due" title="Due & reminders" icon={<Bell size={15} />} count={obs.length} action={<AddBtn on={() => open({ kind: 'obligation', assetId: a.id })} />}>
        {obs.length === 0 ? <Empty icon={<Bell size={18} />} title="Nothing due">{editable && <button className="btn btn-sm btn-primary" onClick={w(() => open({ kind: 'obligation', assetId: a.id }))}>Add reminder</button>}</Empty> : obs.slice(0, 5).map((o) => {
          const nr = nextReminder(db, o.dueDate, o.reminders, o.dueTime);
          return (
            <div key={o.id} className={cx('card-row', obState(o))}>
              <div className="grow" style={{ minWidth: 0 }}>
                <b className="small">{o.title}</b>
                <span className="xs muted" style={{ display: 'block' }}>{fmtDate(o.dueDate)}{o.amount ? ` · ${inr(o.amount)}` : ''}{o.recurrence !== 'none' ? ` · repeats ${o.recurrence === "custom" ? "on chosen dates" : o.recurrence.replace("_", "-")}` : ''}</span>
                <span className="xs muted">{a.space === 'private' ? 'Reminds only you' : 'Reminds the family'}{nr ? ` · next ${fmtDateTime(nr)}` : ''}{o.snoozedUntil ? ` · snoozed` : ''}</span>
              </div>
              <ObBadge o={o} />
              {editable && <button className="icon-btn sm" aria-label="Reminder actions" onClick={() => setSheet({ title: o.title, actions: [
                { label: 'Mark paid / renewed', icon: <CalendarCheck size={17} />, onClick: () => open({ kind: 'complete', obligation: o }) },
                { label: 'Snooze until tomorrow 9 AM', icon: <Moon size={17} />, onClick: () => { snooze(o.id, addDays(today(), 1)); toast({ type: 'info', title: 'Snoozed till tomorrow' }); } },
                { label: 'Snooze for a week', icon: <Moon size={17} />, onClick: () => { snooze(o.id, addDays(today(), 7)); toast({ type: 'info', title: 'Snoozed for a week' }); } },
                { label: 'Edit', icon: <Edit3 size={17} />, onClick: () => open({ kind: 'obligation', obligation: o }) },
                { label: 'Cancel (stop reminders)', icon: <X size={17} />, danger: true, onClick: () => { cancelObligation(o.id); toast({ type: 'success', title: 'Cancelled' }); } },
              ] })}><MoreVertical size={16} /></button>}
            </div>
          );
        })}
      </SecBox>

      <SecBox c={collapsed} t={toggle} id="tasks" title="Tasks" icon={<ClipboardList size={15} />} count={openTasks.length} action={<AddBtn on={() => open({ kind: 'task', assetId: a.id })} />}>
        {openTasks.length === 0 ? <Empty icon={<ClipboardList size={18} />} title="No open tasks">{editable && <button className="btn btn-sm btn-primary" onClick={w(() => open({ kind: 'task', assetId: a.id }))}>Add task</button>}</Empty> : openTasks.slice(0, 5).map((t) => (
          <div key={t.id} className="card-row">
            <input type="checkbox" className="check-lg" aria-label={`Mark ${t.title} done`} checked={false} disabled={!(canEdit(me, t) || t.assigneeId === me.id)} onChange={() => setConfirm({ title: 'Mark as done?', label: 'Yes, done', message: `“${t.title}” will move to Completed.${t.recurrence !== 'none' ? ' The next one is added automatically.' : ''}`, run: () => { setTaskStatus(t.id, 'done'); toast({ type: 'success', title: 'Done', message: t.recurrence !== 'none' ? 'Next one added' : undefined }); } })} />
            <div className="grow" style={{ minWidth: 0 }}><b className="small">{t.title}</b><span className="xs muted" style={{ display: 'block' }}>{withRelation(db, t.assigneeId, me)} · {fmtDate(t.dueDate)}{t.dueTime ? ` ${t.dueTime}` : ''}</span></div>
            <TaskBadge t={t} />
            {canEdit(me, t) && <button className="icon-btn sm" aria-label="Task actions" onClick={() => setSheet({ title: t.title, actions: [
              { label: 'Edit', icon: <Edit3 size={17} />, onClick: () => open({ kind: 'task', task: t }) },
              { label: 'Cancel task', icon: <X size={17} />, onClick: () => setConfirm({ title: 'Cancel this task?', label: 'Cancel task', message: `“${t.title}” is cancelled and its reminders stop.`, run: () => setTaskStatus(t.id, 'cancelled') }) },
              { label: 'Delete', icon: <Trash2 size={17} />, danger: true, onClick: () => removeRow('tasks', t.id) },
            ] })}><MoreVertical size={16} /></button>}
          </div>
        ))}
        {doneTasks.length > 0 && <><button className="link-btn xs" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide' : 'Show'} done ({doneTasks.length})</button>{showDone && doneTasks.map((t) => <div key={t.id} className="card-row muted"><span className="grow xs" style={{ textDecoration: 'line-through' }}>{t.title}</span>{canEdit(me, t) && <button className="btn btn-xs" onClick={() => setTaskStatus(t.id, 'pending')}>Reopen</button>}</div>)}</>}
      </SecBox>

      <SecBox c={collapsed} t={toggle} id="documents" title="Documents" icon={<FileText size={15} />} count={docs.length} action={<AddBtn on={() => open({ kind: 'document', ownerType: 'asset', ownerId: a.id })} />}>
        {docs.length === 0 ? <Empty icon={<FileText size={18} />} title="Add the invoice, policy or warranty card">{editable && <button className="btn btn-sm btn-primary" onClick={w(() => open({ kind: 'document', ownerType: 'asset', ownerId: a.id, category: 'Purchase' }))}>Scan or upload</button>}</Empty> : (
          <div className="doc-grid">
            {docs.slice(0, 6).map((d) => (
              <button key={d.id} className="doc-tile" onClick={() => setDoc(d)}>
                <span className="doc-thumb"><FileText size={20} /><em>{d.fileName.split('.').pop()?.toUpperCase()}</em></span>
                <b className="ellipsis">{d.title}</b>
                <em className={cx(d.expiryDate && daysUntil(d.expiryDate) <= 30 && 'text-warning')}>{d.expiryDate ? `Exp ${fmtDate(d.expiryDate).slice(0, 6)}` : d.category}</em>
              </button>
            ))}
          </div>
        )}
        {docs.length > 6 && <Link className="link-btn xs" to="/more/documents">All {docs.length} documents</Link>}
      </SecBox>

      <SecBox c={collapsed} t={toggle} id="service" title="Service & maintenance" icon={<Wrench size={15} />} count={services.length} action={<AddBtn on={() => open({ kind: 'service', assetId: a.id })} label="Log" />}>
        {schedules.map((s) => (
          <div key={s.id} className={cx('card-row', daysUntil(s.nextDue) < 0 ? 'overdue' : daysUntil(s.nextDue) <= 14 ? 'due' : '')}>
            <CalendarCheck size={16} className="muted" />
            <div className="grow"><b className="small">Next: {s.title}</b><span className="xs muted" style={{ display: 'block' }}>{fmtDate(s.nextDue)} · every {s.intervalDays} days</span></div>
            {editable && <button className="btn btn-xs" onClick={w(() => open({ kind: 'service', assetId: a.id, scheduleId: s.id }))}>Done</button>}
          </div>
        ))}
        {editable && !schedules.length && <button className="link-btn xs" onClick={w(() => open({ kind: 'schedule', assetId: a.id }))}><Plus size={12} /> Add a service schedule</button>}
        {services.length === 0 ? <Empty icon={<Wrench size={18} />} title="No service history" /> : services.slice(0, 5).map((s) => (
          <div key={s.id} className="card-row">
            <div className="grow" style={{ minWidth: 0 }}><b className="small">{s.workDone}</b><span className="xs muted" style={{ display: 'block' }}>{fmtDate(s.date)} · {s.provider}{s.reading ? ` · ${s.reading}` : ''}</span></div>
            <b className="small">{s.cost ? inr(s.cost) : 'Free'}</b>
            {editable && <button className="icon-btn sm" aria-label="Delete service" onClick={() => setConfirm({ title: 'Delete service entry?', message: 'Its expense is removed too.', run: () => deleteService(s.id) })}><Trash2 size={14} /></button>}
          </div>
        ))}
      </SecBox>

      <SecBox c={collapsed} t={toggle} id="contacts" title="Contacts" icon={<Phone size={15} />} count={contacts.length} action={<AddBtn on={() => open({ kind: 'mapContact', assetId: a.id })} label="Map" />}>
        {contacts.length === 0 ? <Empty icon={<Phone size={18} />} title="Who repairs this?">{editable && <button className="btn btn-sm btn-primary" onClick={w(() => open({ kind: 'mapContact', assetId: a.id }))}>Map a contact</button>}</Empty> : contacts.map((m) => {
          const c = db.contacts.find((x) => x.id === m.contactId);
          if (!c) return null;
          return (
            <div key={m.id} className="card-row">
              <div className="grow" style={{ minWidth: 0 }}><span className="xs text-brand strong">{m.purpose}</span><b className="small" style={{ display: 'block' }}>{c.name}</b><span className="xs muted">{c.phone}</span></div>
              <a className="icon-btn sm tint" href={`tel:${c.phone}`} aria-label={`Call ${c.name}`}><Phone size={15} /></a>
              <a className="icon-btn sm tint" href={`https://wa.me/91${c.phone}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${c.name}`}><MessageCircle size={15} /></a>
              {editable && <button className="icon-btn sm" aria-label="Remove contact" onClick={() => removeRow('assetContacts', m.id)}><X size={14} /></button>}
            </div>
          );
        })}
      </SecBox>

      <SecBox c={collapsed} t={toggle} id="cost" title="Cost & value" icon={<IndianRupee size={15} />} action={editable && <div className="row" style={{ gap: 4 }}><button className="btn btn-xs" onClick={w(() => open({ kind: 'valuation', assetId: a.id }))}><TrendingUp size={12} /> Value</button><button className="btn btn-xs" onClick={w(() => open({ kind: 'expense', assetId: a.id }))}><Plus size={12} /> Expense</button></div>}>
        <div className="mini-stats">
          <span><em>Purchase</em><b>{a.purchaseCost ? inr(a.purchaseCost) : '—'}</b></span>
          <span><em>Expenses</em><b>{inr(lcc - (a.purchaseCost ?? 0))}</b></span>
          <span><em>Lifecycle</em><b>{inr(lcc)}</b></span>
        </div>
        {trend.length >= 2 && <TrendChart data={trend} series={[{ key: 'value', label: 'Value' }]} format={(n) => inr(n, { compact: true })} height={150} />}
        {expenses.length === 0 ? <p className="xs muted">No expenses yet.</p> : expenses.slice(0, 5).map((e) => (
          <div key={e.id} className="card-row"><div className="grow"><b className="small">{e.type}</b><span className="xs muted" style={{ display: 'block' }}>{fmtDate(e.date)} · paid by {db.members.find((m) => m.id === e.paidBy)?.name.split(' ')[0]}{e.notes ? ` · ${e.notes}` : ''}</span></div><b className="small">{inr(e.amount)}</b>
            {editable && !e.ref && <button className="icon-btn sm" aria-label="Edit expense" onClick={() => open({ kind: 'expense', expense: e })}><Edit3 size={14} /></button>}</div>
        ))}
      </SecBox>

      {(children.length > 0 || parent) && (
        <SecBox c={collapsed} t={toggle} id="related" title="Related assets" icon={<Layers size={15} />} count={children.length + (parent ? 1 : 0)}>
          {parent && <Link to={`/assets/${parent.id}`} className="card-row"><span className="grow small">Part of <b>{parent.name}</b></span></Link>}
          {children.map((c) => <Link key={c.id} to={`/assets/${c.id}`} className="card-row"><span className="grow small">{c.name}</span></Link>)}
        </SecBox>
      )}

      <SecBox c={collapsed} t={toggle} id="sharing" title="Sharing & visibility" icon={<Share2 size={15} />}>
        <div className="card-row">
          {a.space === 'private' ? <Lock size={18} /> : <Users size={18} />}
          <div className="grow"><b className="small">{a.space === 'private' ? `Private to ${db.members.find((m) => m.id === a.privateOwnerId)?.name.split(' ')[0]}` : `Shared with ${db.settings.familyName}`}</b><span className="xs muted" style={{ display: 'block' }}>{a.space === 'private' ? 'Nobody else can see it; it’s left out of family totals.' : `${db.members.filter((m) => m.state === 'joined' || m.state === 'self').map((m) => m.name.split(' ')[0]).join(', ')} can see it and get its reminders.`}</span></div>
          {canMoveSpace(me, a) && <button className="btn btn-xs" onClick={() => setConfirm({ title: a.space === 'private' ? 'Share with the family?' : 'Move to your private space?', message: a.space === 'private' ? 'Everyone in the family will see this asset, its documents, policies and reminders.' : 'Only you will see it — with its documents, policies, reminders and tasks.', label: 'Move', run: () => { moveSpace(a.id, a.space === 'private' ? 'family' : 'private'); toast({ type: 'success', title: 'Moved' }); } })}>{a.space === 'private' ? 'Share with family' : 'Make private'}</button>}
        </div>
        {nominees.map((n) => <div key={n.id} className="card-row"><UserCheck size={16} /><span className="grow small">Nominee <b>{n.name}</b> can view this ({n.access})</span></div>)}
        <p className="xs muted">Sharing outside the family (CA, agent) with expiry — planned (P1).</p>
      </SecBox>

      <SecBox c={collapsed} t={toggle} id="timeline" title="Timeline" icon={<History size={15} />} count={events.length}>
        <ol className="timeline">
          {(allTimeline ? events : events.slice(0, 10)).map((e) => {
            const by = db.members.find((m) => m.id === e.by);
            return <li key={e.id}><Avatar name={by?.name ?? '?'} color={by?.color} size={22} /><div><b className="small">{e.text}</b>{e.reason && <span className="xs muted" style={{ display: 'block' }}>{e.reason}</span>}<span className="xs muted">{fmtDateTime(e.at)} · {by?.id === me.id ? 'you' : by?.name.split(' ')[0]}</span></div></li>;
          })}
        </ol>
        {events.length > 10 && <button className="link-btn xs" onClick={() => setAllTimeline(!allTimeline)}>{allTimeline ? 'Show less' : `Show all ${events.length}`}</button>}
      </SecBox>
      <div style={{ height: 30 }} />

      {sheet && <ActionSheet open onClose={() => setSheet(null)} title={sheet.title} actions={sheet.actions} />}
      <Confirm open={!!confirm} title={confirm?.title ?? ''} message={confirm?.message ?? ''} confirmLabel={confirm?.label} danger={!confirm?.label} onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />
      <Sheet open={qr} onClose={() => setQr(false)} title={`QR label — ${a.code}`} footer={<button className="btn btn-primary btn-block" onClick={() => { setQr(false); nav(`/more/qr?ids=${a.id}&from=asset`); }}><Printer size={15} /> Print label</button>}>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}><Qr value={`${window.location.origin}${import.meta.env.BASE_URL}assets/${a.id}`} size={200} /><b>{a.name}</b><span className="xs muted">Scan with a phone camera to open this page</span></div>
      </Sheet>
      <Sheet open={!!doc} onClose={() => setDoc(null)} title={doc?.title} subtitle={doc ? `${doc.category} · ${doc.pages} page${doc.pages > 1 ? 's' : ''} · ${fileSize(doc.size)}` : ''}
        footer={doc && <div className="row" style={{ width: '100%' }}>{editable && <button className="btn btn-danger-outline" onClick={() => { const d = doc; setDoc(null); setConfirm({ title: 'Delete document?', message: d.title, run: () => deleteDoc(d.id) }); }}><Trash2 size={14} /></button>}{editable && <button className="btn grow" onClick={() => { const d = doc; setDoc(null); open({ kind: 'document', doc: d }); }}><Edit3 size={14} /> Edit</button>}<button className="btn btn-primary grow" onClick={() => toast({ type: 'info', title: 'Opening file', message: doc.fileName })}>Open</button></div>}>
        {doc && <div className="stack"><div className="doc-preview"><FileText size={34} /><span>{doc.fileName}</span></div><KV rows={[['Number', doc.number], ['Issued by', doc.issuer], ['Issued', doc.issueDate && fmtDate(doc.issueDate)], ['Expires', doc.expiryDate && fmtDate(doc.expiryDate)], ['Added by', `${db.members.find((m) => m.id === doc.createdBy)?.name.split(' ')[0]} · ${fmtDate(doc.createdAt)}`], ['Notes', doc.notes]]} /></div>}
      </Sheet>
    </div>
  );

  function menuActions(): SheetAction[] {
    return [
      { label: 'Edit asset', icon: <Edit3 size={17} />, onClick: () => open({ kind: 'asset', asset: a }), hidden: !editable },
      { label: 'Change status', icon: <ToggleRight size={17} />, onClick: w(() => open({ kind: 'status', assetId: a.id })), hidden: !editable },
      { label: a.space === 'private' ? 'Share with family' : 'Move to private space', icon: a.space === 'private' ? <Users size={17} /> : <Lock size={17} />, onClick: () => jump('sharing'), hidden: !canMoveSpace(me, a) },
      { label: 'Print QR label', icon: <QrCode size={17} />, onClick: () => setQr(true) },
      { label: 'One-page PDF', icon: <Printer size={17} />, onClick: () => nav(`/assets/${a.id}/pdf`) },
      { label: 'Archive', icon: <Archive size={17} />, danger: true, onClick: () => setConfirm({ title: 'Archive this asset?', message: 'It’s hidden from lists and totals; documents and history are kept.', label: 'Archive', run: () => { archiveAsset(a.id, true); toast({ type: 'success', title: 'Archived' }); nav('/assets'); } }), hidden: !editable || !(isOwner(me) || a.createdBy === me.id || a.privateOwnerId === me.id) },
    ];
  }
}

function SecBox({ id, title, icon, count, action, children, c, t }: { id: Sid; title: string; icon: ReactNode; count?: number; action?: ReactNode; children: ReactNode; c: Record<string, boolean>; t: (id: string) => void }) {
  return (
    <section className="a-sec" id={`s-${id}`}>
      <div className="a-sec-head">
        <button className="a-sec-toggle" onClick={() => t(id)} aria-expanded={!c[id]}>
          <span className="icon-tile sm">{icon}</span><h3>{title}{count !== undefined && <span className="muted"> · {count}</span>}</h3>
          <ChevronDown size={16} style={{ transform: c[id] ? 'rotate(-90deg)' : undefined, transition: 'transform .15s' }} />
        </button>
        {!c[id] && action}
      </div>
      {!c[id] && <div className="a-sec-body">{children}</div>}
    </section>
  );
}

export function AssetPdfPage() {
  const { id } = useParams();
  const db = useDb();
  const me = useMe()!;
  const nav = useNavigate();
  const a = db.assets.find((x) => x.id === id);
  if (!a || !visible(a, me)) return <div className="page"><Empty icon={<FileText size={20} />} title="Not found" /></div>;
  const covs = db.coverages.filter((c) => c.assetId === a.id && !c.supersededById);
  const obs = db.obligations.filter((o) => o.assetId === a.id && o.status === 'open' && visible(o, me));
  const docs = db.docs.filter((d) => d.ownerType === 'asset' && d.ownerId === a.id && visible(d, me));
  const v = assetValue(db, a);
  return (
    <div className="page">
      <div className="topbar no-print"><button className="icon-btn" aria-label="Back" onClick={() => nav(-1)}><ArrowLeft size={20} /></button><h1 className="grow">One-page PDF</h1><button className="btn btn-sm btn-primary" onClick={() => window.print()}><Printer size={14} /> Save PDF</button></div>
      <article className="pdf">
        <div className="row between"><div><b style={{ fontSize: '1.1rem' }}>{a.name}</b><p className="xs muted">{db.categories.find((c) => c.id === a.categoryId)?.name} › {db.subcategories.find((s) => s.id === a.subcategoryId)?.name} · {a.code}</p></div><Qr value={`${window.location.origin}${import.meta.env.BASE_URL}assets/${a.id}`} size={70} /></div>
        <KV rows={[['Owner', withRelation(db, a.ownerMemberId)], ['Value', `${inr(v.value)}${v.estimated ? ' (est.)' : ''}`], ['Purchased', a.purchaseDate && `${fmtDate(a.purchaseDate)} · ${a.purchaseCost ? inr(a.purchaseCost) : ''}`], ...Object.entries(a.fields).slice(0, 8).map(([k, x]) => [k.replace(/_/g, ' '), String(x)] as [string, string])]} />
        <h4>Coverage</h4>{covs.map((c) => <p key={c.id} className="xs">{covLabel(c)} · {c.provider} · {c.number} · till {fmtDate(c.endDate)}</p>)}{!covs.length && <p className="xs">None</p>}
        <h4>Due</h4>{obs.map((o) => <p key={o.id} className="xs">{fmtDate(o.dueDate)} · {o.title}{o.amount ? ` · ${inr(o.amount)}` : ''}</p>)}{!obs.length && <p className="xs">Nothing due</p>}
        <h4>Documents</h4><p className="xs">{docs.map((d) => d.title).join(' · ') || 'None'}</p>
        <p className="xs muted" style={{ marginTop: 14 }}>Generated {fmtDateTime(new Date().toISOString())} by {me.name} · Mynages · private items excluded unless you own them</p>
      </article>
    </div>
  );
}
