import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, Edit3, FileText, HeartPulse, Lock, Mail, Plus, RefreshCw, ShieldCheck, Trash2, UserCheck, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useDb } from '../lib/store';
import { useMe } from '../lib/session';
import { isOwner, visible } from '../lib/access';
import { acceptInvite, cancelInvite, removeRow, removeMember, setRole, upsert } from '../lib/actions';
import { age, covLabel } from '../lib/compute';
import { daysUntil, fmtDate, inr, phoneOf, timeAgo, uid } from '../lib/utils';
import { TopBar, CovBadge, AssetCard } from '../components/common';
import { Avatar, Badge, Empty, KV, Pills } from '../components/ui/Misc';
import { ActionSheet, Confirm, type SheetAction } from '../components/ui/Modal';
import { FormSheet, type FieldSpec } from '../components/ui/EntityForm';
import { useToast } from '../components/ui/Toast';
import { useEd } from '../components/editors/Editors';
import type { Member, Nominee } from '../lib/types';
import { ItemPicker, type PickItem } from '../components/ui/ItemPicker';
import { PhoneInput } from '../components/ui/PhoneInput';
import { PhoneBookButton } from '../components/ui/ContactPick';
import { COUNTRIES, countryOf, validMobile } from '../data/countries';
import { RELATIONS } from '../data/masters';

type Tab = 'members' | 'invites' | 'roles' | 'private' | 'nominees';

export function FamilyPage() {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const { open, gate } = useEd();
  const [tab, setTab] = useState<Tab>('members');
  const [sheet, setSheet] = useState<null | { title: string; actions: SheetAction[] }>(null);
  const [confirm, setConfirm] = useState<null | { title: string; message: string; run: () => void; label?: string }>(null);
  const [nom, setNom] = useState<Nominee | 'new' | null>(null);
  const owner = isOwner(me);
  const members = db.members.filter((m) => m.state !== 'removed');
  const stateBadge = (m: Member) => m.state === 'self' ? <Badge tone="brand">Owner</Badge> : m.state === 'joined' ? <Badge tone="success">{m.role === 'adult' ? 'Adult' : 'View-only'}</Badge> : m.state === 'invited' ? <Badge tone="warning">Invited</Badge> : m.state === 'declined' ? <Badge tone="danger">Declined</Badge> : <Badge>Profile</Badge>;
  const memberActions = (m: Member): SheetAction[] => [
    { label: 'Open profile', icon: <Users size={17} />, onClick: () => window.location.assign(`${import.meta.env.BASE_URL}more/family/${m.id}`) },
    { label: 'Edit details', icon: <Edit3 size={17} />, onClick: () => open({ kind: 'member', member: m }), hidden: !owner && m.id !== me.id },
    { label: m.state === 'declined' ? 'Invite again' : 'Invite to join', icon: <UserPlus size={17} />, onClick: () => gate('member') && open({ kind: 'invite', memberId: m.id }), hidden: !owner || !(m.state === 'profile' || m.state === 'declined') },
    { label: 'Resend invite', icon: <RefreshCw size={17} />, onClick: () => toast({ type: 'success', title: 'Invite re-sent on WhatsApp', message: 'Valid for 7 more days' }), hidden: !owner || m.state !== 'invited' },
    { label: 'Cancel invite', icon: <X size={17} />, onClick: () => { cancelInvite(m.id); toast({ type: 'success', title: 'Invite cancelled' }); }, hidden: !owner || m.state !== 'invited' },
    { label: m.role === 'adult' ? 'Make view-only' : 'Make adult member', icon: <UserCheck size={17} />, onClick: () => { setRole(m.id, m.role === 'adult' ? 'view_only' : 'adult'); toast({ type: 'success', title: 'Role changed' }); }, hidden: !owner || m.state !== 'joined' },
    { label: 'Remove from family', icon: <UserMinus size={17} />, danger: true, onClick: () => setConfirm({ title: `Remove ${m.name.split(' ')[0]}?`, message: 'Family items stay with the family. Their private items stay with them. They lose access to family items.', label: 'Remove', run: () => removeMember(m.id) }), hidden: !owner || m.state === 'self' },
  ];
  return (
    <div className="page">
      <TopBar title="Family" back="/more" sub={db.settings.familyName} actions={owner && <button className="icon-btn" aria-label="Add member" onClick={() => open({ kind: 'member' })}><UserPlus size={19} /></button>} />
      <Pills<Tab> value={tab} onChange={setTab} items={[{ id: 'members', label: 'Members', count: members.length }, { id: 'invites', label: 'Invitations', count: members.filter((m) => m.state === 'invited').length }, { id: 'roles', label: 'Roles' }, { id: 'private', label: 'Private space' }, { id: 'nominees', label: 'Nominees', count: db.nominees.length }]} />
      {tab === 'members' && (
        <div className="list">
          {members.map((m) => (
            <div key={m.id} className="mrow">
              <Link to={`/more/family/${m.id}`} className="row" style={{ flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none', gap: 12 }}>
                <Avatar name={m.name} color={m.color} size={40} />
                <span className="row-text"><b>{m.name}{m.id === me.id && ' (you)'}</b><em>{m.relation === 'Self' ? 'Owner' : m.relation}{m.dob ? ` · ${age(m.dob)} yrs` : ''}{m.state === 'invited' ? ` · expires ${fmtDate(m.inviteExpiresAt).slice(0, 6)}` : ''}</em></span>
              </Link>
              {stateBadge(m)}
              {(owner || m.id === me.id) && <button className="icon-btn sm" aria-label={`${m.name} actions`} onClick={() => setSheet({ title: m.name, actions: memberActions(m) })}><Edit3 size={15} /></button>}
            </div>
          ))}
          {owner && <button className="mrow" onClick={() => open({ kind: 'member' })}><span className="icon-tile sm"><Plus size={16} /></span><span className="row-text"><b>Add a family member</b><em>With a mobile to invite, or as a profile</em></span></button>}
        </div>
      )}
      {tab === 'invites' && (
        <div className="list">
          {members.filter((m) => m.state === 'invited' || m.state === 'declined').length === 0 && <Empty icon={<Mail size={20} />} title="No pending invites" />}
          {members.filter((m) => m.state === 'invited' || m.state === 'declined').map((m) => (
            <div key={m.id} className="mrow">
              <Avatar name={m.name} color={m.color} size={36} />
              <span className="row-text"><b>{m.name}</b><em>{m.state === 'invited' ? `Sent ${timeAgo(m.invitedAt!)} on ${m.inviteChannel === 'sms' ? 'SMS' : 'WhatsApp'} · ${daysUntil(m.inviteExpiresAt) < 0 ? 'expired' : `expires in ${daysUntil(m.inviteExpiresAt)} days`}` : 'Declined'}</em></span>
              {owner && m.state === 'invited' && <button className="btn btn-xs" onClick={() => { acceptInvite(m.id, true); toast({ type: 'success', title: `${m.name.split(' ')[0]} joined (simulated)` }); }}>Simulate join</button>}
            </div>
          ))}
          <p className="xs muted pad-x">New users join automatically after signing up with the invited mobile number. Existing Mynages users get Accept / Decline in the app.</p>
        </div>
      )}
      {tab === 'roles' && (
        <div className="stack pad">
          {[['Owner', 'Everything: members, roles, plan & billing, categories, delete workspace'], ['Adult member', 'Add and edit family items, assign tasks, manage own private space. No billing or member removal.'], ['View-only member', 'View family items and get reminders; manage own private space.']].map(([r, d]) => (
            <div key={r} className="card-row"><ShieldCheck size={18} /><div className="grow"><b className="small">{r}</b><span className="xs muted" style={{ display: 'block' }}>{d}</span></div><Badge>{members.filter((m) => (r === 'Owner' ? m.role === 'owner' : r === 'Adult member' ? m.role === 'adult' && m.state === 'joined' : m.role === 'view_only' && m.state === 'joined')).length}</Badge></div>
          ))}
          <p className="xs muted">Profiles (children, elderly parents without a phone) don’t sign in; you can keep their documents, policies and health records.</p>
        </div>
      )}
      {tab === 'private' && <PrivateSpaceInfo />}
      {tab === 'nominees' && (
        <div className="list">
          {db.nominees.length === 0 && <Empty icon={<UserCheck size={20} />} title="No nominees" />}
          {db.nominees.map((n) => (
            <button key={n.id} className="mrow" onClick={() => (owner ? setNom(n) : undefined)}>
              <span className="icon-tile sm"><UserCheck size={16} /></span>
              <span className="row-text"><b>{n.name}</b><em>{n.relationship} · view-only access to {n.items.length} item{n.items.length === 1 ? '' : 's'}</em></span>
              <Badge tone={n.access === 'active' ? 'success' : n.access === 'pending' ? 'warning' : 'neutral'}>{n.access}</Badge>
            </button>
          ))}
          {owner && <button className="mrow" onClick={() => setNom('new')}><span className="icon-tile sm"><Plus size={16} /></span><span className="row-text"><b>Add a nominee</b><em>Someone who can view chosen items if needed</em></span></button>}
          <div className="alert alert-info small" style={{ margin: '8px 16px' }}><b>What is a nominee?</b> Someone you trust (spouse, child, sibling) who can see chosen items if something happens to you. They <b>can sign in</b> to the Mynages app with their own mobile number (OTP) and see <b>only the items you tick — view-only</b>. They can’t edit, delete or see anything else, and they are not counted as a family member in your plan.</div>
          <p className="xs muted pad-x">Advisor access (CA, agent) with expiry — planned (P1).</p>
        </div>
      )}
      {sheet && <ActionSheet open onClose={() => setSheet(null)} title={sheet.title} actions={sheet.actions} />}
      <Confirm open={!!confirm} title={confirm?.title ?? ''} message={confirm?.message ?? ''} confirmLabel={confirm?.label} onConfirm={() => { confirm?.run(); toast({ type: 'success', title: 'Done' }); }} onClose={() => setConfirm(null)} />
      {nom && <NomineeSheet n={nom === 'new' ? undefined : nom} onClose={() => setNom(null)} />}
    </div>
  );
}

type Mob = { iso: string; num: string };
const OTHER = '__other';
function NomineeSheet({ n, onClose }: { n?: Nominee; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const catName = (id: string) => db.categories.find((c) => c.id === id)?.name ?? 'Other';
  const items: PickItem[] = [
    ...db.assets.filter((a) => a.space === 'family' && !a.archived).map((a) => ({ value: `asset:${a.id}`, label: a.name, sub: `${catName(a.categoryId)} · ${a.code}`, group: catName(a.categoryId) })),
    ...db.coverages.filter((c) => c.linkedType === 'member' && !c.supersededById).map((c) => ({ value: `coverage:${c.id}`, label: `${c.provider} ${c.policyType ?? ''}`.trim(), sub: `Policy · ${c.number}`, group: 'Policies' })),
  ];
  const rels = RELATIONS.filter((r) => r !== 'Self' && r !== 'Other');
  const isoOf = (dial?: string) => COUNTRIES.find((c) => c.dial === (dial ?? '91'))?.iso ?? 'IN';
  return (
    <FormSheet<Record<string, unknown>> open onClose={onClose} title={n ? `Nominee — ${n.name}` : 'Add a nominee'}
      fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, full: true },
        { key: 'relationship', label: 'Relationship', type: 'select', required: true, options: [...rels.map((r) => ({ value: r, label: r })), ...(n && !rels.includes(n.relationship) ? [{ value: n.relationship, label: n.relationship }] : []), { value: OTHER, label: 'Other' }] },
        { key: 'relOther', label: 'Relationship (type it)', type: 'text', required: (v) => v.relationship === OTHER, showIf: (v) => v.relationship === OTHER, placeholder: 'e.g. Nephew, Friend' },
        { key: 'mob', label: 'Mobile (they sign in with this)', type: 'custom', required: true,
          render: (val, set) => { const m = (val as Mob | undefined) ?? { iso: 'IN', num: '' }; return <PhoneInput iso={m.iso} onIso={(iso) => set({ ...m, iso })} value={m.num} onChange={(num) => set(num ? { ...m, num } : undefined)} />; },
          validate: (val) => { const m = val as Mob | undefined; return m?.num && !validMobile(countryOf(m.iso), m.num) ? `Enter a valid ${countryOf(m.iso).name} mobile number` : undefined; } },
        { key: 'items', label: 'Can view', type: 'custom', required: true, hint: 'Only these items are visible to them', render: (val, set) => <ItemPicker title="What can they view?" items={items} value={(val as string[] | undefined) ?? []} onChange={set} /> },
        ...(n ? [{ key: 'access', label: 'Access', type: 'select', required: true, options: [{ value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' }, { value: 'revoked', label: 'Revoked' }] } as FieldSpec<Record<string, unknown>>] : []),
      ]}
      initial={n ? { ...n, mob: n.mobile ? { iso: isoOf(n.dial), num: n.mobile } : undefined, items: n.items.map((i) => `${i.type}:${i.id}`) } : { items: [] }}
      before={(v, set) => <div className="row" style={{ gap: 8, marginBottom: 12 }}><PhoneBookButton label="Fill from phone book" onPick={(p) => { const d = p.phone.replace(/\D/g, ''); const c = COUNTRIES.find((x) => x.iso !== 'IN' && d.startsWith(x.dial) && d.length - x.dial.length >= x.min && d.length - x.dial.length <= x.max); set({ name: String(v.name ?? '').trim() ? v.name : p.name, mob: c ? { iso: c.iso, num: d.slice(c.dial.length) } : { iso: 'IN', num: d.slice(-10) } }); }} /></div>}
      after={() => n ? <button type="button" className="btn btn-danger-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { removeRow('nominees', n.id); toast({ type: 'success', title: 'Nominee removed' }); onClose(); }}><Trash2 size={14} /> Remove nominee</button> : null}
      onSubmit={(v) => { const mob = v.mob as Mob; upsert('nominees', { ...(n ?? { access: 'pending', createdAt: new Date().toISOString() } as Nominee), id: n?.id ?? uid('nm'), name: String(v.name), relationship: v.relationship === OTHER ? String(v.relOther).trim() : String(v.relationship), mobile: mob.num, dial: countryOf(mob.iso).dial, access: (v.access as Nominee['access']) ?? n?.access ?? 'pending', items: (v.items as string[]).map((x) => { const [type, id] = x.split(':'); return { type: type as 'asset', id }; }) }); toast({ type: 'success', title: n ? 'Nominee updated' : 'Nominee added', message: n ? undefined : `They can sign in with +${countryOf(mob.iso).dial} ${mob.num} (OTP) and see only the chosen items` }); onClose(); }} />
  );
}

function PrivateSpaceInfo() {
  const db = useDb();
  const me = useMe()!;
  const mine = db.assets.filter((a) => a.space === 'private' && a.privateOwnerId === me.id);
  return (
    <div className="stack pad">
      <div className="card-row"><Lock size={20} /><div className="grow"><b className="small">Your private space</b><span className="xs muted" style={{ display: 'block' }}>Items here are visible only to you — never in family lists, search, reports or totals. Their reminders go only to you.</span></div></div>
      <b className="small">{mine.length} private asset{mine.length === 1 ? '' : 's'}</b>
      {mine.map((a) => <AssetCard key={a.id} a={a} />)}
      <p className="xs muted">Switch spaces from the chip at the top of Home, Assets or Tasks. Move any item between spaces from its 360° page → Sharing.</p>
    </div>
  );
}

/** Person 360: everything held against a family member — documents, policies, health, tasks (PRD §9). */
export function MemberPage() {
  const { id } = useParams();
  const db = useDb();
  const me = useMe()!;
  const { open } = useEd();
  const m = db.members.find((x) => x.id === id);
  if (!m) return <div className="page"><TopBar title="Member" back="/more/family" /><Empty icon={<Users size={20} />} title="Not found" /></div>;
  const docs = db.docs.filter((d) => d.ownerType === 'member' && d.ownerId === m.id && visible(d, me));
  const pols = db.coverages.filter((c) => c.insured.some((i) => i.memberId === m.id) && !c.supersededById && visible(c, me));
  const owned = db.assets.filter((a) => a.ownerMemberId === m.id && !a.archived && visible(a, me));
  const recs = db.medical.filter((r) => r.memberId === m.id);
  const vax = db.vaccinations.filter((v) => v.memberId === m.id && v.status === 'due');
  const tasks = db.tasks.filter((t) => (t.memberId === m.id || t.assigneeId === m.id) && (t.status === 'pending' || t.status === 'in_progress') && visible(t, me));
  return (
    <div className="page">
      <TopBar title={m.name} back="/more/family" sub={`${m.relation === 'Self' ? 'Owner' : m.relation}${m.dob ? ` · ${age(m.dob)} yrs` : ''}`} actions={(isOwner(me) || m.id === me.id) && <button className="icon-btn" aria-label="Edit" onClick={() => open({ kind: 'member', member: m })}><Edit3 size={18} /></button>} />
      <div className="pad"><div className="card-row"><Avatar name={m.name} color={m.color} size={52} /><div className="grow"><KV rows={[['Mobile', m.mobile ? phoneOf(m) : 'No phone (profile)'], ['Status', m.state], ['Born', m.dob && fmtDate(m.dob)]]} /></div></div></div>
      <section className="msection"><div className="msection-head"><h3><FileText size={15} style={{ display: 'inline', verticalAlign: -2 }} /> Documents · {docs.length}</h3><button className="btn btn-xs" onClick={() => open({ kind: 'document', ownerType: 'member', ownerId: m.id })}><Plus size={12} /> Add</button></div>
        <div className="list">{docs.length ? docs.map((d) => <div key={d.id} className="mrow"><span className="row-text"><b>{d.title}</b><em>{d.category}{d.number ? ` · ${d.number}` : ''}{d.expiryDate ? ` · exp ${fmtDate(d.expiryDate)}` : ''}</em></span>{d.expiryDate && daysUntil(d.expiryDate) <= 30 && <Badge tone="warning"><Clock size={11} /> Soon</Badge>}</div>) : <p className="small muted pad-x">Aadhaar, PAN, certificates, report cards…</p>}</div>
      </section>
      <section className="msection"><div className="msection-head"><h3><ShieldCheck size={15} style={{ display: 'inline', verticalAlign: -2 }} /> Policies · {pols.length}</h3><button className="btn btn-xs" onClick={() => open({ kind: 'coverage', memberId: m.id })}><Plus size={12} /> Add</button></div>
        <div className="list">{pols.map((c) => <div key={c.id} className="mrow"><span className="row-text"><b style={{ textTransform: 'capitalize' }}>{c.provider} · {covLabel(c)}</b><em>Cover {inr(c.insured.find((i) => i.memberId === m.id)?.cover ?? c.sumInsured ?? 0, { compact: true })}{c.insured.length > 1 ? ` · with ${c.insured.length - 1} others` : ''}</em></span><CovBadge c={c} /></div>)}</div>
      </section>
      {(recs.length > 0 || vax.length > 0) && <section className="msection"><div className="msection-head"><h3><HeartPulse size={15} style={{ display: 'inline', verticalAlign: -2 }} /> Health</h3><Link to={`/more/health?member=${m.id}`} className="small">Open</Link></div>
        <div className="list">{vax.map((v) => <div key={v.id} className="mrow"><span className="row-text"><b>{v.name}</b><em>{v.itemType} due {fmtDate(v.dueDate)}</em></span><Badge tone={daysUntil(v.dueDate) < 0 ? 'danger' : 'info'}>{daysUntil(v.dueDate) < 0 ? 'Overdue' : 'Due'}</Badge></div>)}{recs.slice(0, 3).map((r) => <div key={r.id} className="mrow"><span className="row-text"><b>{r.title}</b><em>{r.type.replace('_', ' ')} · {fmtDate(r.date)}</em></span></div>)}</div></section>}
      {owned.length > 0 && <section className="msection"><div className="msection-head"><h3>Owns · {owned.length}</h3></div><div className="list">{owned.map((a) => <AssetCard key={a.id} a={a} />)}</div></section>}
      {tasks.length > 0 && <section className="msection"><div className="msection-head"><h3>Open tasks · {tasks.length}</h3></div><div className="list">{tasks.map((t) => <div key={t.id} className="mrow"><span className="row-text"><b>{t.title}</b><em>due {fmtDate(t.dueDate)}</em></span></div>)}</div></section>}
    </div>
  );
}
