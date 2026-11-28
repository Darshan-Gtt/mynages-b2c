import { useMemo, useState } from 'react';
import { Check, ChevronRight, Search } from 'lucide-react';
import { Sheet } from './Modal';
import { cx } from '../../lib/utils';

export interface PickItem { value: string; label: string; sub?: string; group: string }

/**
 * Multi-select for long lists (hundreds or thousands of assets): a one-line summary in the form, and a full sheet
 * with search, group filters, "select all shown" and paging.
 */
export function ItemPicker({ items, value, onChange, title = 'Choose items', invalid }: { items: PickItem[]; value: string[]; onChange: (v: string[]) => void; title?: string; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');
  const [onlySel, setOnlySel] = useState(false);
  const [limit, setLimit] = useState(50);
  const sel = new Set(value);
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((i) => m.set(i.group, (m.get(i.group) ?? 0) + 1));
    return [...m.entries()];
  }, [items]);
  const shown = items.filter((i) => (group === 'All' || i.group === group) && (!onlySel || sel.has(i.value)) && (!q || `${i.label} ${i.sub ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  const allShown = shown.length > 0 && shown.every((i) => sel.has(i.value));
  const toggle = (v: string) => onChange(sel.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  const chosen = items.filter((i) => sel.has(i.value));
  return (
    <>
      <button type="button" className={cx('select select-btn', invalid && 'invalid', !value.length && 'placeholder')} aria-label={title} onClick={() => { setOpen(true); setLimit(50); }}>
        <span className="ellipsis">{value.length ? `${value.length} selected · ${chosen.slice(0, 2).map((i) => i.label).join(', ')}${value.length > 2 ? '…' : ''}` : 'Tap to choose'}</span><ChevronRight size={15} aria-hidden="true" />
      </button>
      {open && (
        <Sheet open onClose={() => setOpen(false)} title={title} subtitle={`${value.length} of ${items.length} selected`} full
          footer={<button type="button" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>Done · {value.length} selected</button>}>
          <label className="search-box" style={{ marginBottom: 8 }}><Search size={16} /><input value={q} onChange={(e) => { setQ(e.target.value); setLimit(50); }} placeholder="Search by name" aria-label="Search items" /></label>
          <div className="cat-scroll" style={{ margin: '0 -16px 8px' }}>
            {[['All', items.length] as [string, number], ...groups].map(([g, n]) => <button type="button" key={g} className={cx('cat-chip', group === g && 'on')} onClick={() => { setGroup(g); setLimit(50); }}>{g} · {n}</button>)}
          </div>
          <div className="row between" style={{ marginBottom: 6 }}>
            <button type="button" className="btn btn-xs" disabled={!shown.length} onClick={() => onChange(allShown ? value.filter((v) => !shown.some((i) => i.value === v)) : [...new Set([...value, ...shown.map((i) => i.value)])])}>{allShown ? `Clear these ${shown.length}` : `Select all ${shown.length} shown`}</button>
            <button type="button" className="chip-toggle" aria-pressed={onlySel} onClick={() => setOnlySel(!onlySel)}>Selected only</button>
          </div>
          <div className="action-list">
            {shown.slice(0, limit).map((i) => (
              <label key={i.value} className="action-item">
                <input type="checkbox" checked={sel.has(i.value)} onChange={() => toggle(i.value)} />
                <span className="grow">{i.label}<em>{i.sub ?? i.group}</em></span>
                {sel.has(i.value) && <Check size={15} />}
              </label>
            ))}
            {!shown.length && <p className="xs muted">Nothing matches.</p>}
            {shown.length > limit && <button type="button" className="btn btn-sm" onClick={() => setLimit(limit + 100)}>Show more ({shown.length - limit} left)</button>}
          </div>
        </Sheet>
      )}
    </>
  );
}
