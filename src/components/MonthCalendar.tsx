import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx, isoDate, today } from '../lib/utils';

export interface CalItem { id: string; date: string; title: string; tone?: 'danger' | 'warning' | 'info' | 'success' }

/** Month grid with dots; tapping a day lists its items (premium calendar, task calendar). */
export function MonthCalendar({ items, onPick, render }: { items: CalItem[]; onPick?: (date: string) => void; render: (dayItems: CalItem[], date: string) => React.ReactNode }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(today());
  const first = new Date(cursor);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const by = (iso: string) => items.filter((x) => x.date === iso);
  return (
    <div className="cal">
      <div className="row between cal-head">
        <button className="icon-btn sm" aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
        <b>{cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b>
        <button className="icon-btn sm" aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
      </div>
      <div className="cal-grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="cal-dow">{d}</span>)}
        {days.map((d) => {
          const iso = isoDate(d);
          const its = by(iso);
          return (
            <button key={iso} className={cx('cal-day', d.getMonth() !== cursor.getMonth() && 'out', iso === today() && 'today', iso === sel && 'sel')} onClick={() => { setSel(iso); onPick?.(iso); }} aria-label={`${d.toDateString()}, ${its.length} items`}>
              <span>{d.getDate()}</span>
              <span className="cal-dots">{its.slice(0, 3).map((x) => <i key={x.id} className={x.tone ?? 'info'} />)}</span>
            </button>
          );
        })}
      </div>
      <div className="cal-list">{render(by(sel), sel)}</div>
    </div>
  );
}
