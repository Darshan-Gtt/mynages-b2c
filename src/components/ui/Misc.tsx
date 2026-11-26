import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cx, initials } from '../../lib/utils';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';
export const Badge = ({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) => <span className={cx('badge', `tone-${tone}`)}>{icon}{children}</span>;

export function Avatar({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, background: color ?? 'var(--brand-100)', color: color ? '#fff' : 'var(--brand-700)' }} aria-hidden="true">{initials(name)}</span>;
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return <div className="empty"><span className="icon-tile">{icon}</span><h4>{title}</h4>{children}</div>;
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

/** Scrollable pill tabs — thumb-friendly on phones. */
export function Pills<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="pills" role="tablist">
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} className={cx('pill', value === i.id && 'on')} onClick={() => onChange(i.id)}>
          {i.label}{i.count !== undefined && <span className="pill-count">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v], i) => <div key={i} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

export function Row({ icon, title, sub, right, to, onClick, tone }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; to?: string; onClick?: () => void; tone?: 'danger' | 'warning' }) {
  const body = (
    <>
      {icon}
      <span className="row-text"><b>{title}</b>{sub && <em>{sub}</em>}</span>
      {right}
      {(to || onClick) && !right && <ChevronRight size={16} className="muted" />}
    </>
  );
  if (to) return <Link to={to} className={cx('mrow', tone)}>{body}</Link>;
  if (onClick) return <button type="button" className={cx('mrow', tone)} onClick={onClick}>{body}</button>;
  return <div className={cx('mrow', tone)}>{body}</div>;
}

export function Section({ title, action, children, id }: { title: ReactNode; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="msection" id={id}>
      <div className="msection-head"><h3>{title}</h3>{action}</div>
      {children}
    </section>
  );
}

export function IconTile({ children, color, size = 40 }: { children: ReactNode; color?: string; size?: number }) {
  return <span className="icon-tile" style={{ width: size, height: size, background: color ? `color-mix(in srgb, ${color} 15%, var(--surface))` : undefined, color: color ?? undefined }}>{children}</span>;
}
