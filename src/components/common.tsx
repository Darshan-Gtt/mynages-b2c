import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, Lock, MoreVertical, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useDb } from '../lib/store';
import { setSpace, useMe, useSpace } from '../lib/session';
import { covState, obState, taskOverdue, withRelation } from '../lib/compute';
import { cx, daysUntil, fmtDate } from '../lib/utils';
import type { Asset, Coverage, Obligation, Task } from '../lib/types';
import { Badge, type Tone } from './ui/Misc';
import { Sheet } from './ui/Modal';
import { AssetIcon } from './Icons';

export function TopBar({ title, back, actions, sub }: { title: ReactNode; back?: boolean | string; actions?: ReactNode; sub?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      {back && <button className="icon-btn" aria-label="Back" onClick={() => (typeof back === 'string' ? nav(back) : window.history.length > 1 ? nav(-1) : nav('/'))}><ArrowLeft size={20} /></button>}
      <div className="grow" style={{ minWidth: 0 }}><h1 className="ellipsis">{title}</h1>{sub && <p className="xs muted ellipsis">{sub}</p>}</div>
      {actions}
    </header>
  );
}

export function SpaceSwitch() {
  const db = useDb();
  const me = useMe()!;
  const space = useSpace();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={cx('space-chip', space === 'private' && 'private')} onClick={() => setOpen(true)}>
        {space === 'family' ? <Users size={14} /> : <Lock size={14} />}
        <span className="ellipsis">{space === 'family' ? db.settings.familyName : 'My private space'}</span>
        <ChevronDown size={14} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Switch space">
        <div className="action-list">
          <button className="action-item" onClick={() => { setSpace('family'); setOpen(false); }}>
            <Users size={18} /><span className="grow">{db.settings.familyName}<em>Shared with {db.members.filter((m) => m.state === 'joined' || m.state === 'self').length} joined members</em></span>{space === 'family' && <Check size={16} />}
          </button>
          <button className="action-item" onClick={() => { setSpace('private'); setOpen(false); }}>
            <Lock size={18} /><span className="grow">My private space<em>Only {me.name.split(' ')[0]} can see these items</em></span>{space === 'private' && <Check size={16} />}
          </button>
        </div>
      </Sheet>
    </>
  );
}

export function AssetCard({ a, grid }: { a: Asset; grid?: boolean }) {
  const db = useDb();
  const cat = db.categories.find((c) => c.id === a.categoryId);
  const st = db.statuses.find((s) => s.id === a.statusId);
  const covs = db.coverages.filter((c) => c.assetId === a.id && !c.supersededById);
  const warn = covs.some((c) => covState(c) === 'expiring') ? 'expiring' : covs.some((c) => covState(c) === 'lapsed') ? 'lapsed' : undefined;
  if (grid) {
    return (
      <Link to={`/assets/${a.id}`} className="gcard">
        <span className="gcard-img" style={{ background: `linear-gradient(135deg, ${a.color}, color-mix(in srgb, ${a.color} 50%, #0F2D3D))` }}><AssetIcon categoryIcon={cat?.icon} subcategoryId={a.subcategoryId} size={30} />{a.space === 'private' && <Lock size={12} className="gcard-lock" />}</span>
        <b className="ellipsis">{a.name}</b>
        <em className="ellipsis">{db.subcategories.find((s) => s.id === a.subcategoryId)?.name}{warn ? ' · ⚠︎' : ''}</em>
      </Link>
    );
  }
  return (
    <Link to={`/assets/${a.id}`} className="mrow">
      <span className="icon-tile" style={{ background: `color-mix(in srgb, ${a.color} 15%, var(--surface))`, color: a.color }}><AssetIcon categoryIcon={cat?.icon} subcategoryId={a.subcategoryId} /></span>
      <span className="row-text">
        <b>{a.name}{a.space === 'private' && <Lock size={11} style={{ display: 'inline', marginLeft: 4, verticalAlign: -1 }} />}</b>
        <em>{db.subcategories.find((s) => s.id === a.subcategoryId)?.name} · {withRelation(db, a.ownerMemberId)}</em>
      </span>
      {warn ? <Badge tone={warn === 'lapsed' ? 'danger' : 'warning'}>{warn === 'lapsed' ? 'Cover lapsed' : 'Expiring'}</Badge> : st && st.id !== 'st_active' ? <Badge tone={st.tone}>{st.name.split(' ')[0]}</Badge> : null}
    </Link>
  );
}

export function CovBadge({ c }: { c: Coverage }) {
  const s = covState(c);
  const d = daysUntil(c.endDate);
  const m: Record<string, [Tone, string]> = { active: ['success', `${d > 365 ? `${Math.round(d / 365)}y` : `${d}d`} left`], expiring: ['warning', `${d} days left`], lapsed: ['danger', `Lapsed ${-d}d`], history: ['neutral', 'History'] };
  return <Badge tone={m[s][0]}>{m[s][1]}</Badge>;
}
export function ObBadge({ o }: { o: Obligation }) {
  const s = obState(o);
  const d = daysUntil(o.dueDate);
  const m: Record<string, [Tone, string]> = { overdue: ['danger', `Overdue ${-d}d`], due: ['warning', d === 0 ? 'Today' : `In ${d}d`], upcoming: ['info', fmtDate(o.dueDate).slice(0, 6)], completed: ['success', 'Paid'], cancelled: ['neutral', 'Cancelled'] };
  return <Badge tone={m[s][0]}>{m[s][1]}</Badge>;
}
export function TaskBadge({ t }: { t: Task }) {
  if (taskOverdue(t)) return <Badge tone="danger">Overdue</Badge>;
  const m: Record<Task['status'], [Tone, string]> = { pending: ['info', 'To do'], in_progress: ['warning', 'Doing'], done: ['success', 'Done'], cancelled: ['neutral', 'Cancelled'] };
  return <Badge tone={m[t.status][0]}>{m[t.status][1]}</Badge>;
}

export function MenuBtn({ onClick, label = 'More actions' }: { onClick: () => void; label?: string }) {
  return <button className="icon-btn sm" aria-label={label} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}><MoreVertical size={17} /></button>;
}

export function ReadOnlyBanner() {
  const db = useDb();
  const s = db.subscription;
  if (s.status === 'expired') return <Link to="/more/settings/plan" className="banner danger">Subscription ended — view, search and export only. {db.members.find((m) => m.id === db.settings.ownerId)?.name.split(' ')[0]} can resubscribe →</Link>;
  if (s.status === 'past_due') return <Link to="/more/settings/plan" className="banner warning">Renewal payment failed — update payment within 7 days to avoid interruption →</Link>;
  if (s.status === 'trialing' && s.trialEndsAt) return <Link to="/more/settings/plan" className="banner info">Free trial · {Math.max(0, daysUntil(s.trialEndsAt))} days left →</Link>;
  return null;
}
