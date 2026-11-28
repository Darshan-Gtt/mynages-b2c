import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Smartphone, UserPlus, X } from 'lucide-react';
import { getDb, resetNewUser, useDb } from '../lib/store';
import { signIn } from '../lib/session';
import { acceptInvite, syncReminders } from '../lib/actions';
import { DEMO_OTP, phoneOf, sleep } from '../lib/utils';
import { checkValue } from '../lib/rules';
import { COUNTRIES, countryOf, validMobile } from '../data/countries';
import { Field, Input, OtpInput, Select, SubmitButton } from '../components/ui/Form';
import { PhoneInput } from '../components/ui/PhoneInput';
import { Avatar } from '../components/ui/Misc';
import { Sheet } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { MynagesMark } from '../components/Logo';

type Step = 'welcome' | 'mobile' | 'otp' | 'invite' | 'notfound' | 'new';
type Intent = 'signup' | 'signin';

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Welcome (create account / sign in) → mobile OTP → sign in, accept a pending family invite, or create a new family (PRD §5, §17.3). */
export function AuthPage() {
  const db = useDb();
  const toast = useToast();
  const [step, setStep] = useState<Step>('welcome');
  const [intent, setIntent] = useState<Intent>('signup');
  const [iso, setIso] = useState('IN');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [via, setVia] = useState<'mobile' | 'google'>('mobile');
  const [sso, setSso] = useState(false);
  const country = countryOf(iso);
  const phone = `+${country.dial} ${mobile}`;
  const sameNumber = (m: { mobile?: string; dial?: string }) => m.mobile === mobile && (m.dial ?? '91') === country.dial;
  const member = db.members.find(sameNumber);

  const start = (i: Intent) => { setIntent(i); setVia('mobile'); setErr(undefined); setStep('mobile'); };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validMobile(country, mobile)) { setErr(country.min === country.max ? `Enter a valid ${country.min}-digit mobile number` : `Enter a valid mobile number (${country.min}–${country.max} digits)`); return; }
    setLoading(true); await sleep(700); setLoading(false); setErr(undefined); setOtp(''); setStep('otp');
    toast({ type: 'info', title: `OTP sent to +${country.dial} ${mobile.slice(0, 2)}••••••${mobile.slice(-2)}`, message: `Use ${DEMO_OTP} to continue` });
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp !== DEMO_OTP) { setErr(otp.length < 6 ? 'Enter the 6-digit code' : 'That code is incorrect'); return; }
    setLoading(true); await sleep(600); setLoading(false);
    const m = getDb().members.find(sameNumber);
    if (m && (m.state === 'self' || m.state === 'joined')) {
      signIn(m.id); syncReminders(m.id);
      toast({ type: 'success', title: `Welcome back, ${m.name.split(' ')[0]}`, message: intent === 'signup' ? 'You already had an account with this number, so we signed you in' : undefined });
      return;
    }
    if (m && m.state === 'invited') { setStep('invite'); return; }
    setStep(intent === 'signin' ? 'notfound' : 'new');
  };
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = name.trim() ? checkValue('name', 'Your name', 'text', name.trim()) : 'Enter your name';
    if (nameErr) { setErr(nameErr); return; }
    if (via === 'google') { const e2 = email.trim() ? checkValue('email', 'Email', 'email', email.trim()) : 'Enter your email'; if (e2) { setErr(e2); return; } }
    resetNewUser(name.trim(), via === 'mobile' ? mobile : undefined, { dial: via === 'mobile' ? country.dial : undefined, email: via === 'google' ? email.trim() : undefined, country: country.iso, currency: country.currency, tz: country.tz });
    signIn('m_me');
  };

  return (
    <div className="auth">
      {step === 'welcome' && (
        <div className="auth-welcome">
          <div className="auth-hero">
            <MynagesMark size={64} light />
            <h1>Mynages</h1>
            <p>One platform. Everything managed.</p>
          </div>
          <div className="auth-intro">
            <h2>Welcome to Mynages!</h2>
            <p>Manage everything your family owns, in one place.</p>
          </div>
          <div className="stack-sm auth-actions">
            <button className="auth-choice primary" onClick={() => start('signup')}>
              <b>Create new account</b>
              <span>New to Mynages? Create your family account.</span>
              <em><Smartphone size={16} /> Continue with mobile <ArrowRight size={16} /></em>
            </button>
            <button className="auth-choice" onClick={() => start('signin')}>
              <b>Already have an account?</b>
              <em>Sign in with mobile <ArrowRight size={16} /></em>
            </button>
            <div className="auth-or"><span>OR</span></div>
            <button className="auth-choice google" onClick={() => setSso(true)}><GoogleG /> Continue with Google</button>
            <p className="xs center auth-note">New and existing users can continue with Google.</p>
          </div>
        </div>
      )}
      {step === 'mobile' && (
        <form className="auth-card stack" onSubmit={send} noValidate>
          <button type="button" className="link-btn small" onClick={() => { setErr(undefined); setStep('welcome'); }}><ArrowLeft size={14} /> Back</button>
          <h2>{intent === 'signup' ? 'Create your account' : 'Sign in'}</h2>
          <p className="small muted">{intent === 'signup' ? 'Enter your mobile number. We’ll send a one-time password to verify it. Family invites and WhatsApp reminders use this number.' : 'Enter the mobile number you signed up with. We’ll send a one-time password.'}</p>
          <Field label="Mobile number" error={err}>
            <PhoneInput autoFocus iso={iso} onIso={(x) => { setIso(x); setMobile(''); setErr(undefined); }} value={mobile} onChange={(v) => { setMobile(v); setErr(undefined); }} invalid={!!err} />
          </Field>
          <SubmitButton loading={loading} className="btn-block btn-lg">Send OTP</SubmitButton>
          <button type="button" className="link-btn small center" onClick={() => start(intent === 'signup' ? 'signin' : 'signup')}>
            {intent === 'signup' ? 'Already have an account? Sign in' : 'New to Mynages? Create an account'}
          </button>
        </form>
      )}
      {step === 'otp' && (
        <form className="auth-card stack" onSubmit={verify} noValidate>
          <button type="button" className="link-btn small" onClick={() => { setStep('mobile'); setOtp(''); setErr(undefined); }}><ArrowLeft size={14} /> Change number</button>
          <h2>Enter OTP</h2>
          <p className="small muted">We sent a 6-digit code to {phone}.</p>
          <Field error={err}><OtpInput value={otp} onChange={(v) => { setOtp(v); setErr(undefined); }} error={!!err} autoFocus /></Field>
          <SubmitButton loading={loading} className="btn-block btn-lg">Verify</SubmitButton>
          <button type="button" className="link-btn small" onClick={() => toast({ type: 'info', title: 'OTP re-sent', message: `Use ${DEMO_OTP} to continue` })}>Resend OTP</button>
        </form>
      )}
      {step === 'notfound' && (
        <div className="auth-card stack">
          <span className="icon-tile lg"><Smartphone size={26} /></span>
          <h2>No account for this number</h2>
          <p className="small muted">{phone} isn’t registered with Mynages yet. Create a new family account with it, or try a different number.</p>
          <button className="btn btn-primary btn-block btn-lg" onClick={() => { setIntent('signup'); setStep('new'); }}>Create new account</button>
          <button className="btn btn-block" onClick={() => { setMobile(''); setStep('mobile'); }}>Use a different number</button>
        </div>
      )}
      {step === 'invite' && member && (
        <div className="auth-card stack">
          <span className="icon-tile lg"><UserPlus size={26} /></span>
          <h2>{db.members.find((m) => m.id === db.settings.ownerId)?.name.split(' ')[0]} invited you to join {db.settings.familyName}</h2>
          <p className="small muted">You’re added as <b>{member.relation}</b> · {member.role === 'adult' ? 'adult member (can add and edit family items)' : 'view-only member'}. You’ll see everything the family shares and get its reminders. You also get a private space only you can see. Joined members never pay.</p>
          <button className="btn btn-primary btn-block btn-lg" onClick={() => { acceptInvite(member.id, true); signIn(member.id); syncReminders(member.id); toast({ type: 'success', title: `Welcome to ${db.settings.familyName}` }); }}><Check size={16} /> Accept & join</button>
          <button className="btn btn-block" onClick={() => { acceptInvite(member.id, false); toast({ type: 'info', title: 'Invite declined' }); setStep('new'); }}><X size={16} /> Decline — create my own family</button>
        </div>
      )}
      {step === 'new' && (
        <form className="auth-card stack" onSubmit={create} noValidate>
          <button type="button" className="link-btn small" onClick={() => { setErr(undefined); setStep(via === 'google' ? 'welcome' : 'mobile'); }}><ArrowLeft size={14} /> Back</button>
          <span className="icon-tile lg"><UserPlus size={26} /></span>
          <h2>Create your account</h2>
          <p className="small muted">{via === 'mobile' ? <>{phone} is verified. </> : null}Tell us your name to set up your family workspace.</p>
          <Field label="Your name" error={via === 'mobile' || !name.trim() || checkValue('name', 'Your name', 'text', name.trim()) ? err : undefined}><Input autoFocus maxLength={60} autoCapitalize="words" value={name} onChange={(e) => { setName(e.target.value); setErr(undefined); }} placeholder="e.g. Ananya Deshpande" /></Field>
          {via === 'google' && <Field label="Google account email" error={name.trim() && !checkValue('name', 'Your name', 'text', name.trim()) ? err : undefined}><Input type="email" inputMode="email" maxLength={80} autoCapitalize="off" value={email} onChange={(e) => { setEmail(e.target.value); setErr(undefined); }} placeholder="you@gmail.com" /></Field>}
          {via === 'google' && (
            <Field label="Country">
              <Select aria-label="Country" value={iso} onChange={(e) => setIso(e.target.value)}>{COUNTRIES.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}</Select>
            </Field>
          )}
          <SubmitButton className="btn-block btn-lg">Continue</SubmitButton>
        </form>
      )}
      <Sheet open={sso} onClose={() => setSso(false)} title="Choose an account" subtitle="to continue to Mynages">
        <div className="action-list">
          {db.members.filter((m) => m.state === 'self' || m.state === 'joined').map((m) => (
            <button key={m.id} className="action-item" onClick={() => { signIn(m.id); syncReminders(m.id); setSso(false); toast({ type: 'success', title: `Signed in as ${m.name.split(' ')[0]}` }); }}>
              <Avatar name={m.name} color={m.color} size={30} /><span className="grow">{m.name}<em>{m.email ?? phoneOf(m)}</em></span>
            </button>
          ))}
          <button className="action-item" onClick={() => { setSso(false); setVia('google'); setIntent('signup'); setName(''); setEmail(''); setErr(undefined); setStep('new'); }}>
            <span className="icon-tile sm"><UserPlus size={16} /></span><span className="grow">Use another account<em>New to Mynages? We’ll create your family account</em></span>
          </button>
        </div>
      </Sheet>
    </div>
  );
}
