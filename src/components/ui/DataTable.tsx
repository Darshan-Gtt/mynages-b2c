import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react';
import { cx, download, toCsv } from '../../lib/utils';
import { Empty } from './Misc';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  exportValue?: (row: T) => string | number | undefined;
  className?: string;
  hidden?: boolean;
}

export interface Filter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  test: (row: T, value: string) => boolean;
}

export function DataTable<T>({
  rows, rowKey, columns, search, filters = [], toolbar, onRowClick, selectable, bulkActions, empty, pageSize = 10,
  initialSort, exportName, initialFilters, initialQuery, compact, footer, searchPlaceholder = 'Search…',
}: {
  rows: T[];
  rowKey: (r: T) => string;
  columns: Column<T>[];
  search?: (r: T) => string;
  filters?: Filter<T>[];
  toolbar?: ReactNode;
  onRowClick?: (r: T) => void;
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  empty?: ReactNode;
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  exportName?: string;
  initialFilters?: Record<string, string>;
  initialQuery?: string;
  compact?: boolean;
  footer?: ReactNode;
  searchPlaceholder?: string;
}) {
  const [q, setQ] = useState(initialQuery ?? '');
  const [fv, setFv] = useState<Record<string, string>>(initialFilters ?? {});
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);
  const [sel, setSel] = useState<Set<string>>(new Set());

  useEffect(() => { if (initialFilters) setFv(initialFilters); }, [JSON.stringify(initialFilters)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (initialQuery !== undefined) setQ(initialQuery); }, [initialQuery]);

  const cols = columns.filter((c) => !c.hidden);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = rows.filter((r) => (!term || !search || search(r).toLowerCase().includes(term)) && filters.every((f) => !fv[f.key] || f.test(r, fv[f.key])));
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c?.sort) {
        out = [...out].sort((a, b) => {
          const va = c.sort!(a), vb = c.sort!(b);
          const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'en', { numeric: true });
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, q, fv, sort, filters, search, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);
  useEffect(() => { setPage(1); }, [q, fv]);
  const shown = filtered.slice((page - 1) * size, page * size);
  const selectedRows = rows.filter((r) => sel.has(rowKey(r)));
  const allOnPage = shown.length > 0 && shown.every((r) => sel.has(rowKey(r)));
  const activeFilters = Object.values(fv).filter(Boolean).length + (q ? 1 : 0);

  const exportCsv = () => {
    const data = filtered.map((r) => Object.fromEntries(cols.filter((c) => c.exportValue).map((c) => [typeof c.header === 'string' ? c.header : c.key, c.exportValue!(r) ?? ''])));
    download(`${exportName}.csv`, toCsv(data));
  };

  return (
    <div className="dt">
      {(search || filters.length > 0 || toolbar || exportName) && (
        <div className="dt-toolbar">
          {search && (
            <div className="dt-search">
              <Search size={15} />
              <input className="input" placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search table" />
            </div>
          )}
          {filters.map((f) => (
            <select key={f.key} className="select" value={fv[f.key] ?? ''} onChange={(e) => setFv({ ...fv, [f.key]: e.target.value })} aria-label={f.label}>
              <option value="">{f.label}: all</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setFv({}); }}><X size={14} /> Clear</button>
          )}
          <span className="grow" />
          {exportName && <button className="btn btn-sm" onClick={exportCsv} disabled={!filtered.length}><Download size={14} /> Export</button>}
          {toolbar}
        </div>
      )}
      {selectable && sel.size > 0 && bulkActions && (
        <div className="dt-bulk">
          <b>{sel.size} selected</b>
          {bulkActions(selectedRows, () => setSel(new Set()))}
          <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}>Clear selection</button>
        </div>
      )}
      <div className="dt-scroll">
        <table className={cx('table', compact && 'compact')}>
          <thead>
            <tr>
              {selectable && (
                <th className="cb">
                  <input type="checkbox" aria-label="Select all on page" checked={allOnPage} onChange={(e) => {
                    const n = new Set(sel);
                    shown.forEach((r) => (e.target.checked ? n.add(rowKey(r)) : n.delete(rowKey(r))));
                    setSel(n);
                  }} />
                </th>
              )}
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={cx(c.sort && 'sortable', c.className)}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  onClick={() => c.sort && setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' })}
                >
                  <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
                    {c.header}
                    {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const k = rowKey(r);
              return (
                <tr key={k} className={cx(onRowClick && 'clickable', sel.has(k) && 'selected')} onClick={() => onRowClick?.(r)}>
                  {selectable && (
                    <td className="cb" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label="Select row" checked={sel.has(k)} onChange={(e) => {
                        const n = new Set(sel);
                        if (e.target.checked) n.add(k); else n.delete(k);
                        setSel(n);
                      }} />
                    </td>
                  )}
                  {cols.map((c) => <td key={c.key} className={c.className}>{c.render(r)}</td>)}
                </tr>
              );
            })}
          </tbody>
          {footer}
        </table>
        {!shown.length && (
          rows.length === 0 ? (empty ?? <Empty icon={<Search size={20} />} title="Nothing here yet" />) : (
            <Empty icon={<Search size={20} />} title="No matching records">
              <button className="btn btn-sm" onClick={() => { setQ(''); setFv({}); }}>Clear search and filters</button>
            </Empty>
          )
        )}
      </div>
      {filtered.length > 0 && (
        <div className="dt-foot">
          <span>
            Showing {(page - 1) * size + 1}–{Math.min(page * size, filtered.length)} of {filtered.length}
            {filtered.length !== rows.length && ` (filtered from ${rows.length})`}
          </span>
          <div className="row">
            <select className="select" style={{ height: 30, width: 'auto', fontSize: '0.78rem' }} value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }} aria-label="Rows per page">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
            {pages > 1 && (
              <div className="dt-pages">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={14} /></button>
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
                  .map((n, i, arr) => (
                    <span key={n} style={{ display: 'contents' }}>
                      {i > 0 && n - arr[i - 1] > 1 && <span>…</span>}
                      <button aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>
                    </span>
                  ))}
                <button onClick={() => setPage(page + 1)} disabled={page === pages} aria-label="Next page"><ChevronRight size={14} /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
