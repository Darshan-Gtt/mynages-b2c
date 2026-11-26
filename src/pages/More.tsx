import { Link } from 'react-router-dom';
import { BarChart3, ChevronRight, Contact, FileText, HeartPulse, LogOut, PiggyBank, QrCode, Settings, ShieldCheck, Users, Wrench, Lock, Crown } from 'lucide-react';
import { useDb } from '../lib/store';
import { signOut, useMe } from '../lib/session';
import { entitlement } from '../lib/access';
import { planOf } from '../data/masters';
import { TopBar } from '../components/common';
import { Avatar, Badge } from '../components/ui/Misc';

export function MorePage() {
  const db = useDb();
  const me = useMe()!;
  const mods = db.settings.modules;
  const locked = (m: string) => !entitlement(db, `module:${m}`).ok;
  const items: { to: string; icon: React.ReactNode; label: string; sub: string; mod?: keyof typeof mods; tag?: string }[] = [
    { to: '/more/family', icon: <Users size={19} />, label: 'Family', sub: `${db.members.filter((m) => m.state !== 'removed').length} members · invites · roles · nominees` },
    { to: '/more/documents', icon: <FileText size={19} />, label: 'Documents', sub: 'By person, asset or category' },
    { to: '/more/insurance', icon: <ShieldCheck size={19} />, label: 'Insurance', sub: 'All policies · premium calendar', mod: 'insurance' },
    { to: '/more/warranties', icon: <ShieldCheck size={19} />, label: 'Warranties & AMC', sub: 'Every warranty and AMC', mod: 'warranties' },
    { to: '/more/maintenance', icon: <Wrench size={19} />, label: 'Maintenance', sub: 'Schedules, service log, manuals', mod: 'maintenance' },
    { to: '/more/contacts', icon: <Contact size={19} />, label: 'Contacts', sub: 'Phone sync · who to call for what' },
    { to: '/more/savings', icon: <PiggyBank size={19} />, label: 'Savings & investments', sub: 'FD, PPF, NPS, MF · maturities', mod: 'savings', tag: 'P1' },
    { to: '/more/health', icon: <HeartPulse size={19} />, label: 'Health records', sub: 'Records, vaccinations, check-ups', mod: 'health', tag: 'P1' },
    { to: '/more/reports', icon: <BarChart3 size={19} />, label: 'Reports', sub: 'Family assets, spending, coverage', mod: 'reports' },
    { to: '/more/qr', icon: <QrCode size={19} />, label: 'QR labels', sub: 'Print labels · scan to open', mod: 'qr' },
    { to: '/more/settings', icon: <Settings size={19} />, label: 'Settings', sub: 'Profile, preferences, plan, privacy' },
  ];
  return (
    <div className="page">
      <TopBar title="More" />
      <Link to="/more/settings/profile" className="profile-card">
        <Avatar name={me.name} color={me.color} size={48} />
        <span className="row-text"><b>{me.name}</b><em>{me.role === 'owner' ? 'Owner' : me.role === 'adult' ? 'Adult member' : 'View-only member'} · {db.settings.familyName}</em></span>
        <Badge tone="brand" icon={<Crown size={11} />}>{planOf(db.subscription.planId).name}</Badge>
      </Link>
      <div className="list">
        {items.filter((i) => !i.mod || mods[i.mod] !== false).map((i) => (
          <Link key={i.to} to={i.to} className="mrow">
            <span className="icon-tile sm">{i.icon}</span>
            <span className="row-text"><b>{i.label}{i.tag && <span className="badge tone-neutral" style={{ height: 18, marginLeft: 6 }}>{i.tag}</span>}</b><em>{i.sub}</em></span>
            {i.mod && locked(i.mod) ? <Lock size={15} className="muted" /> : <ChevronRight size={16} className="muted" />}
          </Link>
        ))}
        <button className="mrow danger" onClick={() => signOut()}><span className="icon-tile sm danger"><LogOut size={18} /></span><span className="row-text"><b>Sign out</b></span></button>
      </div>
      <p className="xs muted center" style={{ padding: 16 }}>Mynages · One platform. Everything managed.</p>
    </div>
  );
}

/** Wraps a module page with the plan entitlement check (PRD §10.3). */
export function ModuleGate({ mod, children }: { mod: 'insurance' | 'warranties' | 'maintenance' | 'savings' | 'health' | 'qr' | 'reports'; children: React.ReactNode }) {
  const db = useDb();
  const me = useMe()!;
  const g = entitlement(db, `module:${mod}`);
  if (g.ok && db.settings.modules[mod] !== false) return <>{children}</>;
  return (
    <div className="page">
      <TopBar title={mod === 'savings' ? 'Savings & investments' : mod[0].toUpperCase() + mod.slice(1)} back="/more" />
      <div className="empty">
        <span className="icon-tile"><Lock size={20} /></span>
        <h4>{g.ok ? 'This module is switched off' : `Available on ${g.suggest?.name}`}</h4>
        <p className="small">{g.ok ? 'Turn it on in Settings → Modules.' : g.reason}</p>
        {me.role === 'owner' ? <Link className="btn btn-primary btn-sm" to={g.ok ? '/more/settings/modules' : '/more/settings/plan'}>{g.ok ? 'Open modules' : 'See plans'}</Link> : <p className="xs muted">Ask the family Owner.</p>}
      </div>
    </div>
  );
}
