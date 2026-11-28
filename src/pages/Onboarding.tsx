import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, Loader2, PartyPopper, UserPlus } from 'lucide-react';
import { setDb, useDb } from '../lib/store';
import { signOut, useMe } from '../lib/session';
import { changePlan, inviteMember, saveMember } from '../lib/actions';
import { addDays, cx, fmtDate, planPrice, sleep, uid } from '../lib/utils';
import { checkValue } from '../lib/rules';
import { PLANS, RELATIONS, COLORS } from '../data/masters';
import { PhoneBookButton } from '../components/ui/ContactPick';
import { COUNTRIES, CURRENCIES, countryOf, validMobile } from '../data/countries';
import { Field, Input, Select } from '../components/ui/Form';
import { PhoneInput } from '../components/ui/PhoneInput';
import { Segmented } from '../components/ui/Misc';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { useEd } from '../components/editors/Editors';
import { CatIcon } from '../components/Icons';

const STEPS = ['About you', 'Family', 'Plan', 'Set-up', 'Members', 'First asset'];

/** What each plan includes, shown in full on the plan step (PRD §10.2). */
const PLAN_COPY: Record<(typeof PLANS)[number]['id'], { tagline: string; base?: string; features: string[] }> = {
  individual: {
    tagline: 'For one person managing their own things',
    features: ['Just you — no family members', 'Up to 100 assets', '5 GB document storage', '10 AI document scans a month', 'Insurance, warranties & AMC', 'Maintenance schedules & service log', 'QR labels and reports', 'Reminders on push and WhatsApp'],
  },
  family: {
    tagline: 'For families who manage things together',
    base: 'Everything in Individual, plus:',
    features: ['You + 4 family members (they never pay)', 'Up to 300 assets', '20 GB document storage', '30 AI document scans a month', 'Health records & vaccinations', 'Share links that expire in 7 days', 'A private space for every member'],
  },
  family_plus: {
    tagline: 'For larger families and their full financial picture',
    base: 'Everything in Family, plus:',
    features: ['You + 8 family members', 'Unlimited assets', '50 GB document storage', '100 AI document scans a month', 'Savings & investments tracking', 'Share links with any expiry', 'Reminders by email too'],
  },
};

/** First-run onboarding (PRD §5.3): about you → create family → plan → base package → family members → first asset. */
export function OnboardingPage() {
  const db = useDb();
  const me = useMe()!;
  const toast = useToast();
  const { open } = useEd();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    name: me.name, dob: me.dob ?? '', language: db.settings.language, currency: db.settings.currency,
    country: db.settings.country ?? 'IN', address: db.settings.address ?? '', city: db.properties.find((x) => x.id === 'p_home')?.city ?? '',
  });
  const [family, setFamily] = useState(db.settings.familyName);
  const [plan, setPlan] = useState<'individual' | 'family' | 'family_plus'>('family');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [trialNote, setTrialNote] = useState(false);
  const [copying, setCopying] = useState(0);
  const [member, setMember] = useState({ name: '', relation: 'Spouse', relOther: '', mobile: '', iso: db.settings.country ?? 'IN' });
  const [err, setErr] = useState<string>();
  const [fe, setFe] = useState<Record<string, string | undefined>>({});
  /** Validate the hand-written fields with the same rules as every other form. */
  const vet = (checks: [string, string, string, boolean?][]) => {
    const out: Record<string, string | undefined> = {};
    for (const [key, label, val, req] of checks) out[key] = req && !val.trim() ? `${label} is required` : checkValue(key, label, 'text', val.trim());
    setFe(out);
    return !Object.values(out).some(Boolean);
  };
  const people = db.members.filter((m) => m.id !== me.id);
  const homeCountry = countryOf(profile.country);

  useEffect(() => {
    if (step !== 3) return;
    let live = true;
    setCopying(0);
    (async () => { for (let i = 1; i <= 5; i++) { await sleep(420); if (!live) return; setCopying(i); } })();
    return () => { live = false; };
  }, [step]);

  const finish = () => {
    setDb((d) => ({ ...d, settings: { ...d.settings, onboarded: true } }));
    toast({ type: 'success', title: `Welcome to Mynages, ${me.name.split(' ')[0]}!` });
  };
  const go = (n: number) => { setErr(undefined); setFe({}); setStep(n); document.querySelector('.onb')?.scrollTo({ top: 0 }); };
  const back = () => { if (step === 0) signOut(); else go(step - 1); };
  const p = PLANS.find((x) => x.id === plan)!;

  const saveProfile = () => {
    if (!vet([['name', 'Full name', profile.name, true], ['address', 'Address', profile.address], ['city', 'City', profile.city]])) return false;
    if (profile.dob && checkValue('dob', 'Date of birth', 'date', profile.dob)) { setFe({ dob: checkValue('dob', 'Date of birth', 'date', profile.dob) }); return false; }
    setMember((m) => ({ ...m, iso: profile.country }));
    setDb((d) => {
      const home = profile.address.trim() || profile.city.trim()
        ? [{ id: 'p_home', name: 'Home', type: 'flat' as const, city: profile.city.trim(), address: profile.address.trim() || undefined }, ...d.properties.filter((x) => x.id !== 'p_home')]
        : d.properties.filter((x) => x.id !== 'p_home');
      return {
        ...d,
        members: d.members.map((m) => (m.id === me.id ? { ...m, name: profile.name.trim(), dob: profile.dob || undefined } : m)),
        properties: home,
        settings: { ...d.settings, language: profile.language, currency: profile.currency, country: profile.country, address: profile.address.trim() || undefined, timeZone: homeCountry.tz },
      };
    });
    return true;
  };

  const addPerson = () => {
    if (!vet([['name', 'Full name', member.name, true]])) return;
    if (member.relation === 'Other' && member.relOther.trim().length < 2) { setFe({ rel: 'Type the relation, e.g. Uncle' }); return; }
    const relation = member.relation === 'Other' ? member.relOther.trim() : member.relation;
    const mc = countryOf(member.iso);
    if (member.mobile && !validMobile(mc, member.mobile)) { setErr(`Enter a valid ${mc.name} mobile number, or leave it empty`); return; }
    const id = uid('m');
    saveMember({ id, name: member.name.trim(), relation, mobile: member.mobile || undefined, dial: member.mobile ? mc.dial : undefined, state: 'profile', color: COLORS[db.members.length % COLORS.length], createdAt: new Date().toISOString() });
    if (member.mobile) {
      try {
        inviteMember(id, 'whatsapp', ['Son', 'Daughter', 'Father', 'Mother', 'Grandparent'].includes(member.relation) ? 'view_only' : 'adult');
        toast({ type: 'success', title: `Invite sent to ${member.name.split(' ')[0]} on WhatsApp` });
      } catch (e) { toast({ type: 'error', title: e instanceof Error ? e.message : 'Could not invite' }); }
    } else toast({ type: 'success', title: 'Profile added' });
    setMember({ name: '', relation: 'Son', relOther: '', mobile: '', iso: member.iso }); setErr(undefined);
  };

  const onContinue = () => {
    if (step === 0 && !saveProfile()) return;
    if (step === 1) { if (!vet([['familyName', 'Family name', family, true]])) return; setDb((d) => ({ ...d, settings: { ...d.settings, familyName: family.trim() } })); }
    if (step === 2) {
      changePlan(plan, cycle);
      setDb((d) => ({ ...d, subscription: { ...d.subscription, status: 'trialing', trialEndsAt: addDays(new Date().toISOString().slice(0, 10), p.trialDays), method: 'Not set' } }));
      setTrialNote(true);
      return;
    }
    go(step + 1);
  };

  return (
    <div className="onb">
      <div className="onb-top">
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn sm" aria-label={step === 0 ? 'Back to sign in' : 'Back'} onClick={back}><ArrowLeft size={18} /></button>
          <span className="xs muted grow">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
        </div>
        <div className="onb-bar"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      </div>
      <div className="onb-body">
        {step === 0 && (
          <div className="stack">
            <h2>About you</h2>
            <Field label="Full name" required error={fe.name}><Input value={profile.name} maxLength={60} autoCapitalize="words" invalid={!!fe.name} onChange={(e) => { setProfile({ ...profile, name: e.target.value }); setFe({}); }} /></Field>
            <Field label="Date of birth" optional error={fe.dob}><Input type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} invalid={!!fe.dob} value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} /></Field>
            <Field label="Address" optional error={fe.address} hint="Saved as your Home, so you can say where things are kept"><Input maxLength={200} invalid={!!fe.address} value={profile.address} placeholder="Flat / house no., building, street, area" onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></Field>
            <div className="grid-2">
              <Field label="City" optional error={fe.city}><Input maxLength={50} autoCapitalize="words" invalid={!!fe.city} value={profile.city} placeholder="e.g. Pune" onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></Field>
              <Field label="Country">
                <Select aria-label="Country" value={profile.country} onChange={(e) => { const c = countryOf(e.target.value); setProfile({ ...profile, country: c.iso, currency: c.currency }); }}>
                  {COUNTRIES.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Language"><Select aria-label="Language" value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}>{['English', 'मराठी (Marathi)', 'हिन्दी (Hindi)'].map((l) => <option key={l}>{l}</option>)}</Select></Field>
              <Field label="Currency">
                <Select aria-label="Currency" value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                </Select>
              </Field>
            </div>
            <p className="xs muted">Values of your assets are shown in {profile.currency}. Time zone {homeCountry.tz.replace('_', ' ')}.</p>
          </div>
        )}
        {step === 1 && (
          <div className="stack">
            <h2>Create your family workspace</h2>
            <p className="small muted">Everything you add here is shared with family members you invite. You’ll also have a private space only you can see.</p>
            <Field label="Family name" error={fe.familyName}><Input maxLength={60} invalid={!!fe.familyName} value={family} onChange={(e) => { setFamily(e.target.value); setFe({}); }} /></Field>
            <p className="xs muted">No pending invite was found for your account. If someone invited you, ask them to resend it.</p>
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <h2>Choose your plan</h2>
            <p className="small muted">Every plan starts with a free trial — no payment needed today. Family members you invite never pay.</p>
            <Segmented label="Billing" value={cycle} onChange={setCycle} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly · 2 months free' }]} />
            <div className="plan-cards">
              {PLANS.map((x) => {
                const copy = PLAN_COPY[x.id];
                const on = plan === x.id;
                return (
                  <div key={x.id} className={cx('plan-card', on && 'on')} onClick={() => setPlan(x.id)}>
                    {x.id === 'family' && <span className="plan-tag">Most popular</span>}
                    <h3>{x.name}</h3>
                    <p className="small muted">{copy.tagline}</p>
                    <div className="plan-price">
                      <b>{planPrice(cycle === 'monthly' ? x.monthly : Math.round(x.yearly / 12))}</b>
                      <span className="small muted">/ month{cycle === 'yearly' ? `, billed ${planPrice(x.yearly)} yearly` : ''}<br />+ GST</span>
                    </div>
                    <span className="trial-pill">{x.trialDays}-day free trial</span>
                    <button type="button" className={cx('btn btn-block', on ? 'btn-primary' : '')} onClick={(e) => { e.stopPropagation(); setPlan(x.id); }}>
                      {on ? <><Check size={15} /> Selected</> : `Choose ${x.name}`}
                    </button>
                    {copy.base && <p className="xs muted plan-base">{copy.base}</p>}
                    <ul className="plan-feats">
                      {copy.features.map((f) => <li key={f}><Check size={15} /> {f}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="stack">
            <h2>Setting up {family}</h2>
            <p className="small muted">We’re adding ready-made categories so you never start from scratch.</p>
            {['9 categories with icons', '28 asset types with the right fields', 'Document categories for people and assets', 'Reminder presets (30, 15, 7, 1 day…)', 'Your private space'].map((t, i) => (
              <div key={t} className={cx('copy-row', i < copying && 'done')}>{i < copying ? <Check size={16} /> : i === copying ? <Loader2 size={16} className="spinner" /> : <span className="dot" />}<span>{t}</span></div>
            ))}
            <p className="xs muted">These categories are added to your account automatically — nothing to choose here. You can add your own later in Settings.</p>
            <div className={cx('tile3 preset-tiles', copying >= 1 && 'ready')} aria-label="Categories added for you">
              {db.categories.slice(0, 9).map((c) => (
                <div key={c.id} className="ctile preset"><span className="icon-tile"><CatIcon name={c.icon} /></span><span>{c.name}</span>{copying >= 1 && <span className="preset-check"><Check size={11} /></span>}</div>
              ))}
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="stack">
            <h2>Add your family</h2>
            <p className="small muted">Add people with a mobile to invite them on WhatsApp, or without one to keep their documents and policies (children, elderly parents).</p>
            <Field label="Name" error={fe.name}><Input maxLength={60} autoCapitalize="words" invalid={!!fe.name} value={member.name} placeholder="e.g. Rohit Deshpande" onChange={(e) => { setMember({ ...member, name: e.target.value }); setFe({}); }} /></Field>
            <div><PhoneBookButton label="Fill from phone book" onPick={(p) => { const d = p.phone.replace(/\D/g, ''); setMember({ ...member, name: member.name.trim() ? member.name : p.name, mobile: member.iso === 'IN' ? d.slice(-10) : d }); setFe({}); setErr(undefined); }} /></div>
            <Field label="Relation"><Select aria-label="Relation" value={member.relation} onChange={(e) => setMember({ ...member, relation: e.target.value })}>{RELATIONS.filter((r) => r !== 'Self').map((r) => <option key={r}>{r}</option>)}</Select></Field>
            {member.relation === 'Other' && <Field label="Relation (type it)" required error={fe.rel}><Input aria-label="Other relation" maxLength={40} autoCapitalize="words" invalid={!!fe.rel} value={member.relOther} placeholder="e.g. Uncle, Cousin" onChange={(e) => { setMember({ ...member, relOther: e.target.value }); setFe({}); }} /></Field>}
            <Field label="Mobile" optional hint="Add a mobile to invite them on WhatsApp" error={err}>
              <PhoneInput iso={member.iso} onIso={(x) => { setMember({ ...member, iso: x, mobile: '' }); setErr(undefined); }} value={member.mobile} onChange={(v) => { setMember({ ...member, mobile: v }); setErr(undefined); }} invalid={!!err} />
            </Field>
            <button className="btn" disabled={!member.name.trim()} onClick={addPerson}><UserPlus size={15} /> {member.mobile ? 'Add & invite' : 'Add profile'}</button>
            {people.length > 0 && (
              <div className="stack-sm">
                <span className="section-label">Added ({people.length})</span>
                {people.map((m) => <div key={m.id} className="mrow"><span className="avatar" style={{ background: m.color, color: '#fff', width: 30, height: 30 }}>{m.name[0]}</span><span className="row-text"><b>{m.name}</b><em>{m.relation} · {m.state === 'invited' ? 'Invite sent' : 'Profile'}</em></span></div>)}
              </div>
            )}
          </div>
        )}
        {step === 5 && (
          <div className="stack">
            <h2>Add your first asset</h2>
            <p className="small muted">Pick a category — it takes under a minute. Or photograph a policy or invoice and we’ll fill the details.</p>
            <div className="tile3">
              {db.categories.map((c) => <button key={c.id} className="ctile" onClick={() => open({ kind: 'asset', categoryId: c.id, onSaved: finish })}><span className="icon-tile"><CatIcon name={c.icon} /></span><span>{c.name}</span></button>)}
            </div>
            <button className="btn btn-block" onClick={() => open({ kind: 'snap', onSaved: finish })}><Camera size={16} /> Snap a document instead</button>
          </div>
        )}
      </div>
      <Modal open={trialNote} onClose={() => { setTrialNote(false); go(3); }} title="">
        <div className="trial-note">
          <span className="trial-burst"><PartyPopper size={30} /></span>
          <h3>Hooray! Your {p.trialDays}-day free trial has started</h3>
          <p>Enjoy everything in the <b>{p.name}</b> plan free until <b>{fmtDate(addDays(new Date().toISOString().slice(0, 10), p.trialDays))}</b>.</p>
          <p className="small muted">When the trial ends, you’ll be asked to set up your subscription ({planPrice(cycle === 'yearly' ? p.yearly : p.monthly)}/{cycle === 'yearly' ? 'year' : 'month'} + GST) to keep using it. We’ll remind you before then — nothing is charged today.</p>
          <button className="btn btn-primary btn-block btn-lg" onClick={() => { setTrialNote(false); go(3); }}>Let’s set things up <ArrowRight size={16} /></button>
        </div>
      </Modal>
      <div className="onb-foot">
        <button className="btn" onClick={back}>Back</button>
        {step === 4 && <button className="btn btn-ghost" onClick={() => go(step + 1)}>Skip</button>}
        {step === 5 ? <button className="btn btn-ghost" onClick={finish}>Skip to Home</button> : (
          <button className="btn btn-primary" disabled={step === 3 && copying < 5} onClick={onContinue}>
            {step === 2 ? 'Start free trial' : 'Continue'} <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
