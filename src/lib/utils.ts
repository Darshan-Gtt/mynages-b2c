export const DEMO_OTP = '123456';
const DAY = 86_400_000;

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Today's date as yyyy-mm-dd (local). */
export function today(): string {
  return isoDate(new Date());
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date: string | Date, days: number): string {
  const d = typeof date === 'string' ? new Date(date + (date.length === 10 ? 'T00:00:00' : '')) : new Date(date);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function addMonths(date: string, months: number): string {
  const d = new Date(date + 'T00:00:00');
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); // month-end safe
  return isoDate(d);
}

export function daysUntil(date?: string): number {
  if (!date) return Infinity;
  const t = new Date(today() + 'T00:00:00').getTime();
  const d = new Date(date.slice(0, 10) + 'T00:00:00').getTime();
  return Math.round((d - t) / DAY);
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d}d ago`;
  return fmtDate(iso);
}

/** Display currency for money amounts; follows the family's currency setting. */
let MONEY = 'INR';
export function setMoneyCurrency(code?: string) { MONEY = code || 'INR'; }
export const moneySymbol = () => new Intl.NumberFormat('en', { style: 'currency', currency: MONEY, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? MONEY;

/** Subscription prices are set in rupees (PRD §10.2), whatever the family's display currency. */
export const planPrice = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export function inr(n?: number, opts: { compact?: boolean } = {}): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  const indian = MONEY === 'INR';
  if (opts.compact) {
    const a = Math.abs(n);
    const sym = moneySymbol();
    const t = (x: number, d: number) => x.toFixed(d).replace(/\.?0+$/, '');
    if (indian) {
      if (a >= 1e7) return `${sym}${t(n / 1e7, 2)} Cr`;
      if (a >= 1e5) return `${sym}${t(n / 1e5, 2)} L`;
    } else {
      if (a >= 1e9) return `${sym}${t(n / 1e9, 2)}B`;
      if (a >= 1e6) return `${sym}${t(n / 1e6, 2)}M`;
    }
    if (a >= 1e3) return `${sym}${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return new Intl.NumberFormat(indian ? 'en-IN' : 'en', { style: 'currency', currency: MONEY, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(n);
}

/** True inside the installed Android/iOS app (Capacitor), where demo-only controls are hidden. */
export const isNativeApp = () => !!(globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

/** “+91 98765 43210” for a member's mobile. */
export const phoneOf = (m: { mobile?: string; dial?: string }) => (m.mobile ? `+${m.dial ?? '91'} ${m.mobile}` : '');

export function num(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function plural(n: number, one: string, many = one + 's') {
  return `${num(n)} ${n === 1 ? one : many}`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cur.push(field); field = '';
      if (cur.some((x) => x.trim())) rows.push(cur);
      cur = [];
    } else field += c;
  }
  cur.push(field);
  if (cur.some((x) => x.trim())) rows.push(cur);
  const [head, ...body] = rows;
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

export function download(filename: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

export function groupBy<T>(xs: T[], key: (x: T) => string): Record<string, T[]> {
  return xs.reduce<Record<string, T[]>>((acc, x) => {
    const k = key(x);
    (acc[k] ||= []).push(x);
    return acc;
  }, {});
}

export function sum<T>(xs: T[], f: (x: T) => number): number {
  return xs.reduce((s, x) => s + (f(x) || 0), 0);
}

export function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function label(s: string): string {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Current Indian financial year label (Apr–Mar), e.g. 2026-27. */
export function fyOf(date: string): string {
  const d = new Date(date + 'T00:00:00');
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

export function fyStart(date: string): string {
  const d = new Date(date + 'T00:00:00');
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-04-01`;
}
