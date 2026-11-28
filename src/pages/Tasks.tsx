import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bell, Phone, CalendarCheck, CalendarDays, ClipboardList, Edit3, List, Moon, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useActive } from '../lib/hooks';
import { canEdit } from '../lib/access';
import { cancelObligation, removeRow, setTaskStatus, snooze } from '../lib/actions';
import { obState, taskOverdue, withRelation } from '../lib/compute';
import { addDays, cx, daysUntil, fmtDate, inr, today } from '../lib/utils';
import { MenuBtn, ObBadge, SpaceSwitch, TaskBadge, TopBar } from '../components/common';
import { Empty, Pills, Segmented } from '../components/ui/Misc';
import { ActionSheet, Confirm, type SheetAction } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useEd } from '../components/editors/Editors';
import { MonthCalendar } from '../components/MonthCalendar';
import type { Obligation, Task } from '../lib/types';

type Tab = 'today' | 'upcoming' | 'overdue' | 'completed' | 'subscriptions';
type Scope = 'mine' | 'byme' | 'all';
type Item = { kind: 'task'; t: Task; date: string } | { kind: 'ob'; o: Obligation; date: string };

export function TasksPage() {
  const { db, me, tasks, obligations } = useActive();
  const toast = useToast();
  const { open } = useEd();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'upcoming';
  const [scope, setScope] = useState<Scope>(me.role === 'view_only' ? 'mine' : 'all');
  const [show, setShow] = useState<'both' | 'tasks' | 'reminders'>(params.get('tab') === 'reminders' ? 'reminders' : 'both');
  const [view, setView] = useState<'list' | 'cal'>('list');
  const [sheet, setSheet] = useState<null | { title: string; actions: SheetAction[] }>(null);
  const [ask, setAsk] = useState<null | { title: string; message: string; label: string; danger?: boolean; run: () => void }>(null);
  const askDone = (t: Task) => setAsk({
    title: 'Mark as done?', label: 'Yes, done',
    message: `“${t.title}” will move to Completed.${t.recurrence !== 'none' ? ' The next one is added automatically.' : ''}${t.assigneeId !== me.id ? ` ${db.members.find((m) => m.id === t.assigneeId)?.name.split(' ')[0]} is notified.` : ''}`,
    run: () => { setTaskStatus(t.id, 'done'); toast({ type: 'success', title: 'Done!', message: t.recurrence !== 'none' ? 'Next one added' : undefined }); },
  });
  const askReopen = (t: Task) => setAsk({ title: 'Mark as not done?', label: 'Reopen', message: `“${t.title}” goes back to the open list.`, run: () => { setTaskStatus(t.id, 'pending'); toast({ type: 'success', title: 'Task reopened' }); } });

  const items = useMemo<Item[]>(() => {
    const ts = tasks.filter((t) => scope === 'all' || (scope === 'mine' ? t.assigneeId === me.id : t.createdBy === me.id && t.assigneeId !== me.id));
    const os = scope === 'byme' ? [] : obligations;
    return [
      ...(show !== 'reminders' ? ts.map((t) => ({ kind: 'task' as const, t, date: t.dueDate })) : []),
      ...(show !== 'tasks' ? os.map((o) => ({ kind: 'ob' as const, o, date: o.dueDate })) : []),
    ];
  }, [tasks, obligations, scope, show, me.id]);

  const isOpen = (i: Item) => (i.kind === 'task' ? i.t.status === 'pending' || i.t.status === 'in_progress' : i.o.status === 'open');
  const isOver = (i: Item) => (i.kind === 'task' ? taskOverdue(i.t) : obState(i.o) === 'overdue');
  const filtered = items.filter((i) => {
    if (tab === 'today') return isOpen(i) && i.date <= today();
    if (tab === 'upcoming') return isOpen(i) && !isOver(i);
    if (tab === 'overdue') return isOpen(i) && isOver(i);
    if (tab === 'completed') return !isOpen(i);
    return i.kind === 'ob' && i.o.type === 'subscription_renewal';
  }).sort((a, b) => (tab === 'completed' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  const count = (t: Tab) => items.filter((i) => (t === 'today' ? isOpen(i) && i.date <= today() : t === 'upcoming' ? isOpen(i) && !isOver(i) : t === 'overdue' ? isOpen(i) && isOver(i) : t === 'completed' ? !isOpen(i) : i.kind === 'ob' && i.o.type === 'subscription_renewal')).length;

  const taskActions = (t: Task): SheetAction[] => [
    { label: t.status === 'in_progress' ? 'Mark to do' : 'Start', icon: <Play size={17} />, onClick: () => setTaskStatus(t.id, t.status === 'in_progress' ? 'pending' : 'in_progress'), hidden: !(t.status === 'pending' || t.status === 'in_progress') },
    { label: 'Reopen', icon: <RotateCcw size={17} />, onClick: () => askReopen(t), hidden: t.status === 'pending' || t.status === 'in_progress' },
    { label: 'Edit', icon: <Edit3 size={17} />, onClick: () => open({ kind: 'task', task: t }), hidden: !canEdit(me, t) },
    { label: 'Cancel task', icon: <X size={17} />, onClick: () => setAsk({ title: 'Cancel this task?', label: 'Cancel task', danger: true, message: `“${t.title}” is cancelled and its reminders stop. It stays in Completed for history.`, run: () => { setTaskStatus(t.id, 'cancelled'); toast({ type: 'success', title: 'Task cancelled' }); } }), hidden: !canEdit(me, t) || t.status === 'cancelled' || t.status === 'done' },
    { label: 'Delete', icon: <Trash2 size={17} />, danger: true, onClick: () => { removeRow('tasks', t.id); toast({ type: 'success', title: 'Task deleted' }); }, hidden: !canEdit(me, t) },
  ];
  const obActions = (o: Obligation): SheetAction[] => [
    { label: 'Mark paid / renewed', icon: <CalendarCheck size={17} />, onClick: () => open({ kind: 'complete', obligation: o }), hidden: o.status !== 'open' },
    { label: 'Snooze until tomorrow', icon: <Moon size={17} />, onClick: () => { snooze(o.id, addDays(today(), 1)); toast({ type: 'info', title: 'Snoozed' }); }, hidden: o.status !== 'open' },
    { label: 'Edit', icon: <Edit3 size={17} />, onClick: () => open({ kind: 'obligation', obligation: o }) },
    { label: 'Cancel (stop reminders)', icon: <X size={17} />, onClick: () => setAsk({ title: 'Stop this reminder?', label: 'Stop reminders', danger: true, message: `No more reminders for “${o.title}”. It stays in Completed for history.`, run: () => { cancelObligation(o.id); toast({ type: 'success', title: 'Reminder stopped' }); } }), hidden: o.status !== 'open' },
    { label: 'Delete', icon: <Trash2 size={17} />, danger: true, onClick: () => setAsk({ title: 'Delete this reminder?', label: 'Delete', danger: true, message: `“${o.title}” is removed permanently. This can’t be undone.`, run: () => { removeRow('obligations', o.id); toast({ type: 'success', title: 'Reminder deleted' }); } }) },
  ];

  const row = (i: Item) => i.kind === 'task' ? (
    <div key={i.t.id} className={cx('mrow', taskOverdue(i.t) && 'danger')}>
      <input type="checkbox" className="check-lg" aria-label={`Mark ${i.t.title} done`} checked={i.t.status === 'done'} disabled={!(canEdit(me, i.t) || i.t.assigneeId === me.id) || i.t.status === 'cancelled'}
        onChange={(e) => (e.target.checked ? askDone(i.t) : askReopen(i.t))} />
      <span className="row-text">
        <b style={{ textDecoration: i.t.status === 'done' ? 'line-through' : undefined }}>{i.t.title}</b>
        <em>{withRelation(db, i.t.assigneeId, me)} · {fmtDate(i.t.dueDate)}{i.t.dueTime ? ` ${i.t.dueTime}` : ''}{i.t.assetId ? ` · ${db.assets.find((a) => a.id === i.t.assetId)?.name}` : i.t.memberId ? ` · ${db.members.find((m) => m.id === i.t.memberId)?.name.split(' ')[0]}` : ''}</em>
      </span>
      <TaskBadge t={i.t} />
      <MenuBtn onClick={() => setSheet({ title: i.t.title, actions: taskActions(i.t) })} />
    </div>
  ) : (
    <div key={i.o.id} className={cx('mrow', obState(i.o) === 'overdue' && 'danger')}>
      <span className="icon-tile sm warn"><Bell size={15} /></span>
      <Link to={i.o.assetId ? `/assets/${i.o.assetId}#due` : '#'} className="row-text" style={{ color: 'inherit' }}>
        <b>{i.o.title}</b>
        <em>{fmtDate(i.o.dueDate)}{i.o.dueTime ? ` ${i.o.dueTime}` : ''}{i.o.customType ? ` · ${i.o.customType}` : ''}{i.o.amount ? ` · ${inr(i.o.amount)}` : ''}{i.o.autoRenew ? ' · auto-renews' : ''}{i.o.status === 'completed' ? ` · paid by ${db.members.find((m) => m.id === i.o.completedBy)?.name.split(' ')[0]}` : ''}</em>
      </Link>
      {i.o.contactId && db.contacts.find((c) => c.id === i.o.contactId) && <a className="icon-btn sm" href={`tel:${db.contacts.find((c) => c.id === i.o.contactId)!.phone}`} aria-label={`Call ${db.contacts.find((c) => c.id === i.o.contactId)!.name}`}><Phone size={15} /></a>}
      <ObBadge o={i.o} />
      {canEdit(me, i.o) && <MenuBtn onClick={() => setSheet({ title: i.o.title, actions: obActions(i.o) })} />}
    </div>
  );

  return (
    <div className="page">
      <TopBar title="Tasks & Reminders" actions={<button className="icon-btn" aria-label={view === 'list' ? 'Calendar view' : 'List view'} onClick={() => setView(view === 'list' ? 'cal' : 'list')}>{view === 'list' ? <CalendarDays size={19} /> : <List size={19} />}</button>} />
      <div className="pad-x"><SpaceSwitch /></div>
      <Pills<Tab> value={tab} onChange={(t) => setParams({ tab: t })} items={[
        { id: 'today', label: 'Today', count: count('today') }, { id: 'upcoming', label: 'Upcoming', count: count('upcoming') }, { id: 'overdue', label: 'Overdue', count: count('overdue') },
        { id: 'completed', label: 'Completed' }, { id: 'subscriptions', label: 'Subscriptions', count: count('subscriptions') },
      ]} />
      <div className="row-wrap pad-x" style={{ gap: 6, margin: '8px 0' }}>
        <Segmented label="Whose" value={scope} onChange={setScope} options={[{ value: 'mine', label: 'Mine' }, { value: 'byme', label: 'Assigned by me' }, { value: 'all', label: 'All family' }]} />
        <Segmented label="Show" value={show} onChange={setShow} options={[{ value: 'both', label: 'All' }, { value: 'tasks', label: 'Tasks' }, { value: 'reminders', label: 'Reminders' }]} />
      </div>
      {view === 'cal' ? (
        <MonthCalendar items={items.filter(isOpen).map((i) => ({ id: i.kind === 'task' ? i.t.id : i.o.id, date: i.date, title: i.kind === 'task' ? i.t.title : i.o.title, tone: isOver(i) ? 'danger' : daysUntil(i.date) <= 7 ? 'warning' : 'info' }))}
          render={(its, d) => <><p className="xs muted" style={{ margin: '8px 0' }}>{fmtDate(d)}</p>{its.length ? its.map((x) => { const it = items.find((i) => (i.kind === 'task' ? i.t.id : i.o.id) === x.id)!; return row(it); }) : <p className="small muted">Nothing on this day.</p>}<p className="xs muted" style={{ marginTop: 8 }}>Calendar view (P1 preview) · sync to Google Calendar — planned</p></>} />
      ) : filtered.length === 0 ? (
        <Empty icon={tab === 'subscriptions' ? <Bell size={20} /> : <ClipboardList size={20} />} title={tab === 'overdue' ? 'Nothing overdue 🎉' : tab === 'subscriptions' ? 'No subscriptions' : 'Nothing here'}>
          {tab === 'subscriptions' && <p className="xs muted" style={{ marginBottom: 8 }}>Add a reminder with type “Subscription renewal” (Netflix, Hotstar, Spotify…) to see the monthly total here.</p>}
          {tab !== 'completed' && <div className="row"><button className="btn btn-sm btn-primary" onClick={() => open({ kind: 'task' })}><Plus size={14} /> Task</button><button className="btn btn-sm" onClick={() => open({ kind: 'obligation' })}><Plus size={14} /> Reminder</button></div>}
        </Empty>
      ) : (
        <div className="list">
          {tab === 'subscriptions' && <p className="xs muted pad-x">Reminders of type “Subscription renewal” — Netflix, Hotstar, Spotify, cloud storage, apps. Monthly total: <b>{inr(filtered.reduce((s, i) => s + (i.kind === 'ob' && i.o.recurrence === 'monthly' ? i.o.amount ?? 0 : i.kind === 'ob' && i.o.recurrence === 'yearly' ? (i.o.amount ?? 0) / 12 : 0), 0))}</b> · tip: set a task to cancel before auto-renew</p>}
          {filtered.map(row)}
        </div>
      )}
      <button className="fab" aria-label="Add task" onClick={() => open({ kind: 'task' })}><Plus size={22} /></button>
      <Confirm open={!!ask} title={ask?.title ?? ''} message={ask?.message ?? ''} confirmLabel={ask?.label} danger={!!ask?.danger} onConfirm={() => ask?.run()} onClose={() => setAsk(null)} />
      {sheet && <ActionSheet open onClose={() => setSheet(null)} title={sheet.title} actions={sheet.actions} />}
    </div>
  );
}
