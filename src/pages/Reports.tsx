import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarChart3, ChevronRight, Download, FileText, IndianRupee, PieChart, ShieldAlert, ShieldCheck, Users, Wallet, CalendarClock } from 'lucide-react';
import { useActive } from '../lib/hooks';
import { assetValue, catName, covLabel, covState, memberName, obState, subName, taskOverdue } from '../lib/compute';
import { daysUntil, download, fmtDate, fyOf, fyStart, inr, sum, toCsv, today } from '../lib/utils';
import { SpaceSwitch, TopBar } from '../components/common';
import { Badge, Empty, Segmented } from '../components/ui/Misc';
import { Donut, HBars, TrendChart } from '../components/ui/Charts';
import { useToast } from '../components/ui/Toast';

type Row = Record<string, string | number>;
interface Report { id: string; title: string; sub: string; icon: React.ReactNode }

/**
 * Family reports (PRD §11). The PRD lists report IDs RPT-33…46 without names, so this set is our
 * interpretation of the family-facing reports described in the text — flagged in the README.
 */
const REPORTS: Report[] = [
  { id: 'register', title: 'Asset register', sub: 'Every asset with owner, place, cost and value', icon: <FileText size={18} /> },
  { id: 'value', title: 'Value by category', sub: 'What the family owns, by category and person', icon: <PieChart size={18} /> },
  { id: 'spend', title: 'Spending', sub: 'Expenses by month, asset and type (FY)', icon: <IndianRupee size={18} /> },
  { id: 'coverage', title: 'Coverage & gaps', sub: 'Insured, expiring, lapsed and uninsured items', icon: <ShieldAlert size={18} /> },
  { id: 'dues', title: 'Upcoming dues', sub: 'Premiums, taxes, renewals in the next 90 days', icon: <CalendarClock size={18} /> },
  { id: 'warranty', title: 'Warranty & AMC expiries', sub: 'What runs out in the next 6 months', icon: <ShieldCheck size={18} /> },
  { id: 'docs', title: 'Expiring documents', sub: 'Passports, licences, PUC, RC…', icon: <FileText size={18} /> },
  { id: 'tasks', title: 'Tasks by member', sub: 'Open, overdue and done this month', icon: <Users size={18} /> },
  { id: 'networth', title: 'Savings summary', sub: 'Invested vs current value (Family Plus)', icon: <Wallet size={18} /> },
];

export function ReportsPage() {
  const nav = useNavigate();
  return (
    <div className="page">
      <TopBar title="Reports" back="/more" />
      <div className="pad-x" style={{ marginBottom: 6 }}><SpaceSwitch /></div>
      <p className="xs muted pad-x">Reports cover the space selected above. Private items appear only in their owner’s private-space reports.</p>
      <div className="list">
        {REPORTS.map((r) => (
          <button key={r.id} className="mrow" onClick={() => nav(`/more/reports/${r.id}`)}>
            <span className="icon-tile sm">{r.icon}</span>
            <span className="row-text"><b>{r.title}</b><em>{r.sub}</em></span>
            <ChevronRight size={16} className="muted" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReportPage() {
  const { id } = useParams();
  const { db, assets, obligations, coverages, docs, tasks, space } = useActive();
  const toast = useToast();
  const nav = useNavigate();
  const [by, setBy] = useState<'category' | 'member'>('category');
  const r = REPORTS.find((x) => x.id === id);
  if (!r) return <div className="page"><TopBar title="Report" back="/more/reports" /><Empty icon={<BarChart3 size={20} />} title="Report not found" /></div>;
  const fy = fyStart(today());
  let rows: Row[] = [];
  let chart: React.ReactNode = null;
  let summary: React.ReactNode = null;

  switch (r.id) {
    case 'register':
      rows = assets.map((a) => ({ Code: a.code, Asset: a.name, Category: catName(db, a.categoryId), Type: subName(db, a.subcategoryId), Owner: memberName(db, a.ownerMemberId), Place: db.properties.find((p) => p.id === a.propertyId)?.name ?? '', Bought: a.purchaseDate ?? '', Cost: a.purchaseCost ?? 0, Value: assetValue(db, a).value }));
      summary = <><b>{rows.length}</b> assets · cost {inr(sum(rows, (x) => Number(x.Cost)), { compact: true })} · value {inr(sum(rows, (x) => Number(x.Value)), { compact: true })}</>;
      break;
    case 'value': {
      const key = (a: (typeof assets)[number]) => (by === 'category' ? catName(db, a.categoryId) : memberName(db, a.ownerMemberId).split(' ')[0]);
      const m = new Map<string, number>();
      assets.forEach((a) => m.set(key(a), (m.get(key(a)) ?? 0) + assetValue(db, a).value));
      rows = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ [by === 'category' ? 'Category' : 'Owner']: k, Value: v }));
      const total = sum(rows, (x) => Number(x.Value));
      chart = <><Segmented label="Group by" value={by} onChange={setBy} options={[{ value: 'category', label: 'Category' }, { value: 'member', label: 'Person' }]} /><div style={{ marginTop: 10 }}><Donut data={rows.map((x) => ({ label: String(Object.values(x)[0]), value: Number(x.Value) }))} total={total} centerLabel="Total value" format={(n) => inr(n, { compact: true })} /></div></>;
      summary = <>Total {inr(total, { compact: true })} · values are latest entered or estimated</>;
      break;
    }
    case 'spend': {
      const ids = new Set(assets.map((a) => a.id));
      const ex = db.expenses.filter((e) => ids.has(e.assetId) && e.date >= fy);
      rows = ex.sort((a, b) => b.date.localeCompare(a.date)).map((e) => ({ Date: e.date, Asset: db.assets.find((a) => a.id === e.assetId)?.name ?? '', Type: e.type, 'Paid by': memberName(db, e.paidBy).split(' ')[0], Amount: e.amount }));
      const months: { label: string; spend: number }[] = [];
      for (let i = 0; i < 12; i++) { const d = new Date(fy + 'T00:00:00'); d.setMonth(d.getMonth() + i); if (d > new Date()) break; const k = d.toISOString().slice(0, 7); months.push({ label: d.toLocaleDateString('en-IN', { month: 'short' }), spend: sum(ex.filter((e) => e.date.startsWith(k)), (e) => e.amount) }); }
      const byType = new Map<string, number>(); ex.forEach((e) => byType.set(e.type, (byType.get(e.type) ?? 0) + e.amount));
      chart = <>{months.length > 1 && <TrendChart data={months} series={[{ key: 'spend', label: 'Spend' }]} format={(n) => inr(n, { compact: true })} height={180} />}<div style={{ marginTop: 12 }}><HBars data={[...byType.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v }))} format={(n) => inr(n, { compact: true })} /></div></>;
      summary = <>FY {fyOf(today())}: <b>{inr(sum(ex, (e) => e.amount))}</b> across {ex.length} entries</>;
      break;
    }
    case 'coverage': {
      const live = coverages.filter((c) => !c.supersededById);
      const needs = assets.filter((a) => (a.categoryId === 'c_veh' && a.subcategoryId !== 's_cycle') || a.categoryId === 'c_prop');
      const uninsured = needs.filter((a) => !live.some((c) => c.assetId === a.id && c.kind === 'insurance' && covState(c) !== 'lapsed'));
      rows = [
        ...live.map((c) => ({ Item: c.linkedType === 'asset' ? db.assets.find((a) => a.id === c.assetId)?.name ?? '' : c.insured.map((i) => memberName(db, i.memberId).split(' ')[0]).join(', '), Cover: covLabel(c), Provider: c.provider, 'Ends': c.endDate, Status: covState(c) === 'lapsed' ? 'Lapsed' : covState(c) === 'expiring' ? 'Expiring' : 'Active', 'Sum insured': c.sumInsured ?? 0 })),
        ...uninsured.map((a) => ({ Item: a.name, Cover: 'No insurance', Provider: '', Ends: '', Status: 'Gap', 'Sum insured': 0 })),
      ];
      summary = <><Badge tone="success">{live.filter((c) => covState(c) === 'active').length} active</Badge> <Badge tone="warning">{live.filter((c) => covState(c) === 'expiring').length} expiring</Badge> <Badge tone="danger">{live.filter((c) => covState(c) === 'lapsed').length + uninsured.length} lapsed / gaps</Badge></>;
      break;
    }
    case 'dues': {
      const xs = obligations.filter((o) => o.status === 'open' && daysUntil(o.dueDate) <= 90).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      rows = xs.map((o) => ({ Due: o.dueDate, Item: o.title, Type: o.type.replace(/_/g, ' '), Amount: o.amount ?? 0, State: obState(o) }));
      summary = <><b>{inr(sum(xs, (o) => o.amount ?? 0))}</b> due in the next 90 days · {xs.filter((o) => obState(o) === 'overdue').length} overdue</>;
      break;
    }
    case 'warranty':
      rows = coverages.filter((c) => c.kind !== 'insurance' && !c.supersededById && daysUntil(c.endDate) <= 180).sort((a, b) => a.endDate.localeCompare(b.endDate)).map((c) => ({ Asset: db.assets.find((a) => a.id === c.assetId)?.name ?? '', Type: covLabel(c), Provider: c.provider, Ends: c.endDate, 'Days left': daysUntil(c.endDate) }));
      summary = <>{rows.length} warranties / AMCs end within 6 months</>;
      break;
    case 'docs':
      rows = docs.filter((d) => d.expiryDate && daysUntil(d.expiryDate) <= 120).sort((a, b) => a.expiryDate!.localeCompare(b.expiryDate!)).map((d) => ({ Document: d.title, For: d.ownerType === 'member' ? memberName(db, d.ownerId) : db.assets.find((a) => a.id === d.ownerId)?.name ?? '', Expires: d.expiryDate!, 'Days left': daysUntil(d.expiryDate) }));
      summary = <>{rows.length} documents expire within 4 months</>;
      break;
    case 'tasks': {
      const month = today().slice(0, 7);
      const people = db.members.filter((m) => m.state === 'self' || m.state === 'joined');
      rows = people.map((m) => { const ts = tasks.filter((t) => t.assigneeId === m.id); return { Member: m.name, Open: ts.filter((t) => t.status === 'pending' || t.status === 'in_progress').length, Overdue: ts.filter(taskOverdue).length, 'Done this month': ts.filter((t) => t.status === 'done' && t.completedAt?.startsWith(month)).length }; });
      chart = <HBars data={rows.map((x) => ({ label: String(x.Member).split(' ')[0], value: Number(x.Open), sub: `${x.Overdue} overdue` }))} format={(n) => `${n} open`} />;
      break;
    }
    case 'networth': {
      const sav = assets.filter((a) => a.categoryId === 'c_sav');
      rows = sav.map((a) => ({ Instrument: a.name, Owner: memberName(db, a.ownerMemberId).split(' ')[0], Invested: Number(a.fields.invested_amount ?? a.purchaseCost ?? 0), Current: assetValue(db, a).value, Maturity: String(a.fields.maturity_date ?? '') }));
      const inv = sum(rows, (x) => Number(x.Invested)); const cur = sum(rows, (x) => Number(x.Current));
      summary = <>Invested {inr(inv, { compact: true })} → now {inr(cur, { compact: true })} {inv ? `(${(((cur - inv) / inv) * 100).toFixed(1)}%)` : ''}</>;
      break;
    }
  }

  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const fmt = (k: string, v: string | number) => (typeof v === 'number' && /cost|value|amount|invested|current|sum/i.test(k) ? inr(v) : /^(date|due|ends|expires|bought|maturity)$/i.test(k) && v ? fmtDate(String(v)) : String(v));
  return (
    <div className="page">
      <TopBar title={r.title} back="/more/reports" sub={space === 'private' ? 'My private space' : db.settings.familyName}
        actions={<button className="icon-btn" aria-label="Export CSV" disabled={!rows.length} onClick={() => { download(`mynages-${r.id}-${today()}.csv`, toCsv(rows)); toast({ type: 'success', title: 'CSV downloaded', message: `${rows.length} rows` }); }}><Download size={19} /></button>} />
      {summary && <p className="small pad-x" style={{ marginBottom: 10 }}>{summary}</p>}
      {chart && <div className="card pad" style={{ margin: '0 16px 12px' }}>{chart}</div>}
      {rows.length === 0 ? <Empty icon={<BarChart3 size={20} />} title="Nothing to report" /> : (
        <div className="rtable-wrap">
          <table className="rtable">
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{rows.map((x, i) => <tr key={i} onClick={() => { const a = db.assets.find((y) => y.name === x.Asset || y.name === x.Item || y.name === x.Instrument); if (a) nav(`/assets/${a.id}`); }}>{cols.map((c) => <td key={c} className={typeof x[c] === 'number' ? 'num' : undefined}>{fmt(c, x[c])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      <p className="xs muted pad">PDF export and scheduled email reports — planned. CSV opens in Excel / Google Sheets.</p>
    </div>
  );
}
