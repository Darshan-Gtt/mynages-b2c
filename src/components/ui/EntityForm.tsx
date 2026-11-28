import { Fragment, useState, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Checkbox, Field, Input, Select, SubmitButton, Textarea } from './Form';
import { Sheet } from './Modal';
import { checkValue, ruleFor } from '../../lib/rules';
import { moneySymbol, sleep } from '../../lib/utils';

export type Opt = { value: string; label: string };

export interface FieldSpec<V> {
  key: keyof V & string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'time' | 'select' | 'textarea' | 'checkbox' | 'multiselect' | 'email' | 'tel' | 'color' | 'custom';
  /** For type "custom": draws the control; gets the current value and a setter. */
  render?: (value: unknown, set: (val: unknown) => void, v: V) => ReactNode;
  options?: Opt[] | ((v: V) => Opt[]);
  required?: boolean | ((v: V) => boolean);
  full?: boolean;
  hint?: string;
  placeholder?: string;
  min?: number;
  showIf?: (v: V) => boolean;
  validate?: (value: unknown, v: V) => string | undefined;
  section?: string;
  disabled?: boolean | ((v: V) => boolean);
  effect?: (value: unknown, v: V) => Partial<V>;
  emptyLabel?: string;
}

function isEmpty(v: unknown) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
}

/**
 * Schema-driven form used for every add / edit drawer, so validation and layout are identical
 * on module pages and on Asset 360°.
 */
export function EntityForm<V extends Record<string, unknown>>({
  fields, initial, onSubmit, submitLabel = 'Save', onCancel, before, after, compact,
}: {
  fields: FieldSpec<V>[];
  initial: V;
  onSubmit: (v: V) => void | Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
  before?: (v: V, set: (p: Partial<V>) => void) => ReactNode;
  after?: (v: V, set: (p: Partial<V>) => void) => ReactNode;
  compact?: boolean;
}) {
  const [v, setV] = useState<V>(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const set = (p: Partial<V>) => {
    setV((cur) => ({ ...cur, ...p }));
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(p).map((k) => [k, undefined])) }));
    setFormError(undefined);
  };
  const visible = fields.filter((f) => !f.showIf || f.showIf(v));

  const checkField = (f: FieldSpec<V>, cur: V): string | undefined => {
    const val = cur[f.key];
    const req = typeof f.required === 'function' ? f.required(cur) : f.required;
    if (req && isEmpty(val)) return `${f.label} is required`;
    if (!isEmpty(val)) {
      if ((f.type === 'number' || f.type === 'currency') && f.min !== undefined && Number(val) < f.min) return `Must be ${f.min} or more`;
      const auto = f.type === 'custom' ? undefined : checkValue(f.key.replace(/^f__/, ''), f.label, f.type, typeof val === 'string' ? val.trim() : val);
      if (auto) return auto;
    }
    return f.validate?.(val, cur);
  };
  const validate = () => {
    const e: Record<string, string | undefined> = {};
    for (const f of visible) { const m = checkField(f, v); if (m) e[f.key] = m; }
    return e;
  };
  // Show a field's problem as soon as the user leaves it, not only on Save.
  const blur = (f: FieldSpec<V>) => { const m = isEmpty(v[f.key]) ? undefined : checkField(f, v); if (m) setErrors((e) => ({ ...e, [f.key]: m })); };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    // A form opened from inside another form (portal) must not also submit the outer one.
    ev.stopPropagation();
    if (ev.target !== ev.currentTarget) return;
    const e = validate();
    setErrors(e);
    if (Object.values(e).some(Boolean)) { setFormError('Please fix the highlighted fields.'); return; }
    setLoading(true);
    try {
      await sleep(350);
      const out = { ...v };
      for (const f of visible) if (typeof out[f.key] === 'string' && f.type !== 'textarea') (out as Record<string, unknown>)[f.key] = String(out[f.key]).trim();
      for (const f of visible) if ((f.type === 'number' || f.type === 'currency') && !isEmpty(out[f.key])) (out as Record<string, unknown>)[f.key] = Number(out[f.key]);
      await onSubmit(out);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Nothing was saved — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      {before?.(v, set)}
      <div className="form-grid" style={compact ? { gap: '10px 12px' } : undefined}>
        {visible.map((f) => {
          const opts = typeof f.options === 'function' ? f.options(v) : f.options ?? [];
          const err = errors[f.key];
          const id = `ef-${f.key}`;
          const req = typeof f.required === 'function' ? f.required(v) : f.required;
          const dis = typeof f.disabled === 'function' ? f.disabled(v) : f.disabled;
          const change = (val: unknown) => set({ [f.key]: val, ...(f.effect?.(val, { ...v, [f.key]: val }) ?? {}) } as Partial<V>);
          const raw = v[f.key];
          const rule = ruleFor(f.key.replace(/^f__/, ''), f.label, f.type);
          const typed = (s: string) => change(rule.sanitize ? rule.sanitize(s) : s);
          const common = { id, invalid: !!err, disabled: dis, maxLength: rule.maxLength, inputMode: rule.inputMode, autoCapitalize: rule.autoCapitalize, onBlur: () => blur(f) };
          let control: ReactNode;
          switch (f.type) {
            case 'select':
              control = (
                <Select id={id} aria-label={f.label} value={String(raw ?? '')} invalid={!!err} disabled={dis} onBlur={() => blur(f)} onChange={(e) => change(e.target.value || undefined)}>
                  <option value="">{f.emptyLabel ?? `Select ${f.label.toLowerCase()}`}</option>
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              );
              break;
            case 'multiselect': {
              const arr = (raw as string[] | undefined) ?? [];
              control = (
                <div className="chips" role="group" aria-label={f.label}>
                  {opts.map((o) => (
                    <button key={o.value} type="button" className="chip-toggle" aria-pressed={arr.includes(o.value)} disabled={dis}
                      onClick={() => change(arr.includes(o.value) ? arr.filter((x) => x !== o.value) : [...arr, o.value])}>{o.label}</button>
                  ))}
                  {!opts.length && <span className="xs muted">No options available</span>}
                </div>
              );
              break;
            }
            case 'textarea':
              control = <Textarea {...common} inputMode={undefined} value={String(raw ?? '')} placeholder={f.placeholder} onChange={(e) => typed(e.target.value)} />;
              break;
            case 'checkbox':
              control = <Checkbox checked={!!raw} disabled={dis} onChange={(c) => change(c)}>{f.hint ?? f.label}</Checkbox>;
              break;
            case 'currency':
              control = (
                <div className="input-group">
                  <span className="addon">{moneySymbol()}</span>
                  <Input {...common} value={raw === undefined || raw === null ? '' : String(raw)} placeholder={f.placeholder ?? '0'} onChange={(e) => typed(e.target.value)} />
                </div>
              );
              break;
            case 'custom':
              control = f.render?.(raw, change, v);
              break;
            case 'color':
              control = (
                <div className="row">
                  <input type="color" value={String(raw ?? '#14B8A6')} onChange={(e) => change(e.target.value.toUpperCase())} aria-label={f.label} style={{ width: 44, height: 38, border: 0, background: 'none', padding: 0, cursor: 'pointer' }} />
                  <Input id={id} value={String(raw ?? '')} invalid={!!err} onChange={(e) => change(e.target.value)} />
                </div>
              );
              break;
            default:
              control = (
                <Input {...common} type={f.type === 'number' || f.type === 'tel' ? 'text' : f.type} min={f.type === 'date' ? '1900-01-01' : undefined} max={f.type === 'date' ? '2100-12-31' : undefined}
                  value={raw === undefined || raw === null ? '' : String(raw)} placeholder={f.placeholder} onChange={(e) => typed(e.target.value)} />
              );
          }
          return (
            <Fragment key={f.key}>
              {f.section && <div className="form-section">{f.section}</div>}
              <Field label={f.type === 'checkbox' ? undefined : f.label} htmlFor={id} required={req} error={err} hint={f.type === 'checkbox' ? undefined : f.hint} className={f.full || f.type === 'textarea' || f.type === 'multiselect' || f.type === 'custom' ? 'full' : undefined}>
                {control}
              </Field>
            </Fragment>
          );
        })}
      </div>
      {after?.(v, set)}
      {formError && (
        <div className="alert alert-danger" role="alert" style={{ marginTop: 16 }}>
          <AlertCircle size={16} /> <span>{formError}</span>
        </div>
      )}
      <div className="form-actions">
        {onCancel && <button type="button" className="btn" onClick={onCancel} disabled={loading}>Cancel</button>}
        <SubmitButton loading={loading}>{loading ? 'Saving…' : submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function FormSheet<V extends Record<string, unknown>>({
  open, onClose, title, icon, ...form
}: {
  open: boolean; onClose: () => void; title: ReactNode; icon?: ReactNode;
} & Omit<Parameters<typeof EntityForm<V>>[0], 'onCancel'>) {
  return (
    <Sheet open={open} onClose={onClose} title={title} full>
      {open && <EntityForm<V> {...form} onCancel={onClose} />}
    </Sheet>
  );
}
