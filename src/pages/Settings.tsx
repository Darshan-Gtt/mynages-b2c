import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Bell, ChevronRight, CreditCard, Crown, Download, FileText, FolderTree, HelpCircle, LayoutGrid, Lock, LogOut, Palette, Plus, Shield, Smartphone, Trash2, Upload, User, Check, X, MessageSquare,
} from 'lucide-react';
import { getDb, setDb, useDb } from '../lib/store';
import { signOut, useMe } from '../lib/session';
import { entitlement, isOwner } from '../lib/access';
import { ActionError, changePlan, payNow, saveAsset, saveMember, setSubStatus, upsert } from '../lib/actions';
import { addDays, cx, download, fmtDate, fmtDateTime, inr, parseCsv, timeAgo, toCsv, today, uid } from '../lib/utils';
import { MODULE_LABELS, PLANS, planOf, COLORS } from '../data/masters';
import { TopBar } from '../components/common';
import { Badge, Empty, KV, Pills, Segmented } from '../components/ui/Misc';
import { Confirm, Sheet } from '../components/ui/Modal';
import { FormSheet } from '../components/ui/EntityForm';
import { Field, FileDrop, Input, Switch, Textarea, type PickedFile } from '../components/ui/Form';
import { useToast } from '../components/ui/Toast';
import type { Settings } from '../lib/types';

const setSettings = (p: Partial<Settings>) => setDb((d) => ({ ...d, settings: { ...d.settings, ...p } }));

const SECTIONS = [
  { id: 'profile', label: 'Profile & workspaces', icon: <User size={18} /> },
  { id: 'preferences', label: 'Preferences', icon: <Palette size={18} />, sub: 'Language, theme, date format' },
  { id: 'security', label: 'Security & devices', icon: <Shield size={18} /> },
  { id: 'notifications', label: 'Notifications & reminders', icon: <Bell size={18} /> },
  { id: 'categories', label: 'Categories & fields', icon: <FolderTree size={18} />, owner: true },
  { id: 'doc-categories', label: 'Document categories', icon: <FileText size={18} />, owner: true },
  { id: 'modules', label: 'Modules', icon: <LayoutGrid size={18} />, owner: true },
  { id: 'plan', label: 'Plan & billing', icon: <CreditCard size={18} />, owner: true },
  { id: 'import', label: 'Import & export', icon: <Upload size={18} /> },
  { id: 'privacy', label: 'Privacy & data', icon: <Lock size={18} /> },
  { id: 'help', label: 'Help & feedback', icon: <HelpCircle size={18} /> },
];

export function SettingsPage() {
  const me = useMe()!;
  const db = useDb();
  return (
    <div className="page">
      <TopBar title="Settings" back="/more" />
      <div className="list">
        {SECTIONS.map((s) => {
          const locked = s.owner && !isOwner(me);
          return (
            <Link key={s.id} to={`/more/settings/${s.id}`} className="mrow">
              <span className="icon-tile sm">{s.icon}</span>
              <span className="row-text"><b>{s.label}</b>{s.id === 'plan' ? <em>{planOf(db.subscription.planId).name} Â· {db.subscription.status.replace('_', ' ')}</em> : locked ? <em>Owner only â€” you can view</em> : s.sub ? <em>{s.sub}</em> : null}</span>
              <ChevronRight size={16} className="muted" />
            </Link>
          );
        })}
        <button className="mrow danger" onClick={() => signOut()}><span className="icon-tile sm danger"><LogOut size={18} /></span><span className="row-text"><b>Sign out</b></span></button>
      </div>
      <p className="xs muted center pad">Mynages family app Â· prototype v0.3</p>
    </div>
  );
}

export function SettingsSubPage() {
  const { section } = useParams();
  const s = SECTIONS.find((x) => x.id === section);
  const Body = { profile: Profile, preferences: Preferences, security: Security, notifications: Notifications, categories: Categories, 'doc-categories': DocCategories, modules: Modules, plan: Plan, import: ImportExport, privacy: Privacy, help: Help }[section ?? ''];
  if (!s || !Body) return <div className="page"><TopBar title="Settings" back="/more/settings" /><Empty icon={<HelpCircle size={20} />} title="Not found" /></div>;
  return <div className="page"><TopBar title={s.label} back="/more/settings" /><Body /></div>;
}

function OwnerNote() {
  const me = useMe()!;
  return isOwner(me) ? null : <div className="banner info" style={{ margin: '0 16px 12px', borderRadius: 12 }}>Only the family Owner can change these.</div>;
}

// ---------------------------------------------------------------- profile
function Profile() {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [fam, setFam] = useState(false);
  return (
    <div className="stack pad">
      <div className="card pad"><KV rows={[['Name', me.name], ['Mobile', me.mobile ? `+91 ${me.mobile}` : 'â€”'], ['Email', me.email], ['Born', me.dob && fmtDate(me.dob)], ['Role', me.role === 'owner' ? 'Owner' : me.role === 'adult' ? 'Adult member' : 'View-only']]} />
        <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setEdit(true)}>Edit profile</button></div>
      <b className="small">Workspaces</b>
      <div className="list" style={{ margin: '0 -16px' }}>
        <div className="mrow"><span className="icon-tile sm"><User size={16} /></span><span className="row-text"><b>{db.settings.familyName}</b><em>Family workspace Â· {db.members.filter((m) => m.state === 'joined' || m.state === 'self').length} joined</em></span>{isOwner(me) && <button className="btn btn-xs" onClick={() => setFam(true)}>Rename</button>}</div>
        <div className="mrow"><span className="icon-tile sm"><Lock size={16} /></span><span className="row-text"><b>My private space</b><em>{db.assets.filter((a) => a.space === 'private' && a.privateOwnerId === me.id).length} items Â· only you</em></span></div>
      </div>
      <p className="xs muted">One person belongs to one family workspace in this version (PRD Â§4.2).</p>
      {edit && <FormSheet<Record<string, unknown>> open onClose={() => setEdit(false)} title="Edit profile"
        fields={[{ key: 'name', label: 'Full name', type: 'text', required: true, full: true }, { key: 'email', label: 'Email', type: 'email' }, { key: 'dob', label: 'Date of birth', type: 'date' }, { key: 'mobile', label: 'Mobile', type: 'tel', disabled: true, hint: 'Change via OTP â€” planned' }]}
        initial={{ ...me }} onSubmit={(v) => { saveMember({ ...me, name: String(v.name), email: (v.email as string) || undefined, dob: (v.dob as string) || undefined }); toast({ type: 'success', title: 'Profile saved' }); setEdit(false); }} />}
      {fam && <FormSheet<Record<string, unknown>> open onClose={() => setFam(false)} title="Family name" fields={[{ key: 'familyName', label: 'Family name', type: 'text', required: true, full: true }]} initial={{ familyName: db.settings.familyName }} onSubmit={(v) => { setSettings({ familyName: String(v.familyName) }); toast({ type: 'success', title: 'Renamed' }); setFam(false); }} />}
    </div>
  );
}

// ---------------------------------------------------------------- preferences
function Preferences() {
  const db = useDb();
  const toast = useToast();
  const st = db.settings;
  return (
    <div className="stack pad">
      <Field label="Language" htmlFor="lang">
        <select id="lang" className="select" value={st.language} onChange={(e) => { setSettings({ language: e.target.value }); if (e.target.value !== 'English') toast({ type: 'info', title: `${e.target.value} â€” coming soon`, message: 'The prototype shows English text' }); }}>
          {['English', 'à¤®à¤°à¤¾à¤ à¥€ (Marathi)', 'à¤¹à¤¿à¤¨à¥à¤¦à¥€ (Hindi)'].map((l) => <option key={l}>{l}</option>)}
        </select>
      </Field>
      <div><span className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Theme</span><Segmented label="Theme" value={st.theme} onChange={(t) => setSettings({ theme: t })} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'auto', label: 'Follow phone' }]} /></div>
      <Field label="Date format" htmlFor="df"><select id="df" className="select" value={st.dateFormat} onChange={(e) => setSettings({ dateFormat: e.target.value })}>{['DD MMM YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].map((f) => <option key={f}>{f}</option>)}</select></Field>
      <KV rows={[['Currency', 'Indian Rupee (â‚¹)'], ['Time zone', st.timeZone]]} />
    </div>
  );
}

// ---------------------------------------------------------------- security
function Security() {
  const toast = useToast();
  const [lock, setLock] = useState(true);
  const [devices, setDevices] = useState([
    { id: 'd1', name: 'This phone Â· Chrome', where: 'Pune', at: new Date().toISOString(), current: true },
    { id: 'd2', name: 'Samsung Galaxy S23 Â· App', where: 'Pune', at: addDays(today(), -2) + 'T20:10:00', current: false },
    { id: 'd3', name: 'Windows laptop Â· Edge', where: 'Mumbai', at: addDays(today(), -9) + 'T10:00:00', current: false },
  ]);
  return (
    <div className="stack pad">
      <Switch checked={lock} onChange={(v) => { setLock(v); toast({ type: 'success', title: v ? 'App lock on' : 'App lock off' }); }} label="App lock (fingerprint / face / PIN)" />
      <p className="xs muted">Sign-in is by mobile OTP or Google â€” there is no password to manage.</p>
      <b className="small">Signed-in devices</b>
      <div className="list" style={{ margin: '0 -16px' }}>
        {devices.map((d) => (
          <div key={d.id} className="mrow"><span className="icon-tile sm"><Smartphone size={16} /></span><span className="row-text"><b>{d.name}</b><em>{d.where} Â· {d.current ? 'active now' : timeAgo(d.at)}</em></span>{d.current ? <Badge tone="success">This device</Badge> : <button className="btn btn-xs" onClick={() => { setDevices(devices.filter((x) => x.id !== d.id)); toast({ type: 'success', title: 'Signed out of that device' }); }}>Sign out</button>}</div>
        ))}
      </div>
      {devices.length > 1 && <button className="btn btn-sm" onClick={() => { setDevices(devices.filter((d) => d.current)); toast({ type: 'success', title: 'Signed out everywhere else' }); }}>Sign out of all other devices</button>}
    </div>
  );
}

// ---------------------------------------------------------------- notifications
function Notifications() {
  const db = useDb();
  const toast = useToast();
  const st = db.settings;
  const [preset, setPreset] = useState(false);
  const rows: [keyof Settings['notif'], string][] = [['reminders', 'Due-date reminders'], ['tasks', 'Tasks assigned / done'], ['invites', 'Family invites'], ['billing', 'Billing']];
  return (
    <div className="stack pad">
      <div className="ntable">
        <span /><b className="xs">Push</b><b className="xs">WhatsApp</b><b className="xs">Email</b>
        {rows.map(([k, l]) => (
          <div key={k} style={{ display: 'contents' }}>
            <span className="small">{l}</span>
            {(['push', 'whatsapp', 'email'] as const).map((ch) => (
              <input key={ch} type="checkbox" className="check-lg" aria-label={`${l} by ${ch}`} checked={st.notif[k][ch]} disabled={ch === 'email' && planOf(db.subscription.planId).id !== 'family_plus'}
                onChange={(e) => setSettings({ notif: { ...st.notif, [k]: { ...st.notif[k], [ch]: e.target.checked } } })} />
            ))}
          </div>
        ))}
      </div>
      <p className="xs muted">Email reminders are on Family Plus. WhatsApp uses approved templates.</p>
      <Switch checked={st.quietHours} onChange={(v) => setSettings({ quietHours: v })} label="Quiet hours (10 PM â€“ 7 AM) â€” hold non-urgent alerts" />
      <div className="row between"><b className="small">Reminder presets</b>{isOwner(getDb().members.find((m) => m.id === st.ownerId) ?? null) && <button className="btn btn-xs" onClick={() => setPreset(true)}><Plus size={12} /> Custom</button>}</div>
      <div className="list" style={{ margin: '0 -16px' }}>
        {db.presets.map((p) => (
          <div key={p.id} className="mrow"><Bell size={15} className="muted" /><span className="row-text"><b>{p.label}</b></span>{p.isDefault && <Badge tone="brand">Default</Badge>}{p.id.startsWith('rp_c') && <button className="icon-btn sm" aria-label="Delete preset" onClick={() => { setDb((d) => ({ ...d, presets: d.presets.filter((x) => x.id !== p.id) })); toast({ type: 'success', title: 'Preset removed' }); }}><Trash2 size={14} /></button>}</div>
        ))}
      </div>
      {preset && <FormSheet<Record<string, unknown>> open onClose={() => setPreset(false)} title="Custom reminder"
        fields={[{ key: 'n', label: 'How many', type: 'number', required: true, min: 1 }, { key: 'unit', label: 'Unit', type: 'select', required: true, options: [{ value: 'h', label: 'Hours before' }, { value: 'd', label: 'Days before, 9 AM' }] }]}
        initial={{ unit: 'd' }} onSubmit={(v) => { const n = Number(v.n); const mins = v.unit === 'h' ? n * 60 : n * 1440; if (getDb().presets.some((p) => p.minutesBefore === mins)) throw new ActionError('That preset already exists'); setDb((d) => ({ ...d, presets: [...d.presets, { id: `rp_c${uid('')}`, label: v.unit === 'h' ? `${n} hours before` : `${n} days before, 9 AM`, minutesBefore: mins }].sort((a, b) => a.minutesBefore - b.minutesBefore) })); toast({ type: 'success', title: 'Preset added' }); setPreset(false); }} />}
    </div>
  );
}

// ---------------------------------------------------------------- categories & fields
function Categories() {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [addSub, setAddSub] = useState<string | null>(null);
  const [addField, setAddField] = useState<string | null>(null);
  const owner = isOwner(me);
  return (
    <div>
      <OwnerNote />
      <div className="list">
        {db.categories.sort((a, b) => a.sort - b.sort).map((c) => (
          <div key={c.id}>
            <button className="mrow" onClick={() => setOpen(open === c.id ? null : c.id)}><span className="row-text"><b>{c.name}</b><em>{db.subcategories.filter((s) => s.categoryId === c.id).length} types Â· {db.assets.filter((a) => a.categoryId === c.id).length} assets</em></span><ChevronRight size={16} className="muted" style={{ transform: open === c.id ? 'rotate(90deg)' : undefined }} /></button>
            {open === c.id && (
              <div className="sub-list">
                {db.subcategories.filter((s) => s.categoryId === c.id).map((s) => (
                  <div key={s.id} className="card pad" style={{ marginBottom: 8 }}>
                    <div className="row between"><b className="small">{s.name}{s.custom && <Badge tone="brand">Custom</Badge>}</b><span className="xs muted">{s.valuation === 'depreciation' ? `Depreciates ${s.depRate}%/yr` : s.valuation === 'manual' ? 'Manual value' : 'No value'}</span></div>
                    <div className="chips" style={{ marginTop: 6 }}>{s.fields.map((f) => <span key={f.id} className="chip-static">{f.label}{f.required ? ' *' : ''}</span>)}</div>
                    {owner && <button className="btn btn-xs" style={{ marginTop: 8 }} onClick={() => setAddField(s.id)}><Plus size={12} /> Field</button>}
                  </div>
                ))}
                {owner && <button className="btn btn-sm" onClick={() => setAddSub(c.id)}><Plus size={14} /> Add a type to {c.name}</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      {addSub && <FormSheet<Record<string, unknown>> open onClose={() => setAddSub(null)} title="New asset type"
        fields={[{ key: 'name', label: 'Name', type: 'text', required: true, full: true, placeholder: 'e.g. Electric scooter', validate: (x) => (getDb().subcategories.some((s) => s.categoryId === addSub && s.name.toLowerCase() === String(x).trim().toLowerCase()) ? 'Already exists in this category' : undefined) }, { key: 'valuation', label: 'Value', type: 'select', required: true, options: [{ value: 'manual', label: 'I enter the value' }, { value: 'depreciation', label: 'Depreciates yearly' }, { value: 'none', label: 'Not tracked' }] }, { key: 'depRate', label: 'Depreciation % per year', type: 'number', min: 1, showIf: (v) => v.valuation === 'depreciation', required: (v) => v.valuation === 'depreciation' }]}
        initial={{ valuation: 'manual' }} onSubmit={(v) => { setDb((d) => ({ ...d, subcategories: [...d.subcategories, { id: uid('s'), categoryId: addSub, name: String(v.name).trim(), fields: [], valuation: v.valuation as 'manual', depRate: v.depRate ? Number(v.depRate) : undefined, custom: true }] })); toast({ type: 'success', title: 'Type added', message: 'Now add its fields' }); setAddSub(null); }} />}
      {addField && <FormSheet<Record<string, unknown>> open onClose={() => setAddField(null)} title="New field"
        fields={[{ key: 'label', label: 'Label', type: 'text', required: true, full: true }, { key: 'type', label: 'Type', type: 'select', required: true, options: ['text', 'number', 'currency', 'date', 'select', 'boolean', 'textarea'].map((t) => ({ value: t, label: t })) }, { key: 'options', label: 'Options (comma separated)', type: 'text', full: true, showIf: (v) => v.type === 'select', required: (v) => v.type === 'select' }, { key: 'required', label: 'Required', type: 'checkbox', hint: 'Required when adding an asset' }]}
        initial={{ type: 'text' }} onSubmit={(v) => { const key = String(v.label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); setDb((d) => ({ ...d, subcategories: d.subcategories.map((s) => (s.id === addField ? { ...s, fields: s.fields.some((f) => f.key === key) ? (() => { throw new ActionError('A field with this name exists'); })() : [...s.fields, { id: uid('f'), key, label: String(v.label), type: v.type as 'text', required: !!v.required, options: v.options ? String(v.options).split(',').map((x) => x.trim()).filter(Boolean) : undefined }] } : s)) })); toast({ type: 'success', title: 'Field added', message: 'Existing assets keep working â€” the new field is blank' }); setAddField(null); }} />}
    </div>
  );
}

function DocCategories() {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const [tab, setTab] = useState<'person' | 'asset'>('person');
  const [val, setVal] = useState('');
  const list = db.settings.docCategories[tab];
  const used = (c: string) => db.docs.filter((d) => d.category === c).length;
  return (
    <div>
      <OwnerNote />
      <Pills value={tab} onChange={setTab} items={[{ id: 'person', label: 'Person documents' }, { id: 'asset', label: 'Asset documents' }]} />
      <div className="list">
        {list.map((c) => <div key={c} className="mrow"><span className="row-text"><b>{c}</b><em>{used(c)} documents</em></span>{isOwner(me) && <button className="icon-btn sm" aria-label={`Remove ${c}`} onClick={() => { if (used(c)) { toast({ type: 'error', title: 'In use', message: `Move its ${used(c)} documents first` }); return; } setSettings({ docCategories: { ...db.settings.docCategories, [tab]: list.filter((x) => x !== c) } }); }}><Trash2 size={14} /></button>}</div>)}
      </div>
      {isOwner(me) && <form className="row pad" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); const v = val.trim(); if (!v) return; if (list.some((x) => x.toLowerCase() === v.toLowerCase())) { toast({ type: 'error', title: 'Already exists' }); return; } setSettings({ docCategories: { ...db.settings.docCategories, [tab]: [...list, v] } }); setVal(''); toast({ type: 'success', title: 'Category added' }); }}>
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="New category" aria-label="New category" /><button className="btn btn-primary btn-sm" type="submit"><Plus size={14} /> Add</button>
      </form>}
    </div>
  );
}

function Modules() {
  const db = useDb();
  const me = useMe()!;
  return (
    <div className="stack pad">
      <OwnerNote />
      {(Object.keys(MODULE_LABELS) as (keyof Settings['modules'])[]).map((m) => {
        const g = entitlement(db, `module:${m}`);
        return (
          <div key={m} className="row between card-row">
            <span className="grow"><b className="small">{MODULE_LABELS[m]}</b>{!g.ok && <span className="xs muted" style={{ display: 'block' }}>Needs {g.suggest?.name}</span>}</span>
            {g.ok ? <Switch checked={db.settings.modules[m]} disabled={!isOwner(me)} onChange={(v) => setSettings({ modules: { ...db.settings.modules, [m]: v } })} label={MODULE_LABELS[m]} /> : <Link to="/more/settings/plan" className="btn btn-xs"><Crown size={12} /> Upgrade</Link>}
          </div>
        );
      })}
      <p className="xs muted">Switching off hides the module; nothing is deleted.</p>
    </div>
  );
}

// ---------------------------------------------------------------- plan & billing (PRD Â§10)
function Plan() {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const s = db.subscription;
  const cur = planOf(s.planId);
  const [cycle, setCycle] = useState(s.cycle);
  const [cancel, setCancel] = useState(false);
  const [method, setMethod] = useState(false);
  const owner = isOwner(me);
  const used = { assets: db.assets.filter((a) => !a.archived).length, members: db.members.filter((m) => m.state === 'joined' || m.state === 'invited').length };
  const tone = s.status === 'active' ? 'success' : s.status === 'trialing' ? 'info' : s.status === 'past_due' ? 'warning' : 'danger';
  return (
    <div className="stack pad">
      <OwnerNote />
      <div className="card pad plan-card">
        <div className="row between"><b>{cur.name}</b><Badge tone={tone}>{s.status.replace('_', ' ')}</Badge></div>
        <p className="small muted">{s.cycle === 'yearly' ? `${inr(cur.yearly)}/year` : `${inr(cur.monthly)}/month`} + GST Â· {s.status === 'trialing' ? `trial ends ${fmtDate(s.trialEndsAt)}` : s.status === 'cancelled' ? `access till ${fmtDate(s.periodEnd)}` : s.status === 'expired' ? 'ended' : `renews ${fmtDate(s.periodEnd)}`}</p>
        <KV rows={[['Assets', `${used.assets} of ${cur.assets === Infinity ? 'unlimited' : cur.assets}`], ['Members', `Owner + ${used.members} of ${cur.members}`], ['Payment', s.method], ['Scheduled', s.pendingPlanId && `Switch to ${planOf(s.pendingPlanId).name} on ${fmtDate(s.periodEnd)}`]]} />
        {owner && <div className="row-wrap" style={{ gap: 6, marginTop: 10 }}>
          {(s.status === 'past_due' || s.status === 'expired' || s.status === 'trialing') && <button className="btn btn-primary btn-sm" onClick={() => { payNow(); toast({ type: 'success', title: 'Payment successful', message: 'Invoice emailed' }); }}>{s.status === 'expired' ? 'Resubscribe' : s.status === 'trialing' ? 'Pay now & end trial' : 'Retry payment'}</button>}
          <button className="btn btn-sm" onClick={() => setMethod(true)}>Update payment method</button>
          {(s.status === 'active' || s.status === 'trialing') && <button className="btn btn-sm btn-danger-outline" onClick={() => setCancel(true)}>Cancel</button>}
          {s.status === 'cancelled' && <button className="btn btn-sm btn-primary" onClick={() => { setSubStatus('active'); toast({ type: 'success', title: 'Subscription resumed' }); }}>Resume</button>}
        </div>}
      </div>
      <div className="row between"><b className="small">Plans</b><Segmented label="Billing cycle" value={cycle} onChange={setCycle} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly Â· 2 months free' }]} /></div>
      {PLANS.map((p) => {
        const isCur = p.id === s.planId && cycle === s.cycle;
        const tooSmall = p.assets < used.assets || p.members < used.members;
        return (
          <div key={p.id} className={cx('plan-pick', isCur && 'on')}>
            <div className="row between"><b>{p.name}</b><b>{inr(cycle === 'yearly' ? p.yearly : p.monthly)}<span className="xs muted">/{cycle === 'yearly' ? 'yr' : 'mo'}</span></b></div>
            <p className="xs muted">{p.members ? `Owner + ${p.members} members` : 'Just you'} Â· {p.assets === Infinity ? 'Unlimited' : p.assets} assets Â· {p.storageGb} GB Â· {p.modules.length} modules</p>
            {owner && !isCur && <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => {
              if (tooSmall) { toast({ type: 'error', title: `${p.name} is too small`, message: `You have ${used.assets} assets and ${used.members} members. Archive or remove some first â€” nothing is deleted automatically.` }); return; }
              changePlan(p.id, cycle);
              const down = PLANS.findIndex((x) => x.id === p.id) < PLANS.findIndex((x) => x.id === s.planId) && s.status === 'active';
              toast({ type: 'success', title: down ? 'Downgrade scheduled' : `Switched to ${p.name}`, message: down ? `From ${fmtDate(s.periodEnd)}` : 'Prorated invoice raised' });
            }}>{p.id === s.planId ? `Switch to ${cycle}` : PLANS.findIndex((x) => x.id === p.id) > PLANS.findIndex((x) => x.id === s.planId) ? 'Upgrade' : 'Downgrade'}</button>}
            {isCur && <span className="xs" style={{ display: 'block', marginTop: 6 }}><Check size={12} style={{ display: 'inline' }} /> Current plan</span>}
          </div>
        );
      })}
      <b className="small">Invoices</b>
      <div className="list" style={{ margin: '0 -16px' }}>
        {s.invoices.length === 0 && <p className="small muted pad-x">No invoices yet.</p>}
        {s.invoices.map((i) => (
          <div key={i.no} className="mrow"><span className="row-text"><b>{i.no}</b><em>{fmtDate(i.date)} Â· {planOf(i.planId).name} {i.cycle} Â· {i.method}</em></span><span className="small">{inr(i.amount + i.gst)}</span><Badge tone={i.status === 'paid' ? 'success' : i.status === 'failed' ? 'danger' : 'neutral'}>{i.status}</Badge>
            <button className="icon-btn sm" aria-label={`Download ${i.no}`} onClick={() => download(`${i.no}.txt`, `Mynages tax invoice ${i.no}\nDate: ${i.date}\nPlan: ${planOf(i.planId).name} (${i.cycle})\nAmount: â‚¹${i.amount}\nGST 18%: â‚¹${i.gst}\nTotal: â‚¹${i.amount + i.gst}\nStatus: ${i.status}`, 'text/plain')}><Download size={14} /></button></div>
        ))}
      </div>
      <Confirm open={cancel} title="Cancel subscription?" confirmLabel="Cancel subscription" message={`You keep full access till ${fmtDate(s.periodEnd)}. After that, everything becomes view-only â€” no data is deleted, and you can resubscribe anytime.`} onConfirm={() => { setSubStatus('cancelled'); toast({ type: 'success', title: 'Subscription cancelled', message: `Access till ${fmtDate(s.periodEnd)}` }); }} onClose={() => setCancel(false)} />
      {method && <FormSheet<Record<string, unknown>> open onClose={() => setMethod(false)} title="Payment method"
        fields={[{ key: 'kind', label: 'Pay by', type: 'select', required: true, options: [{ value: 'upi', label: 'UPI AutoPay' }, { value: 'card', label: 'Card (e-mandate)' }] }, { key: 'upi', label: 'UPI ID', type: 'text', required: (v) => v.kind === 'upi', showIf: (v) => v.kind === 'upi', placeholder: 'name@okhdfcbank', validate: (x, v) => (v.kind === 'upi' && !/^[\w.-]+@[\w]+$/.test(String(x)) ? 'Enter a valid UPI ID' : String(x) === 'fail@upi' ? 'Your bank declined the UPI AutoPay mandate (demo failure)' : undefined) }, { key: 'card', label: 'Card last 4 digits', type: 'text', required: (v) => v.kind === 'card', showIf: (v) => v.kind === 'card', validate: (x, v) => (v.kind === 'card' && !/^\d{4}$/.test(String(x)) ? 'Enter 4 digits' : undefined) }]}
        initial={{ kind: 'upi' }} onSubmit={(v) => { const m = v.kind === 'upi' ? `UPI AutoPay Â· ${v.upi}` : `Card Â· â€¢â€¢â€¢â€¢ ${v.card}`; setDb((d) => ({ ...d, subscription: { ...d.subscription, method: m } })); toast({ type: 'success', title: 'Payment method updated' }); setMethod(false); }} />}
    </div>
  );
}

// ---------------------------------------------------------------- import / export
function ImportExport() {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const [file, setFile] = useState<PickedFile>();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const subs = db.subcategories;
  const check = (r: Record<string, string>) => {
    const errs: string[] = [];
    if (!r.name?.trim()) errs.push('name missing');
    if (!subs.some((s) => s.name.toLowerCase() === r.type?.toLowerCase())) errs.push(`unknown type â€œ${r.type ?? ''}â€`);
    if (r.purchase_cost && Number.isNaN(Number(r.purchase_cost))) errs.push('cost not a number');
    if (r.purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(r.purchase_date)) errs.push('date must be YYYY-MM-DD');
    return errs;
  };
  const template = toCsv([{ name: 'Honda City', type: 'Car', owner: me.name, purchase_date: '2022-05-10', purchase_cost: '1150000', serial_no: '' }, { name: 'Bosch dishwasher', type: 'Kitchen appliance', owner: me.name, purchase_date: '2024-01-20', purchase_cost: '42000', serial_no: 'BSH-55120' }]);
  const exportAll = () => {
    const vis = db.assets.filter((a) => a.space === 'family' || a.privateOwnerId === me.id);
    download(`mynages-assets-${today()}.csv`, toCsv(vis.map((a) => ({ code: a.code, name: a.name, category: db.categories.find((c) => c.id === a.categoryId)?.name, type: subs.find((s) => s.id === a.subcategoryId)?.name, owner: db.members.find((m) => m.id === a.ownerMemberId)?.name, space: a.space, purchase_date: a.purchaseDate ?? '', purchase_cost: a.purchaseCost ?? '', archived: a.archived ? 'yes' : '' }))));
    toast({ type: 'success', title: 'Assets exported', message: `${vis.length} rows` });
  };
  return (
    <div className="stack pad">
      <b className="small">Import assets from a spreadsheet</b>
      <p className="xs muted">Columns: name, type, owner, purchase_date, purchase_cost, serial_no. Types must match the asset types in Settings â†’ Categories.</p>
      <button className="btn btn-sm" onClick={() => download('mynages-import-template.csv', template)}><Download size={14} /> Download template</button>
      <FileDrop value={file} accept=".csv" hint="CSV up to 2 MB" onChange={async (f) => { setFile(f); setRows(null); if (f?.file) { const t = await f.file.text(); const p = parseCsv(t); if (!p.length) toast({ type: 'error', title: 'No rows found' }); setRows(p); } }} />
      <button className="btn btn-sm" onClick={() => { setFile({ name: 'sample.csv', size: template.length, type: 'text/csv' }); setRows(parseCsv(template + '\n,Spaceship,,2024-13-01,abc,')); }}>Use sample file</button>
      {rows && (
        <div className="card pad">
          <b className="small">{rows.length} rows Â· {rows.filter((r) => !check(r).length).length} ready Â· {rows.filter((r) => check(r).length).length} with errors</b>
          <div className="list" style={{ margin: '8px -16px' }}>
            {rows.map((r, i) => { const e = check(r); return <div key={i} className={cx('mrow', e.length > 0 && 'danger')}>{e.length ? <X size={15} /> : <Check size={15} />}<span className="row-text"><b>{r.name || '(no name)'}</b><em>{e.length ? e.join(', ') : `${r.type} Â· ${r.purchase_cost ? inr(Number(r.purchase_cost)) : 'no cost'}`}</em></span></div>; })}
          </div>
          <button className="btn btn-primary btn-sm" disabled={!rows.some((r) => !check(r).length)} onClick={() => {
            let n = 0;
            try {
              for (const r of rows.filter((x) => !check(x).length)) {
                const sub = subs.find((s) => s.name.toLowerCase() === r.type.toLowerCase())!;
                const owner = db.members.find((m) => m.name.toLowerCase() === r.owner?.toLowerCase()) ?? me;
                saveAsset({ id: '', code: '', name: r.name.trim(), categoryId: sub.categoryId, subcategoryId: sub.id, ownerMemberId: owner.id, statusId: 'st_active', purchaseDate: r.purchase_date || undefined, purchaseCost: r.purchase_cost ? Number(r.purchase_cost) : undefined, serialNo: r.serial_no || undefined, fields: {}, tags: ['imported'], archived: false, color: COLORS[n % COLORS.length], space: 'family', createdBy: me.id, createdAt: '' }, true);
                n++;
              }
              toast({ type: 'success', title: `${n} assets imported`, message: 'Rows with errors were skipped' });
            } catch (err) { toast({ type: 'error', title: `Imported ${n}, then stopped`, message: err instanceof Error ? err.message : '' }); }
            setRows(null); setFile(undefined);
          }}>Import ready rows</button>
        </div>
      )}
      <hr className="sep" />
      <b className="small">Export</b>
      <button className="btn btn-sm" onClick={exportAll}><Download size={14} /> Assets (CSV)</button>
      <button className="btn btn-sm" onClick={() => { const d = getDb(); const mine = <T extends { space: string; privateOwnerId?: string }>(xs: T[]) => xs.filter((x) => x.space === 'family' || x.privateOwnerId === me.id); download(`mynages-backup-${today()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), family: d.settings.familyName, members: d.members.map(({ id, name, relation }) => ({ id, name, relation })), assets: mine(d.assets), coverages: mine(d.coverages), obligations: mine(d.obligations), tasks: mine(d.tasks), documents: mine(d.docs) }, null, 2), 'application/json'); toast({ type: 'success', title: 'Full export downloaded', message: 'Document files are zipped separately â€” planned' }); }}><Download size={14} /> Everything I can see (JSON)</button>
    </div>
  );
}

// ---------------------------------------------------------------- privacy & data (DPDP)
function Privacy() {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const nav = useNavigate();
  const [del, setDel] = useState(false);
  const [typed, setTyped] = useState('');
  const c = db.settings.consent;
  const log = db.events.filter((e) => e.space === 'family' || e.privateOwnerId === me.id).slice(0, 40);
  return (
    <div className="stack pad">
      <b className="small">Consent</b>
      <Switch checked={c.analytics} onChange={(v) => setSettings({ consent: { ...c, analytics: v } })} label="Anonymous usage analytics" />
      <Switch checked={c.whatsapp} onChange={(v) => setSettings({ consent: { ...c, whatsapp: v } })} label="Reminders on WhatsApp" />
      <Switch checked={c.marketing} onChange={(v) => setSettings({ consent: { ...c, marketing: v } })} label="Product news & offers" />
      <b className="small" style={{ marginTop: 8 }}>Activity log</b>
      <div className="list" style={{ margin: '0 -16px' }}>
        {log.map((e) => <div key={e.id} className="mrow"><span className="row-text"><b>{e.text}</b><em>{db.members.find((m) => m.id === e.by)?.name.split(' ')[0] ?? 'System'} Â· {fmtDateTime(e.at)}{e.assetId ? ` Â· ${db.assets.find((a) => a.id === e.assetId)?.name ?? ''}` : ''}</em></span></div>)}
      </div>
      <b className="small" style={{ marginTop: 8 }}>Your data</b>
      <button className="btn btn-sm" onClick={() => nav('/more/settings/import')}><Download size={14} /> Download my data</button>
      <button className="btn btn-sm btn-danger-outline" onClick={() => { setTyped(''); setDel(true); }}><Trash2 size={14} /> Delete my account</button>
      <Sheet open={del} onClose={() => setDel(false)} title="Delete account"
        footer={<><button className="btn" onClick={() => setDel(false)}>Keep account</button><button className="btn btn-danger" disabled={typed !== 'DELETE'} onClick={() => { setDel(false); toast({ type: 'success', title: 'Deletion scheduled', message: `Your account will be erased on ${fmtDate(addDays(today(), 30))}. Sign in before then to undo.` }); setTimeout(signOut, 600); }}>Delete</button></>}>
        <p className="small">{isOwner(me) ? 'You are the Owner. Transfer ownership to an adult member first, or the whole family workspace is deleted with your account.' : 'Your private items are deleted. Family items you added stay with the family.'}</p>
        <p className="small" style={{ margin: '10px 0' }}>We keep a 30-day grace period, then erase permanently (DPDP Act). Invoices are kept for tax law.</p>
        <Field label="Type DELETE to confirm" htmlFor="del"><Input id="del" value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- help & feedback
function Help() {
  const me = useMe()!;
  const toast = useToast();
  const [q, setQ] = useState<number | null>(0);
  const [type, setType] = useState('Idea');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const faq: [string, string][] = [
    ['Who can see my private items?', 'Only you. They never appear in family lists, search, reports or totals, and their reminders go only to you.'],
    ['What happens if my subscription ends?', 'Everything becomes view-only. You can still search and export. Nothing is deleted.'],
    ['Can my parents use Mynages without a smartphone?', 'Yes â€” add them as profiles. You can keep their documents, policies and health records.'],
    ['How do reminders work?', 'Each item has reminder presets (e.g. 30, 15 and 7 days before). Mark it paid and the next one is set automatically.'],
    ['Does Mynages connect to my bank?', 'No. Values and premiums are what you enter. There is no bank or broker connection.'],
  ];
  return (
    <div className="stack pad">
      {faq.map(([qq, a], i) => (
        <div key={qq} className="faq"><button className="row between" style={{ width: '100%', background: 'none', border: 0, padding: '10px 0', textAlign: 'left', color: 'inherit', cursor: 'pointer' }} aria-expanded={q === i} onClick={() => setQ(q === i ? null : i)}><b className="small">{qq}</b><ChevronRight size={15} style={{ transform: q === i ? 'rotate(90deg)' : undefined }} /></button>{q === i && <p className="small muted" style={{ paddingBottom: 10 }}>{a}</p>}</div>
      ))}
      <b className="small" style={{ marginTop: 8 }}><MessageSquare size={14} style={{ display: 'inline', verticalAlign: -2 }} /> Send feedback</b>
      <Segmented label="Type" value={type} onChange={setType} options={['Idea', 'Problem', 'Question'].map((t) => ({ value: t, label: t }))} />
      <Field label="Message" htmlFor="fb" error={err}><Textarea id="fb" value={text} invalid={!!err} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="Tell us what would make Mynages better" /></Field>
      <button className="btn btn-primary btn-sm" onClick={() => { if (text.trim().length < 10) { setErr('Please write at least 10 characters'); return; } upsert('feedback', { id: uid('fb'), type, subject: text.slice(0, 40), text, at: new Date().toISOString(), by: me.id }); setText(''); toast({ type: 'success', title: 'Thanks! Feedback sent', message: 'We reply within 2 working days' }); }}>Send</button>
      <div className="row" style={{ gap: 8 }}><a className="btn btn-sm" href="https://wa.me/919000000000" target="_blank" rel="noreferrer">WhatsApp support</a><a className="btn btn-sm" href="mailto:support@mynages.example">Email support</a></div>
    </div>
  );
}

