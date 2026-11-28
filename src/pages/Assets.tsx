import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, LayoutGrid, List, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useActive } from '../lib/hooks';
import { assetValue, covState, nextDue } from '../lib/compute';
import { archiveAsset, deleteAsset } from '../lib/actions';
import { canEdit, isOwner } from '../lib/access';
import { cx, inr } from '../lib/utils';
import { AssetCard, SpaceSwitch, TopBar } from '../components/common';
import { CatIcon } from '../components/Icons';
import { Empty, Pills } from '../components/ui/Misc';
import { Confirm, Sheet } from '../components/ui/Modal';
import { Select } from '../components/ui/Form';
import { useToast } from '../components/ui/Toast';
import { useEd } from '../components/editors/Editors';

type Sort = 'name' | 'newest' | 'value' | 'due';

export function AssetsPage() {
  const { db, me, assets } = useActive();
  const { open, gate } = useEd();
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') ?? '';
  const [view, setView] = useState<'list' | 'grid'>(() => (localStorage.getItem('mynages.b2c.assetview') as 'list' | 'grid') || 'list');
  const [sort, setSort] = useState<Sort>((params.get('sort') as Sort) || 'name');
  const [filters, setFilters] = useState({ member: '', property: '', status: '', cover: '' });
  const [show, setShow] = useState(false);
  const setView2 = (v: 'list' | 'grid') => { setView(v); try { localStorage.setItem('mynages.b2c.assetview', v); } catch { /* ignore */ } };
  const active = Object.values(filters).filter(Boolean).length;

  const rows = useMemo(() => {
    let xs = assets.filter((a) => (!cat || a.categoryId === cat) && (!filters.member || a.ownerMemberId === filters.member) && (!filters.property || a.propertyId === filters.property) && (!filters.status || a.statusId === filters.status));
    if (filters.cover) xs = xs.filter((a) => { const cs = db.coverages.filter((c) => c.assetId === a.id && !c.supersededById); return filters.cover === 'none' ? !cs.length : cs.some((c) => covState(c) === filters.cover); });
    const s = [...xs];
    if (sort === 'name') s.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'newest') s.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'value') s.sort((a, b) => assetValue(db, b).value - assetValue(db, a).value);
    if (sort === 'due') s.sort((a, b) => (nextDue(db, a.id)?.date ?? '9999').localeCompare(nextDue(db, b.id)?.date ?? '9999'));
    return s;
  }, [assets, cat, filters, sort, db]);
  const total = rows.reduce((s, a) => s + assetValue(db, a).value, 0);

  return (
    <div className="page">
      <TopBar title="Assets" actions={<><Link to="/assets/archived" className="icon-btn" aria-label="Archived"><Archive size={19} /></Link><button className="icon-btn" aria-label={view === 'list' ? 'Grid view' : 'List view'} onClick={() => setView2(view === 'list' ? 'grid' : 'list')}>{view === 'list' ? <LayoutGrid size={19} /> : <List size={19} />}</button></>} />
      <div className="pad-x"><SpaceSwitch /></div>
      <div className="cat-scroll">
        <button className={cx('cat-chip', !cat && 'on')} onClick={() => setParams({})}><span className="icon-tile sm"><LayoutGrid size={16} /></span><b>All</b><em>{assets.length}</em></button>
        {[...db.categories].sort((a, b) => a.sort - b.sort).map((c) => {
          const n = assets.filter((a) => a.categoryId === c.id).length;
          return <button key={c.id} className={cx('cat-chip', cat === c.id && 'on')} onClick={() => setParams({ cat: c.id })}><span className="icon-tile sm"><CatIcon name={c.icon} size={16} /></span><b>{c.name.split(' ')[0]}</b><em>{n}</em></button>;
        })}
      </div>
      <div className="row between pad-x" style={{ margin: '10px 0' }}>
        <span className="xs muted">{rows.length} items · {inr(total, { compact: true })}</span>
        <div className="row" style={{ gap: 6 }}>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by" style={{ height: 32, width: 'auto', fontSize: '0.78rem' }}
            display={<span className="ellipsis">Sort: {({ name: 'A–Z', newest: 'Newest', value: 'Highest value', due: 'Due soonest' } as Record<Sort, string>)[sort]}</span>}>
            <option value="name">Name (A–Z)</option><option value="newest">Newest added first</option><option value="value">Highest value first</option><option value="due">Due soonest first</option>
          </Select>
          <button className={cx('btn btn-sm', active > 0 && 'btn-primary')} onClick={() => setShow(true)}><SlidersHorizontal size={14} /> {active ? active : 'Filter'}</button>
        </div>
      </div>
      {active > 0 && <div className="pad-x"><button className="link-btn xs" onClick={() => setFilters({ member: '', property: '', status: '', cover: '' })}><X size={12} /> Clear filters</button></div>}
      {rows.length === 0 ? (
        <Empty icon={<LayoutGrid size={20} />} title={assets.length ? 'No assets match' : 'No assets yet'}>
          {assets.length ? <button className="btn btn-sm" onClick={() => { setParams({}); setFilters({ member: '', property: '', status: '', cover: '' }); }}>Clear filters</button> : <button className="btn btn-sm btn-primary" onClick={() => gate('asset') && open({ kind: 'asset' })}><Plus size={14} /> Add asset</button>}
        </Empty>
      ) : view === 'grid' ? <div className="ggrid">{rows.map((a) => <AssetCard key={a.id} a={a} grid />)}</div> : <div className="list">{rows.map((a) => <AssetCard key={a.id} a={a} />)}</div>}
      <button className="fab" aria-label="Add asset" onClick={() => gate('asset') && open({ kind: 'asset' })}><Plus size={22} /></button>
      <Sheet open={show} onClose={() => setShow(false)} title="Filter assets" footer={<button className="btn btn-primary btn-block" onClick={() => setShow(false)}>Show {rows.length}</button>}>
        <div className="stack">
          <label className="field"><span className="field-label">Owner</span><Select aria-label="Owner" value={filters.member} onChange={(e) => setFilters({ ...filters, member: e.target.value })}><option value="">Anyone</option>{db.members.filter((m) => m.state !== 'removed').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></label>
          {db.properties.length > 1 && <div className="field"><span className="field-label">Kept at</span><Select aria-label="Kept at" value={filters.property} onChange={(e) => setFilters({ ...filters, property: e.target.value })}><option value="">Any home</option>{db.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><span className="field-hint">Which of your homes the item is at</span></div>}
          <label className="field"><span className="field-label">Status</span><Select aria-label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Any</option>{db.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
          <div className="field"><span className="field-label">Insurance / warranty</span><Select aria-label="Insurance / warranty" value={filters.cover} onChange={(e) => setFilters({ ...filters, cover: e.target.value })}><option value="">Any</option><option value="expiring">Expiring in 30 days</option><option value="lapsed">Expired</option><option value="none">Not insured / no warranty</option></Select><span className="field-hint">Find items whose insurance, warranty or AMC needs attention</span></div>
          {isOwner(me) && <p className="xs muted">Saved views — planned (P1)</p>}
        </div>
      </Sheet>
    </div>
  );
}

export function ArchivedPage() {
  const { me, archived } = useActive();
  const toast = useToast();
  const [del, setDel] = useState<string | null>(null);
  return (
    <div className="page">
      <TopBar title="Archived" back="/assets" />
      <p className="xs muted pad-x">Archived assets are hidden from lists and totals. Documents and history are kept.</p>
      {archived.length === 0 ? <Empty icon={<Archive size={20} />} title="Nothing archived" /> : (
        <div className="list">
          {archived.map((a) => (
            <div key={a.id} className="mrow">
              <span className="row-text"><b>{a.name}</b><em>{a.code}</em></span>
              {canEdit(me, a) && <button className="btn btn-sm" onClick={() => { archiveAsset(a.id, false); toast({ type: 'success', title: 'Restored' }); }}><RotateCcw size={13} /> Restore</button>}
              {(isOwner(me) || a.privateOwnerId === me.id) && <button className="icon-btn sm" aria-label="Delete permanently" onClick={() => setDel(a.id)}><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      )}
      <Confirm open={!!del} title="Delete permanently?" message="The asset and everything linked to it — documents, policies, reminders, tasks, history — will be deleted. This can’t be undone." onConfirm={() => { if (del) { deleteAsset(del); toast({ type: 'success', title: 'Deleted' }); } }} onClose={() => setDel(null)} />
    </div>
  );
}
