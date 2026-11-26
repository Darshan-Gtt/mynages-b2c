import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Smartphone, UserPlus, X } from 'lucide-react';
import { getDb, resetNewUser, useDb } from '../lib/store';
import { signIn } from '../lib/session';
import { acceptInvite, syncReminders } from '../lib/actions';
import { DEMO_OTP, sleep } from '../lib/utils';
import { Field, Input, OtpInput, SubmitButton } from '../components/ui/Form';
import { Avatar } from '../components/ui/Misc';
import { Sheet } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { MynagesMark } from '../components/Logo';

/** Welcome → mobile OTP → sign in, or detect a pending family invite, or start a new family (PRD §5, §17.3). */
export function AuthPage() {
  const db = useDb();
  const toast = useToast();
  const [step, setStep] = useState<'welcome' | 'mobile' | 'otp' | 'invite' | 'new'>('welcome');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [sso, setSso] = useState(false);
  const member = db.members.find((m) => m.mobile === mobile);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(mobile)) { setErr('Enter a valid 10-digit mobile number'); return; }
    setLoading(true); await sleep(700); setLoading(false); setErr(undefined); setStep('otp');
    toast({ type: 'info', title: `OTP sent to +91 ${mobile.slice(0, 2)}••••••${mobile.slice(-2)}`, message: `Demo OTP: ${DEMO_OTP}` });
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp !== DEMO_OTP) { setErr(otp.length < 6 ? 'Enter the 6-digit code' : 'That code is incorrect'); return; }
    setLoading(true); await sleep(600); setLoading(false);
    const m = getDb().members.find((x) => x.mobile === mobile);
    if (m && (m.state === 'self' || m.state === 'joined')) { signIn(m.id); syncReminders(m.id); toast({ type: 'success', title: `Welcome back, ${m.name.split(' ')[0]}` }); return; }
    if (m && m.state === 'invited') { setStep('invite'); return; }
    setStep('new');
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
          <div className="auth-points">
            {['Everything your family owns, in one place', 'Never miss a renewal, premium or service', 'Shared with family — with a private space for you'].map((t) => <span key={t}><Check size={15} /> {t}</span>)}
          </div>
          <div className="stack-sm auth-actions">
            <button className="btn btn-primary btn-block btn-lg" onClick={() => setStep('mobile')}>Continue with mobile <ArrowRight size={17} /></button>
            <button className="btn btn-block" onClick={() => setSso(true)}><span style={{ fontWeight: 700, color: '#4285F4' }}>G</span> Continue with Google</button>
            <p className="xs center" style={{ opacity: 0.8 }}>New here? Use any new mobile number to create your family. <br />Demo: Nitin 98765 43210 · Sneha 98765 00011 · Rohan (invited) 98500 98500</p>
          </div>
        </div>
      )}
      {step === 'mobile' && (
        <form className="auth-card stack" onSubmit={send} noValidate>
          <button type="button" className="link-btn small" onClick={() => setStep('welcome')}><ArrowLeft size={14} /> Back</button>
          <h2>Your mobile number</h2>
          <p className="small muted">We’ll send a one-time password. Your mobile is your Mynages account — family invites and WhatsApp reminders use it.</p>
          <Field error={err}><div className="input-group"><span className="addon">+91</span><Input autoFocus inputMode="numeric" maxLength={10} value={mobile} placeholder="98765 43210" onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '')); setErr(undefined); }} invalid={!!err} /></div></Field>
          <SubmitButton loading={loading} className="btn-block btn-lg">Send OTP</SubmitButton>
        </form>
      )}
      {step === 'otp' && (
        <form className="auth-card stack" onSubmit={verify} noValidate>
          <button type="button" className="link-btn small" onClick={() => { setStep('mobile'); setOtp(''); }}><ArrowLeft size={14} /> Change number</button>
          <h2>Enter OTP</h2>
          <p className="small muted">Sent to +91 {mobile}. <span className="badge tone-warning">Demo: {DEMO_OTP}</span></p>
          <Field error={err}><OtpInput value={otp} onChange={(v) => { setOtp(v); setErr(undefined); }} error={!!err} autoFocus /></Field>
          <SubmitButton loading={loading} className="btn-block btn-lg">Verify</SubmitButton>
          <button type="button" className="link-btn small" onClick={() => toast({ type: 'info', title: 'OTP re-sent', message: `Demo OTP: ${DEMO_OTP}` })}>Resend OTP</button>
        </form>
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
        <form className="auth-card stack" onSubmit={(e) => { e.preventDefault(); if (name.trim().length < 2) { setErr('Enter your name'); return; } resetNewUser(name.trim(), mobile); signIn('m_me'); }} noValidate>
          <span className="icon-tile lg"><Smartphone size={26} /></span>
          <h2>Create your account</h2>
          <p className="small muted">+91 {mobile} is verified. Tell us your name to set up your family workspace.</p>
          <Field label="Your name" error={err}><Input autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(undefined); }} placeholder="e.g. Ananya Deshpande" /></Field>
          <div className="alert alert-demo xs">Prototype: one family per browser — this replaces the sample Kulkarni family. Restore it any time from Demo controls.</div>
          <SubmitButton className="btn-block btn-lg">Continue</SubmitButton>
        </form>
      )}
      <Sheet open={sso} onClose={() => setSso(false)} title="Choose an account">
        <div className="action-list">
          {db.members.filter((m) => m.state === 'self' || m.state === 'joined').map((m) => (
            <button key={m.id} className="action-item" onClick={() => { signIn(m.id); syncReminders(m.id); setSso(false); toast({ type: 'success', title: `Signed in as ${m.name.split(' ')[0]}` }); }}>
              <Avatar name={m.name} color={m.color} size={30} /><span className="grow">{m.name}<em>{m.email ?? `+91 ${m.mobile}`}</em></span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
