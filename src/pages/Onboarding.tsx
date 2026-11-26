import { useEffect, useState } from 'react';
import { ArrowRight, Check, Home, Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { setDb, useDb } from '../lib/store';
import { useMe } from '../lib/session';
import { changePlan, inviteMember, saveMember, upsert } from '../lib/actions';
import { addDays, cx, inr, sleep, uid } from '../lib/utils';
import { PLANS, RELATIONS, COLORS } from '../data/masters';
import { Field, Input, Select } from '../components/ui/Form';
import { Segmented } from '../components/ui/Misc';
import { useToast } from '../components/ui/Toast';
import { useEd } from '../components/editors/Editors';
import { CatIcon } from '../components/Icons';
import type { Property } from '../lib/types';

const STEPS = ['Profile', 'Family', 'Plan', 'Set-up', 'Homes', 'Members', 'First asset'];

/** First-run onboarding (PRD §5.3): profile → create family → plan → base package → properties → family → first asset. */
export function OnboardingPage() {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const { open } = useEd();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({ name: me.name, dob: '', language: 'English', currency: 'INR' });
  const [family, setFamily] = useState(db.settings.familyName);
  const [plan, setPlan] = useState<'individual' | 'family' | 'family_plus'>('family');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [upi, setUpi] = useState('');
  const [copying, setCopying] = useState(0);
  const [prop, setProp] = useState({ name: 'Home', type: 'flat' as Property['type'], city: 'Pune' });
  const [member, setMember] = useState({ name: '', relation: 'Spouse', mobile: '' });
  const [err, setErr] = useState<string>();

  useEffect(() => {
    if (step !== 3) return;
    let live = true;
    (async () => { for (let i = 1; i <= 5; i++) { await sleep(420); if (!live) return; setCopying(i); } })();
    return () => { live = false; };
  }, [step]);

  const finish = () => {
    setDb((d) => ({ ...d, settings: { ...d.settings, onboarded: true } }));
    toast({ type: 'success', title: `Welcome to Mynages, ${me.name.split(' ')[0]}!` });
  };
  const next = () => { setErr(undefined); setStep(step + 1); };
  const p = PLANS.find((x) => x.id === plan)!;

  return (
    <div className="onb">
      <div className="onb-top">
        <div className="onb-bar"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        <span className="xs muted">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
      </div>
      <div className="onb-body">
        {step === 0 && (
          <div className="stack">
            <h2>About you</h2>
            <Field label="Full name" required error={err}><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="Date of birth" optional><Input type="date" value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} /></Field>
            <div className="grid-2"><Field label="Language"><Select value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}><option>English</option><option>Marathi</option><option>Hindi</option></Select></Field><Field label="Currency"><Select value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })}><option value="INR">INR ₹</option></Select></Field></div>
            <p className="xs muted">Country India · Time zone Asia/Kolkata</p>
          </div>
        )}
        {step === 1 && (
          <div className="stack">
            <h2>Create your family workspace</h2>
            <p className="small muted">Everything you add here is shared with family members you invite. You’ll also have a private space only you can see.</p>
            <Field label="Family name" error={err}><Input value={family} onChange={(e) => setFamily(e.target.value)} /></Field>
            <p className="xs muted">No pending invite was found for your number. If someone invited you, ask them to resend it.</p>
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <h2>Choose a plan</h2>
            <p className="small muted">Start with a 14-day free trial. Family members you invite never pay.</p>
            <Segmented label="Billing" value={cycle} onChange={setCycle} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly · 2 months free' }]} />
            {PLANS.map((x) => (
              <button key={x.id} className={cx('plan-pick', plan === x.id && 'on')} onClick={() => setPlan(x.id)}>
                <div className="row between"><b>{x.name}</b><span><b>{inr(cycle === 'monthly' ? x.monthly : x.yearly)}</b><span className="xs muted">/{cycle === 'monthly' ? 'mo' : 'yr'}</span></span></div>
                <span className="xs muted">{x.members ? `You + ${x.members} members` : 'Just you'} · {x.assets === Infinity ? 'Unlimited' : x.assets} assets · {x.storageGb} GB{x.id === 'family_plus' ? ' · Savings & investments' : ''}</span>
              </button>
            ))}
            <Field label="UPI autopay ID" hint="₹0 today; first charge after the trial. Cancel any time." error={err}><Input value={upi} placeholder="name@okhdfcbank" onChange={(e) => setUpi(e.target.value)} /></Field>
          </div>
        )}
        {step === 3 && (
          <div className="stack">
            <h2>Setting up {family}</h2>
            <p className="small muted">We’re adding ready-made categories for Indian families so you never start from scratch.</p>
            {['9 categories with icons', '28 asset types with the right fields', 'Document categories for people and assets', 'Reminder presets (30, 15, 7, 1 day…)', 'Your private space'].map((t, i) => (
              <div key={t} className={cx('copy-row', i < copying && 'done')}>{i < copying ? <Check size={16} /> : i === copying ? <Loader2 size={16} className="spinner" /> : <span className="dot" />}<span>{t}</span></div>
            ))}
            <div className="tile3" style={{ opacity: copying >= 1 ? 1 : 0.3, transition: 'opacity .3s' }}>
              {db.categories.slice(0, 9).map((c) => <div key={c.id} className="ctile"><span className="icon-tile"><CatIcon name={c.icon} /></span><span>{c.name}</span></div>)}
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="stack">
            <h2>Where do you live?</h2>
            <p className="small muted">Homes are used as locations — “the AC in the Pune flat”. Add more later.</p>
            {db.properties.map((x) => <div key={x.id} className="mrow"><span className="icon-tile sm"><Home size={16} /></span><span className="row-text"><b>{x.name}</b><em>{x.type} · {x.city}</em></span><button className="icon-btn sm" aria-label="Remove" onClick={() => setDb((d) => ({ ...d, properties: d.properties.filter((y) => y.id !== x.id) }))}><Trash2 size={15} /></button></div>)}
            <div className="grid-2"><Field label="Name"><Input value={prop.name} onChange={(e) => setProp({ ...prop, name: e.target.value })} /></Field><Field label="City"><Input value={prop.city} onChange={(e) => setProp({ ...prop, city: e.target.value })} /></Field></div>
            <Field label="Type"><Select value={prop.type} onChange={(e) => setProp({ ...prop, type: e.target.value as Property['type'] })}>{['flat', 'house', 'farmhouse', 'land', 'office', 'other'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
            <button className="btn" disabled={!prop.name.trim()} onClick={() => { upsert('properties', { id: uid('p'), ...prop }); setProp({ name: '', type: 'house', city: prop.city }); toast({ type: 'success', title: 'Home added' }); }}><Plus size={15} /> Add home</button>
          </div>
        )}
        {step === 5 && (
          <div className="stack">
            <h2>Add your family</h2>
            <p className="small muted">Add people with a mobile to invite them on WhatsApp, or without one to keep their documents and policies (children, elderly parents).</p>
            {db.members.filter((m) => m.id !== me.id).map((m) => <div key={m.id} className="mrow"><span className="avatar" style={{ background: m.color, color: '#fff', width: 30, height: 30 }}>{m.name[0]}</span><span className="row-text"><b>{m.name}</b><em>{m.relation} · {m.state === 'invited' ? 'Invite sent' : 'Profile'}</em></span></div>)}
            <Field label="Name"><Input value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} /></Field>
            <div className="grid-2"><Field label="Relation"><Select value={member.relation} onChange={(e) => setMember({ ...member, relation: e.target.value })}>{RELATIONS.filter((r) => r !== 'Self').map((r) => <option key={r}>{r}</option>)}</Select></Field><Field label="Mobile" optional error={err}><Input inputMode="numeric" maxLength={10} value={member.mobile} onChange={(e) => setMember({ ...member, mobile: e.target.value.replace(/\D/g, '') })} /></Field></div>
            <button className="btn" disabled={!member.name.trim()} onClick={() => {
              if (member.mobile && !/^[6-9]\d{9}$/.test(member.mobile)) { setErr('10-digit mobile'); return; }
              const id = uid('m');
              saveMember({ id, name: member.name.trim(), relation: member.relation, mobile: member.mobile || undefined, state: 'profile', color: COLORS[db.members.length % COLORS.length], createdAt: new Date().toISOString() });
              if (member.mobile) { try { inviteMember(id, 'whatsapp', ['Son', 'Daughter', 'Father', 'Mother', 'Grandparent'].includes(member.relation) ? 'view_only' : 'adult'); toast({ type: 'success', title: `Invite sent to ${member.name.split(' ')[0]} on WhatsApp` }); } catch (e) { toast({ type: 'error', title: e instanceof Error ? e.message : 'Could not invite' }); } }
              else toast({ type: 'success', title: 'Profile added' });
              setMember({ name: '', relation: 'Son', mobile: '' }); setErr(undefined);
            }}><UserPlus size={15} /> {member.mobile ? 'Add & invite' : 'Add profile'}</button>
          </div>
        )}
        {step === 6 && (
          <div className="stack">
            <h2>Add your first asset</h2>
            <p className="small muted">Pick a tile — it takes under a minute. Or photograph a policy or invoice.</p>
            <div className="tile3">
              {db.categories.map((c) => <button key={c.id} className="ctile" onClick={() => { finish(); setTimeout(() => open({ kind: 'asset' }), 50); }}><span className="icon-tile"><CatIcon name={c.icon} /></span><span>{c.name}</span></button>)}
            </div>
            <button className="btn btn-block" onClick={() => { finish(); setTimeout(() => open({ kind: 'snap' }), 50); }}>Snap a document instead</button>
          </div>
        )}
      </div>
      <div className="onb-foot">
        {step > 0 && step !== 3 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
        <span className="grow" />
        {[4, 5].includes(step) && <button className="btn btn-ghost" onClick={next}>Skip</button>}
        {step === 6 ? <button className="btn btn-ghost" onClick={finish}>Skip to Home</button> : (
          <button className="btn btn-primary" disabled={step === 3 && copying < 5} onClick={() => {
            if (step === 0) { if (profile.name.trim().length < 2) { setErr('Enter your name'); return; } setDb((d) => ({ ...d, members: d.members.map((m) => (m.id === me.id ? { ...m, name: profile.name.trim(), dob: profile.dob || undefined } : m)), settings: { ...d.settings, language: profile.language } })); }
            if (step === 1) { if (family.trim().length < 2) { setErr('Name your family'); return; } setDb((d) => ({ ...d, settings: { ...d.settings, familyName: family.trim() } })); }
            if (step === 2) { if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upi)) { setErr('Enter a valid UPI ID, e.g. name@okicici'); return; } changePlan(plan, cycle); setDb((d) => ({ ...d, subscription: { ...d.subscription, status: 'trialing', trialEndsAt: addDays(new Date().toISOString().slice(0, 10), 14), method: `UPI autopay · ${upi}` } })); toast({ type: 'success', title: `${p.name} trial started`, message: '14 days free' }); }
            next();
          }}>{step === 2 ? 'Start free trial' : 'Continue'} <ArrowRight size={15} /></button>
        )}
      </div>
    </div>
  );
}
