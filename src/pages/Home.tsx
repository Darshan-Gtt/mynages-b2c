import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarClock, ClipboardList, IndianRupee, Package, Search, ChevronRight } from 'lucide-react';
import { useActive } from '../lib/hooks';
import { assetValue, obState, taskOverdue, withRelation } from '../lib/compute';
import { daysUntil, fmtDate, inr, timeAgo } from '../lib/utils';
import { SpaceSwitch, ObBadge, TaskBadge } from '../components/common';
import { Avatar, Empty } from '../components/ui/Misc';
import { useEd } from '../components/editors/Editors';

export function HomePage() {
  const { db, me, space, assets, obligations, tasks, events } = useActive();
  const nav = useNavigate();
  const { open, gate } = useEd();
  const unread = db.notifications.filter((n) => (n.userId === me.id || n.userId === 'all') && !n.read).length;
  const value = assets.filter((a) => !/sold/i.test(a.statusId)).reduce((s, a) => s + assetValue(db, a).value, 0);
  const openObs = obligations.filter((o) => o.status === 'open');
  const due7 = openObs.filter((o) => { const d = daysUntil(o.dueDate); return d >= 0 && d <= 7; }).length + tasks.filter((t) => (t.status === 'pending' || t.status === 'in_progress') && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 7).length;
  const overdue = openObs.filter((o) => obState(o) === 'overdue').length + tasks.filter(taskOverdue).length;
  const openTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const upcoming = [
    ...openObs.map((o) => ({ id: o.id, date: o.dueDate, title: o.title, sub: `${o.amount ? inr(o.amount) + ' · ' : ''}${o.assetId ? db.assets.find((a) => a.id === o.assetId)?.name : o.memberId ? withRelation(db, o.memberId, me) : ''}`, link: o.assetId ? `/assets/${o.assetId}#due` : '/tasks?tab=reminders', badge: <ObBadge o={o} />, kind: 'ob' })),
    ...openTasks.map((t) => ({ id: t.id, date: t.dueDate, title: t.title, sub: `${withRelation(db, t.assigneeId, me)}${t.assetId ? ` · ${db.assets.find((a) => a.id === t.assetId)?.name}` : ''}`, link: '/tasks', badge: <TaskBadge t={t} />, kind: 'task' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
  const hour = new Date().getHours();
  const hi = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page home">
      <div className="home-head">
        <div className="row between">
          <SpaceSwitch />
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn" aria-label="Search" onClick={() => nav('/search')}><Search size={20} /></button>
            <button className="icon-btn" aria-label={`Notifications, ${unread} unread`} onClick={() => nav('/notifications')}><Bell size={20} />{unread > 0 && <span className="bubble">{unread}</span>}</button>
            <Link to="/more/settings/profile" aria-label="Profile"><Avatar name={me.name} color={me.color} size={34} /></Link>
          </div>
        </div>
        <h1>{hi}, {me.name.split(' ')[0]}!</h1>
        <p className="small" style={{ opacity: 0.85 }}>{space === 'family' ? 'Everything in one place.' : 'Your private space — only you can see this.'}</p>
        <button className="home-search" onClick={() => nav('/search')}><Search size={15} /> Search assets, documents, policies…</button>
      </div>

      <div className="tiles">
        <button className="tile" onClick={() => nav('/assets')}><span className="icon-tile sm"><Package size={16} /></span><em>Assets</em><b>{assets.length}</b></button>
        <button className="tile" onClick={() => nav('/assets?sort=value')}><span className="icon-tile sm"><IndianRupee size={16} /></span><em>{space === 'family' ? 'Family value' : 'My value'}</em><b>{inr(value, { compact: true })}</b></button>
        <button className="tile warn" onClick={() => nav('/tasks?tab=upcoming')}><span className="icon-tile sm warn"><CalendarClock size={16} /></span><em>Due in 7 days</em><b>{due7}</b></button>
        <button className="tile danger" onClick={() => nav('/tasks?tab=overdue')}><span className="icon-tile sm danger"><AlertTriangle size={16} /></span><em>Overdue</em><b>{overdue}</b></button>
        <button className="tile wide" onClick={() => nav('/tasks')}><span className="icon-tile sm"><ClipboardList size={16} /></span><em>Open tasks</em><b>{openTasks.length}</b><span className="xs muted">{openTasks.filter((t) => t.assigneeId === me.id).length} for you</span></button>
      </div>

      <section className="msection">
        <div className="msection-head"><h3>Upcoming</h3><Link to="/tasks?tab=upcoming" className="small">View all</Link></div>
        {upcoming.length === 0 ? (
          <Empty icon={<CalendarClock size={20} />} title="Nothing coming up">
            <button className="btn btn-sm btn-primary" onClick={() => gate('write') && open({ kind: 'obligation' })}>Add a reminder</button>
          </Empty>
        ) : (
          <div className="list">
            {upcoming.map((u) => (
              <Link key={u.id} to={u.link} className="mrow">
                <span className={`date-chip ${daysUntil(u.date) < 0 ? 'over' : daysUntil(u.date) <= 7 ? 'soon' : ''}`}><b>{new Date(u.date).getDate()}</b><em>{new Date(u.date).toLocaleDateString('en-IN', { month: 'short' })}</em></span>
                <span className="row-text"><b>{u.title}</b><em>{u.sub}</em></span>
                {u.badge}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="msection">
        <div className="msection-head"><h3>Recent activity</h3></div>
        {events.length === 0 ? <Empty icon={<Package size={20} />} title="No activity yet"><button className="btn btn-sm btn-primary" onClick={() => gate('asset') && open({ kind: 'asset' })}>Add your first asset</button></Empty> : (
          <div className="list">
            {[...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8).map((e) => {
              const by = db.members.find((m) => m.id === e.by);
              return (
                <Link key={e.id} to={e.assetId ? `/assets/${e.assetId}#timeline` : '/more/family'} className="mrow">
                  <Avatar name={by?.name ?? '?'} color={by?.color} size={30} />
                  <span className="row-text"><b>{e.text}</b><em>Added by {by?.id === me.id ? 'you' : by?.name.split(' ')[0]} · {timeAgo(e.at)}</em></span>
                  <ChevronRight size={15} className="muted" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <p className="xs muted center" style={{ padding: '6px 0 20px' }}>{fmtDate(new Date().toISOString())} · {db.settings.familyName}</p>
    </div>
  );
}
