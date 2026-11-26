import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ClipboardList, FlaskConical, Home, LayoutGrid, Menu as MenuIcon, Plus, RotateCcw, Smartphone, Monitor, UserPlus, CreditCard, Bell } from 'lucide-react';
import { useDb, resetNewUser, resetSample } from '../lib/store';
import { signIn, useMe } from '../lib/session';
import { acceptInvite, setSubStatus, forcePlan, syncReminders } from '../lib/actions';
import { cx, isNativeApp } from '../lib/utils';
import { useEd } from './editors/Editors';
import { useToast } from './ui/Toast';
import { Avatar } from './ui/Misc';
import { ReadOnlyBanner } from './common';

/** Bottom tab bar (PRD §7: Home, Assets, Add, Tasks & Reminders, More). */
export function TabsLayout() {
  const { open, gate } = useEd();
  const db = useDb();
  const me = useMe();
  const overdue = db.tasks.filter((t) => t.assigneeId === me?.id && (t.status === 'pending' || t.status === 'in_progress') && t.dueDate < new Date().toISOString().slice(0, 10)).length;
  return (
    <div className="tabs-layout">
      <ReadOnlyBanner />
      <div className="screen" id="screen"><Outlet /></div>
      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => cx('tab-item', isActive && 'on')}><Home size={21} /><span>Home</span></NavLink>
        <NavLink to="/assets" className={({ isActive }) => cx('tab-item', isActive && 'on')}><LayoutGrid size={21} /><span>Assets</span></NavLink>
        <button className="tab-add" aria-label="Add" onClick={() => gate('write') && open({ kind: 'add' })}><Plus size={26} /></button>
        <NavLink to="/tasks" className={({ isActive }) => cx('tab-item', isActive && 'on')}><ClipboardList size={21} /><span>Tasks</span>{overdue > 0 && <i className="tab-dot" />}</NavLink>
        <NavLink to="/more" className={({ isActive }) => cx('tab-item', isActive && 'on')}><MenuIcon size={21} /><span>More</span></NavLink>
      </nav>
    </div>
  );
}

/** On desktop the app sits in a phone frame with demo controls beside it; on phones it is full-screen. */
export function DeviceFrame({ children }: { children: React.ReactNode }) {
  const native = isNativeApp();
  const [mode, setMode] = useState<'phone' | 'full'>(() => (localStorage.getItem('mynages.b2c.frame') as 'phone' | 'full') || 'phone');
  useEffect(() => { try { localStorage.setItem('mynages.b2c.frame', mode); } catch { /* ignore */ } }, [mode]);
  return (
    <div className={cx('stage', (mode === 'full' || native) && 'stage-full')}>
      {!native && <DemoPanel mode={mode} setMode={setMode} />}
      <div className="device">
        <div className="device-notch" aria-hidden="true" />
        <div id="app-frame" className="app-frame">{children}</div>
      </div>
    </div>
  );
}

function DemoPanel({ mode, setMode }: { mode: 'phone' | 'full'; setMode: (m: 'phone' | 'full') => void }) {
  const db = useDb();
  const me = useMe();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const users = db.members.filter((m) => m.state === 'self' || m.state === 'joined');
  const invited = db.members.filter((m) => m.state === 'invited');
  return (
    <aside className="demo-panel" aria-label="Demo controls">
      <div className="row" style={{ gap: 8 }}><span className="icon-tile sm" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}><FlaskConical size={16} /></span><b>Demo controls</b></div>
      <p className="xs muted">Mynages family app prototype · OTP <b>123456</b> · data stays in this browser.</p>
      <div className="seg2">
        <button aria-pressed={mode === 'phone'} onClick={() => setMode('phone')}><Smartphone size={14} /> Phone</button>
        <button aria-pressed={mode === 'full'} onClick={() => setMode('full')}><Monitor size={14} /> Full width</button>
      </div>
      {me && (
        <>
          <span className="demo-label">Signed in as</span>
          {users.map((u) => (
            <button key={u.id} className={cx('demo-user', u.id === me.id && 'on')} onClick={() => { signIn(u.id); syncReminders(u.id); nav('/'); toast({ type: 'success', title: `Now ${u.name.split(' ')[0]}`, message: u.role === 'owner' ? 'Owner' : u.role === 'adult' ? 'Adult member' : 'View-only member' }); }}>
              <Avatar name={u.name} color={u.color} size={26} /><span className="grow"><b className="small">{u.name.split(' ')[0]}</b><em className="xs muted" style={{ display: 'block', fontStyle: 'normal' }}>{u.role === 'owner' ? 'Owner' : u.role === 'adult' ? 'Adult member' : 'View-only'} · {u.relation === 'Self' ? 'Self' : u.relation}</em></span>
            </button>
          ))}
          {invited.map((m) => (
            <button key={m.id} className="demo-user" onClick={() => { acceptInvite(m.id, true); toast({ type: 'success', title: `${m.name.split(' ')[0]} accepted the invite`, message: 'Simulated from their phone' }); }}>
              <UserPlus size={18} /><span className="grow small">Simulate {m.name.split(' ')[0]} accepting the invite</span>
            </button>
          ))}
          <span className="demo-label">Subscription</span>
          <div className="demo-grid">
            <button className="btn btn-sm" onClick={() => { forcePlan('individual'); toast({ type: 'info', title: 'Plan set to Individual', message: 'Try inviting a member or opening Savings' }); }}><CreditCard size={13} /> Individual</button>
            <button className="btn btn-sm" onClick={() => { forcePlan('family_plus'); toast({ type: 'info', title: 'Plan set to Family Plus' }); }}><CreditCard size={13} /> Family Plus</button>
            <button className="btn btn-sm" onClick={() => { setSubStatus('past_due'); toast({ type: 'info', title: 'Renewal payment failed (simulated)' }); }}>Payment fails</button>
            <button className="btn btn-sm" onClick={() => { setSubStatus('expired'); toast({ type: 'info', title: 'Subscription expired (simulated)', message: 'App becomes view-only' }); }}>Expire</button>
          </div>
          <button className="btn btn-sm" onClick={() => { if (me) { syncReminders(me.id); toast({ type: 'success', title: 'Reminder engine ran' }); } }}><Bell size={13} /> Run reminders now</button>
        </>
      )}
      <span className="demo-label">Scenarios</span>
      <ol className="guide">
        <li>Tap <b>+</b> → Asset → pick a tile → save → its 360° page opens.</li>
        <li>On Innova’s 360°: renew insurance, mark PUC paid, add a task for Sneha.</li>
        <li>Switch to <b>Sneha</b> — see her task and her private FD & bangles (Nitin can’t).</li>
        <li><b>Aai</b> is view-only: she can see and get reminders, not edit family items.</li>
        <li>Set plan to <b>Individual</b> → More → Family → invite: upgrade screen.</li>
        <li>More → Insurance → Premium calendar; Health; Savings; Reports.</li>
      </ol>
      <span className="demo-label">Data</span>
      <button className="btn btn-sm" onClick={() => { resetNewUser(); signIn('m_me'); nav('/'); toast({ type: 'success', title: 'New user', message: 'First-run onboarding' }); }}>Start as a new user (onboarding)</button>
      <button className="btn btn-sm" onClick={() => { resetSample(); signIn('m_nitin'); nav('/'); toast({ type: 'success', title: 'Sample family restored' }); }}><RotateCcw size={13} /> Reset Kulkarni family</button>
      <span className="xs muted">Route: {loc.pathname}</span>
    </aside>
  );
}
