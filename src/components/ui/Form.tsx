import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, FileUp, Loader2, Paperclip, X } from 'lucide-react';
import { cx, fileSize } from '../../lib/utils';

export function Field({ label, htmlFor, required, optional, hint, error, children, className }: {
  label?: ReactNode; htmlFor?: string; required?: boolean; optional?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cx('field', className)}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req">*</span>}
          {optional && <span className="opt">(optional)</span>}
        </label>
      )}
      {children}
      {error ? <span className="field-error" role="alert"><AlertCircle size={12} /> {error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx('input', invalid && 'invalid', className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({ invalid, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select className={cx('select', invalid && 'invalid', className)} aria-invalid={invalid || undefined} {...rest}>{children}</select>;
}

export function Textarea({ invalid, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cx('textarea', invalid && 'invalid', className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Checkbox({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="switch" title={label}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function OtpInput({ value, onChange, error, autoFocus }: { value: string; onChange: (v: string) => void; error?: boolean; autoFocus?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);
  const setAt = (i: number, ch: string) => { const n = digits.slice(); n[i] = ch; onChange(n.join('')); };
  return (
    <div className={cx('otp', error && 'has-error')} role="group" aria-label="One-time password">
      {digits.map((dg, i) => (
        <input
          key={i} ref={(el) => (refs.current[i] = el)} inputMode="numeric" maxLength={1} value={dg} aria-label={`Digit ${i + 1}`}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setAt(i, v.slice(-1)); if (v) refs.current[i + 1]?.focus(); }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !digits[i] && i > 0) { refs.current[i - 1]?.focus(); setAt(i - 1, ''); } }}
          onPaste={(e) => { const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (p) { e.preventDefault(); onChange(p); refs.current[Math.min(p.length, 5)]?.focus(); } }}
        />
      ))}
    </div>
  );
}

export interface PickedFile { name: string; size: number; type: string; file?: File }

/** File picker with drag & drop. Files stay in the browser; only name/size are stored (upload is simulated). */
export function FileDrop({ value, onChange, accept, maxMb = 10, hint, error }: {
  value?: PickedFile; onChange: (f?: PickedFile) => void; accept?: string; maxMb?: number; hint?: string; error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const take = (f?: File) => {
    if (!f) return;
    if (f.size > maxMb * 1024 * 1024) { setErr(`File is larger than ${maxMb} MB`); return; }
    if (accept && !accept.split(',').some((a) => (a.trim().startsWith('.') ? f.name.toLowerCase().endsWith(a.trim()) : f.type.startsWith(a.trim().replace('*', ''))))) { setErr('This file type is not allowed'); return; }
    setErr(undefined);
    setBusy(true);
    setTimeout(() => { setBusy(false); onChange({ name: f.name, size: f.size, type: f.type, file: f }); }, 500);
  };
  if (value) {
    return (
      <div className="file-pill">
        <Paperclip size={15} />
        <span className="grow ellipsis">{value.name}</span>
        <span className="xs muted">{fileSize(value.size)}</span>
        <button type="button" className="btn btn-ghost btn-xs btn-icon" onClick={() => onChange(undefined)} aria-label="Remove file"><X size={14} /></button>
      </div>
    );
  }
  return (
    <div className="stack-sm">
      <div
        className={cx('dropzone', over && 'over')} role="button" tabIndex={0}
        onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
      >
        {busy ? <Loader2 size={20} className="spinner" /> : <FileUp size={20} />}
        <span>{busy ? 'Uploading…' : <>Drop a file here or <b>browse</b></>}</span>
        <span className="xs">{hint ?? `PDF, image or document · up to ${maxMb} MB`}</span>
      </div>
      <input ref={input} type="file" hidden accept={accept} onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      {(err || error) && <span className="field-error"><AlertCircle size={12} /> {err || error}</span>}
    </div>
  );
}

export function SubmitButton({ loading, children, className, disabled, type = 'submit', onClick }: {
  loading?: boolean; children: ReactNode; className?: string; disabled?: boolean; type?: 'submit' | 'button'; onClick?: () => void;
}) {
  return (
    <button type={type} className={cx('btn btn-primary', className)} disabled={loading || disabled} onClick={onClick}>
      {loading && <Loader2 size={15} className="spinner" />}
      {children}
    </button>
  );
}
