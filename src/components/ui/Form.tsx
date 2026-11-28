import { Children, isValidElement, useEffect, useRef, useState, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, FileUp, Loader2, Paperclip, X } from 'lucide-react';
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

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & { invalid?: boolean; title?: string; display?: ReactNode; onChange?: (e: { target: { value: string } }) => void };

/** Reads <option> children (also inside fragments / arrays) into a plain list. */
function readOptions(children: ReactNode): { value: string; label: string; disabled?: boolean }[] {
  const out: { value: string; label: string; disabled?: boolean }[] = [];
  const walk = (n: ReactNode) => Children.forEach(n, (c) => {
    if (!isValidElement(c)) return;
    const el = c as ReactElement<{ value?: unknown; children?: ReactNode; disabled?: boolean }>;
    if (el.type === 'option') {
      const label = Children.toArray(el.props.children).join('');
      out.push({ value: el.props.value === undefined ? label : String(el.props.value), label, disabled: el.props.disabled });
    } else walk(el.props.children);
  });
  walk(children);
  return out;
}

/**
 * Dropdown that opens as a small in-app list instead of the phone's full-screen picker, so it can always be
 * closed without choosing (tap outside, ✕ or Esc). Same props as a native <select> with <option> children.
 */
export function Select({ invalid, className, children, value, onChange, disabled, id, style, title, display, ...rest }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const opts = readOptions(children);
  const cur = opts.find((o) => o.value === String(value ?? ''));
  const label = (rest as { 'aria-label'?: string })['aria-label'] ?? title;
  const placeholder = opts.find((o) => o.value === '')?.label;
  const pick = (v: string) => { onChange?.({ target: { value: v } }); setOpen(false); setQ(''); };
  const list = q ? opts.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : opts;
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false));
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, [open]);
  return (
    <>
      <button type="button" id={id} style={style} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={label} aria-invalid={invalid || undefined}
        className={cx('select select-btn', invalid && 'invalid', !cur?.value && 'placeholder', className)} onClick={() => setOpen(true)}>
        {display ?? <span className="ellipsis">{cur?.label ?? placeholder ?? 'Select'}</span>}
      </button>
      {open && createPortal(
        <div className="picker-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="picker" role="dialog" aria-modal="true" aria-label={label ?? 'Choose'}>
            <div className="picker-head">
              <b className="ellipsis">{label ?? placeholder ?? 'Choose one'}</b>
              <button type="button" className="close-btn" aria-label="Close" onClick={() => setOpen(false)}><X size={17} /></button>
            </div>
            {opts.length > 8 && <div className="picker-search"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search options" /></div>}
            <div className="picker-list" role="listbox">
              {list.map((o) => (
                <button type="button" key={o.value} role="option" aria-selected={o.value === cur?.value} disabled={o.disabled} className={cx('picker-opt', o.value === cur?.value && 'on', o.value === '' && 'muted')} onClick={() => pick(o.value)}>
                  <span className="grow">{o.label}</span>{o.value === cur?.value && <Check size={16} />}
                </button>
              ))}
              {!list.length && <p className="xs muted" style={{ padding: 12 }}>No match</p>}
            </div>
          </div>
        </div>,
        document.getElementById('app-frame') ?? document.body,
      )}
    </>
  );
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

/** A switch with its name and a one-line explanation shown next to it. */
export function SwitchRow({ checked, onChange, label, desc, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: ReactNode; disabled?: boolean }) {
  return (
    <div className="card-row switch-row">
      <span className="grow"><b className="small">{label}</b>{desc && <span className="xs muted" style={{ display: 'block' }}>{desc}</span>}</span>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
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
