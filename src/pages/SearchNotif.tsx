import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Search, X } from 'lucide-react';
import { useVisible } from '../lib/hooks';
import { markRead } from '../lib/actions';
import { cx, timeAgo } from '../lib/utils';
import { TopBar } from '../components/common';
import { Badge, Empty } from '../components/ui/Misc';

/** Global search across assets, documents, contacts, tasks and members (PRD §7.1, WSP-09). Respects private space. */
export function SearchPage() {
  const { db, assets, docs, tasks, coverages } = useVisible();
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const res = useMemo(() => {
    if (t.length < 2) return [];
    const out: { kind: string; title: string; sub: string; to: string }[] = [];
    assets.forEach((a) => { if ([a.name, a.code, a.serialNo, ...a.tags, ...Object.values(a.fields).map(String)].join(' ').toLowerCase().includes(t)) out.push({ kind: a.archived ? 'Archived' : 'Asset', title: a.name, sub: `${db.subcategories.find((s) => s.id === a.subcategoryId)?.name}${a.space === 'private' ? ' · private' : ''}`, to: `/assets/${a.id}` }); });
    docs.forEach((d) => { if ([d.title, d.number, d.issuer, ...d.tags].join(' ').toLowerCase().includes(t)) out.push({ kind: 'Document', title: d.title, sub: `${d.category} · ${d.ownerType === 'asset' ? db.assets.find((a) => a.id === d.ownerId)?.name : db.members.find((m) => m.id === d.ownerId)?.name}`, to: d.ownerType === 'asset' ? `/assets/${d.ownerId}#documents` : `/more/family/${d.ownerId}` }); });
    coverages.forEach((c) => { if ([c.number, c.provider].join(' ').toLowerCase().includes(t)) out.push({ kind: 'Policy', title: `${c.provider} · ${c.number}`, sub: c.kind, to: c.assetId ? `/assets/${c.assetId}#coverage` : '/more/insurance' }); });
    db.contacts.forEach((c) => { if ([c.name, c.phone].join(' ').toLowerCase().includes(t)) out.push({ kind: 'Contact', title: c.name, sub: c.phone, to: '/more/contacts' }); });
    tasks.forEach((k) => { if (k.title.toLowerCase().includes(t)) out.push({ kind: 'Task', title: k.title, sub: k.status, to: '/tasks' }); });
    db.members.filter((m) => m.state !== 'removed').forEach((m) => { if ([m.name, m.relation, m.mobile].join(' ').toLowerCase().includes(t)) out.push({ kind: 'Member', title: m.name, sub: m.relation, to: `/more/family/${m.id}` }); });
    return out.slice(0, 40);
  }, [t, assets, docs, tasks, coverages, db]);
  return (
    <div className="page">
      <TopBar title="Search" back />
      <div className="search-box"><Search size={17} /><input autoFocus placeholder="Name, number, serial, policy no., tag…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />{q && <button className="icon-btn sm" onClick={() => setQ('')} aria-label="Clear"><X size={15} /></button>}</div>
      {t.length < 2 ? <p className="small muted center" style={{ padding: 30 }}>Try “MH12”, “Star Health”, “Aadhaar”, “warranty”…</p> : res.length === 0 ? <Empty icon={<Search size={20} />} title={`Nothing found for “${q}”`} /> : (
        <div className="list">{res.map((r, i) => <Link key={i} to={r.to} className="mrow"><Badge>{r.kind}</Badge><span className="row-text"><b>{r.title}</b><em>{r.sub}</em></span></Link>)}</div>
      )}
    </div>
  );
}

export function NotificationsPage() {
  const { db, me } = useVisible();
  const nav = useNavigate();
  const mine = db.notifications.filter((n) => n.userId === me.id || n.userId === 'all').sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="page">
      <TopBar title="Notifications" back actions={<button className="icon-btn" aria-label="Mark all read" onClick={() => markRead('all', me.id)}><CheckCheck size={19} /></button>} />
      {mine.length === 0 ? <Empty icon={<Bell size={20} />} title="You’re all caught up" /> : (
        <div className="list">
          {mine.map((n) => (
            <button key={n.id} className={cx('mrow', !n.read && 'unread')} onClick={() => { markRead([n.id], me.id); if (n.link) nav(n.link); }}>
              <span className={cx('dot', !n.read && 'on')} />
              <span className="row-text"><b style={{ fontWeight: n.read ? 400 : 600 }}>{n.text}</b><em>{n.kind} · {timeAgo(n.at)}</em></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
