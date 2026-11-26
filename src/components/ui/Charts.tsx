import { useRef, useState } from 'react';

/** Validated categorical series order (dataviz skill: fixed order, never cycled). */
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];

interface Tip { x: number; y: number; title: string; lines: string[] }

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      <b>{tip.title}</b>
      {tip.lines.map((l) => <span key={l} style={{ display: 'block' }}>{l}</span>)}
    </div>
  );
}

/** Donut for part-of-whole with ≤ 6 slices (smaller slices fold into "Others"). Legend always shown with values. */
export function Donut({ data, total, centerLabel, format, onSelect }: {
  data: { label: string; value: number; key?: string }[];
  total?: number;
  centerLabel: string;
  format: (n: number) => string;
  onSelect?: (key: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((s, x) => s + x.value, 0);
  const slices = rest > 0 ? [...top, { label: 'Others', value: rest }] : top;
  const sum = total ?? slices.reduce((s, x) => s + x.value, 0);
  const R = 70, r = 48, C = 90;
  let acc = 0;
  const arcs = slices.map((s, i) => {
    const a0 = (acc / sum) * Math.PI * 2;
    acc += s.value;
    const a1 = (acc / sum) * Math.PI * 2;
    const gap = slices.length > 1 ? 0.012 : 0;
    const p = (ang: number, rad: number) => [C + rad * Math.sin(ang), C - rad * Math.cos(ang)];
    const [x0, y0] = p(a0 + gap, R), [x1, y1] = p(a1 - gap, R), [x2, y2] = p(a1 - gap, r), [x3, y3] = p(a0 + gap, r);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = slices.length === 1
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} L ${C - 0.01} ${C - r} A ${r} ${r} 0 1 0 ${C} ${C - r} Z`
      : `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`;
    return { d, color: SERIES[i], s, i };
  });
  const h = hover !== null ? slices[hover] : null;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label={`${centerLabel} by category`}>
        {arcs.map((a) => (
          <path key={a.i} d={a.d} fill={a.color} stroke="var(--surface)" strokeWidth={2} opacity={hover === null || hover === a.i ? 1 : 0.35}
            style={{ cursor: onSelect && 'key' in a.s && a.s.key ? 'pointer' : 'default', transition: 'opacity .15s' }}
            onMouseEnter={() => setHover(a.i)} onMouseLeave={() => setHover(null)}
            onClick={() => { const k = (a.s as { key?: string }).key; if (k && onSelect) onSelect(k); }}>
            <title>{`${a.s.label}: ${format(a.s.value)} (${Math.round((a.s.value / sum) * 100)}%)`}</title>
          </path>
        ))}
        <text x={C} y={C - 4} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: 'var(--ink)' }}>{h ? format(h.value) : format(sum)}</text>
        <text x={C} y={C + 15} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-3)' }}>{h ? h.label.slice(0, 22) : centerLabel}</text>
      </svg>
      <ul className="donut-legend">
        {slices.map((s, i) => (
          <li key={s.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? 'on' : ''}
            onClick={() => { const k = (s as { key?: string }).key; if (k && onSelect) onSelect(k); }} style={{ cursor: onSelect && (s as { key?: string }).key ? 'pointer' : 'default' }}>
            <i style={{ background: SERIES[i] }} />
            <span className="grow ellipsis">{s.label}</span>
            <b>{format(s.value)}</b>
            <span className="muted" style={{ width: 38, textAlign: 'right' }}>{Math.round((s.value / sum) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Line/area for change over time. Single axis; crosshair + tooltip on hover. */
export function TrendChart({ data, series, format, height = 210 }: {
  data: { label: string; [k: string]: number | string }[];
  series: { key: string; label: string }[];
  format: (n: number) => string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hi, setHi] = useState<number | null>(null);
  const W = 560, H = height, pl = 56, pr = 14, pt = 14, pb = 26;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))) * 1.1;
  const x = (i: number) => pl + (i * (W - pl - pr)) / Math.max(1, data.length - 1);
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const tip = hi !== null && ref.current ? (() => {
    const rect = ref.current.getBoundingClientRect();
    return { x: (x(hi) / W) * rect.width, y: (y(Number(data[hi][series[0].key])) / H) * rect.height, title: data[hi].label as string, lines: series.map((s) => `${s.label}: ${format(Number(data[hi][s.key]))}`) };
  })() : null;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${series.map((s) => s.label).join(' and ')} over time`}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - pl) / (W - pl - pr)) * (data.length - 1));
          setHi(Math.max(0, Math.min(data.length - 1, i)));
        }}
        onMouseLeave={() => setHi(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--line-2)" strokeWidth={1} />
            <text x={pl - 8} y={y(t) + 3} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-3)' }}>{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => (i % Math.ceil(data.length / 12) === 0 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-3)' }}>{d.label}</text> : null))}
        {series.map((s, si) => {
          const pts = data.map((d, i) => `${x(i)},${y(Number(d[s.key]))}`);
          return (
            <g key={s.key}>
              {si === 0 && <path d={`M ${x(0)},${y(0)} L ${pts.join(' L ')} L ${x(data.length - 1)},${y(0)} Z`} fill={SERIES[si]} opacity={0.1} />}
              <polyline points={pts.join(' ')} fill="none" stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" strokeDasharray={si === 1 ? '5 4' : undefined} />
            </g>
          );
        })}
        {hi !== null && (
          <g>
            <line x1={x(hi)} x2={x(hi)} y1={pt} y2={H - pb} stroke="var(--ink-3)" strokeDasharray="3 3" />
            {series.map((s, si) => <circle key={s.key} cx={x(hi)} cy={y(Number(data[hi][s.key]))} r={4.5} fill={SERIES[si]} stroke="var(--surface)" strokeWidth={2} />)}
          </g>
        )}
      </svg>
      <Tooltip tip={tip} />
      {series.length > 1 && (
        <div className="legend" style={{ marginTop: 6 }}>
          {series.map((s, i) => <span key={s.key}><i style={{ background: SERIES[i] }} />{s.label}</span>)}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for comparing magnitudes across a few categories (e.g. branches). Direct value labels. */
export function HBars({ data, format, onSelect, colorIndex = 0 }: {
  data: { label: string; value: number; key?: string; sub?: string }[];
  format: (n: number) => string;
  onSelect?: (key: string) => void;
  colorIndex?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hbars">
      {data.map((d) => (
        <button key={d.label} type="button" className="hbar" onClick={() => d.key && onSelect?.(d.key)} disabled={!onSelect} title={`${d.label}: ${format(d.value)}`}>
          <span className="hbar-label"><span className="ellipsis">{d.label}</span>{d.sub && <em>{d.sub}</em>}</span>
          <span className="hbar-track"><span style={{ width: `${(d.value / max) * 100}%`, background: SERIES[colorIndex] }} /></span>
          <b className="hbar-val">{format(d.value)}</b>
        </button>
      ))}
    </div>
  );
}
