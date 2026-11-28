import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Sheet } from '../ui/Modal';
import { Checkbox, Field, Input, Select } from '../ui/Form';
import { useToast } from '../ui/Toast';
import { CatIcon, ICON_LIB } from '../Icons';
import { ChevronDown, Search, X } from 'lucide-react';
import { getDb, setDb } from '../../lib/store';
import { cx, uid } from '../../lib/utils';
import type { FieldDef } from '../../lib/types';

type Row = { id: string; label: string; type: FieldDef['type']; required: boolean; options: string };
const TYPES: { value: FieldDef['type']; label: string }[] = [
  { value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'currency', label: 'Amount (money)' }, { value: 'date', label: 'Date' },
  { value: 'select', label: 'Choose from a list' }, { value: 'boolean', label: 'Yes / No' }, { value: 'textarea', label: 'Long text' },
];
const keyOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const blank = (): Row => ({ id: uid('r'), label: '', type: 'text', required: false, options: '' });

/**
 * Create your own asset category (with its first type and fields), or add a new type with fields to an existing
 * category. Fields show up in the add-asset form straight away.
 */
export function CategorySheet({ categoryId, onClose, onSaved }: { categoryId?: string; onClose: () => void; onSaved?: (categoryId: string, subcategoryId: string) => void }) {
  const toast = useToast();
  const db = getDb();
  const parent = db.categories.find((c) => c.id === categoryId);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [iconOpen, setIconOpen] = useState(false);
  const [iq, setIq] = useState('');
  const iconOf = ICON_LIB.find((i) => i.key === icon);
  const [typeName, setTypeName] = useState('');
  const [valuation, setValuation] = useState<'manual' | 'depreciation' | 'none'>('manual');
  const [rows, setRows] = useState<Row[]>([{ ...blank(), label: 'Brand' }, blank()]);
  const [err, setErr] = useState<Record<string, string | undefined>>({});
  const setRow = (id: string, p: Partial<Row>) => { setRows(rows.map((r) => (r.id === id ? { ...r, ...p } : r))); setErr({ ...err, [id]: undefined }); };

  const save = () => {
    const e: Record<string, string | undefined> = {};
    const d = getDb();
    const catName = name.trim();
    const sub = (parent ? typeName : typeName || name).trim();
    if (!parent) {
      if (catName.length < 2 || !/\p{L}/u.test(catName)) e.name = 'Enter a category name (at least 2 letters)';
      else if (d.categories.some((c) => c.name.toLowerCase() === catName.toLowerCase())) e.name = 'A category with this name already exists';
    }
    if (parent || typeName) {
      if (sub.length < 2 || !/\p{L}/u.test(sub)) e.typeName = 'Enter a type name (at least 2 letters)';
      else if (parent && d.subcategories.some((s) => s.categoryId === parent.id && s.name.toLowerCase() === sub.toLowerCase())) e.typeName = 'This type already exists here';
    }
    const used = new Set(['name', 'purchase_date', 'purchase_cost', 'notes', 'tags']);
    const fields: FieldDef[] = [];
    for (const r of rows) {
      const label = r.label.trim();
      if (!label) continue;
      const key = keyOf(label);
      if (!key || !/\p{L}/u.test(label)) e[r.id] = 'Use letters in the field name';
      else if (used.has(key)) e[r.id] = 'This field already exists';
      else if (r.type === 'select' && r.options.split(',').map((x) => x.trim()).filter(Boolean).length < 2) e[r.id] = 'Add at least 2 options, comma separated';
      used.add(key);
      fields.push({ id: uid('f'), key, label, type: r.type, required: r.required, options: r.type === 'select' ? r.options.split(',').map((x) => x.trim()).filter(Boolean) : undefined });
    }
    setErr(e);
    if (Object.values(e).some(Boolean)) { toast({ type: 'error', title: 'Please fix the highlighted fields' }); return; }
    const cid = parent?.id ?? uid('c');
    const sid = uid('s');
    setDb((x) => ({
      ...x,
      categories: parent ? x.categories : [...x.categories, { id: cid, name: catName, icon: icon || 'package', sort: Math.max(0, ...x.categories.map((c) => c.sort)) + 1, custom: true }],
      subcategories: [...x.subcategories, { id: sid, categoryId: cid, name: sub, fields, valuation, depRate: valuation === 'depreciation' ? 15 : undefined, custom: true }],
    }));
    toast({ type: 'success', title: parent ? `“${sub}” added to ${parent.name}` : `Category “${catName}” created`, message: `${fields.length} field${fields.length === 1 ? '' : 's'} — they appear when you add an asset` });
    onClose();
    onSaved?.(cid, sid);
  };

  return (
    <Sheet open onClose={onClose} title={parent ? `New type in ${parent.name}` : 'Create your own category'} subtitle="Name it, then list the details you want to keep for each item" full>
      <div className="stack">
        {!parent && (
          <>
            <Field label="Category name" required error={err.name}><Input autoFocus maxLength={40} autoCapitalize="words" value={name} invalid={!!err.name} onChange={(e) => { setName(e.target.value); setErr({ ...err, name: undefined }); }} placeholder="e.g. Pets, Books, Sports gear" /></Field>
            <Field label="Icon" optional hint="Leave empty to use the default box icon">
              <div className="row" style={{ gap: 6 }}>
                <button type="button" aria-label="Icon" className={cx('select select-btn grow', !icon && 'placeholder')} onClick={() => setIconOpen(true)}>
                  <span className="row" style={{ gap: 8 }}><CatIcon name={icon || 'package'} size={17} />{iconOf ? iconOf.label : 'Choose an icon'}</span><ChevronDown size={14} aria-hidden="true" />
                </button>
                {icon && <button type="button" className="icon-btn sm" aria-label="Clear icon" onClick={() => setIcon('')}><X size={15} /></button>}
              </div>
            </Field>
            {iconOpen && (
              <Sheet open onClose={() => setIconOpen(false)} title="Choose an icon" subtitle="Standard asset icons" full>
                <label className="search-box" style={{ marginBottom: 10 }}><Search size={16} /><input value={iq} onChange={(e) => setIq(e.target.value)} placeholder="Search e.g. car, pets, gold" aria-label="Search icons" /></label>
                <div className="icon-lib">
                  {ICON_LIB.filter((i) => !iq || `${i.label} ${i.key}`.toLowerCase().includes(iq.toLowerCase())).map((i) => (
                    <button key={i.key} type="button" aria-pressed={icon === i.key} className={cx('icon-lib-item', icon === i.key && 'on')} onClick={() => { setIcon(i.key); setIconOpen(false); }}>
                      <span className="icon-tile sm"><i.icon size={18} /></span><span className="xs">{i.label}</span>
                    </button>
                  ))}
                </div>
              </Sheet>
            )}
          </>
        )}
        <Field label={parent ? 'Type name' : 'First type (optional)'} required={!!parent} error={err.typeName} hint={parent ? undefined : `Leave blank to use “${name.trim() || 'the category name'}”. You can add more types later in Settings.`}>
          <Input autoFocus={!!parent} maxLength={40} autoCapitalize="words" value={typeName} invalid={!!err.typeName} onChange={(e) => { setTypeName(e.target.value); setErr({ ...err, typeName: undefined }); }} placeholder={parent ? 'e.g. Electric scooter' : 'e.g. Dog'} />
        </Field>
        <Field label="Value"><Select aria-label="Value" value={valuation} onChange={(e) => setValuation(e.target.value as typeof valuation)}>
          <option value="manual">I enter the value</option><option value="depreciation">Loses value every year (15%)</option><option value="none">Don’t track value</option>
        </Select></Field>
        <div className="form-section">Fields <span className="xs muted" style={{ fontWeight: 400 }}>· Name, purchase date, cost and notes are always included</span></div>
        {rows.map((r, i) => (
          <div key={r.id} className="field-row card">
            <div className="row" style={{ gap: 6 }}>
              <Input aria-label={`Field ${i + 1} name`} maxLength={40} value={r.label} invalid={!!err[r.id]} onChange={(e) => setRow(r.id, { label: e.target.value })} placeholder={`Field ${i + 1} name, e.g. Breed`} />
              <button type="button" className="icon-btn sm" aria-label="Remove field" onClick={() => setRows(rows.filter((x) => x.id !== r.id))}><Trash2 size={15} /></button>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <Select aria-label={`Field ${i + 1} type`} value={r.type} onChange={(e) => setRow(r.id, { type: e.target.value as FieldDef['type'] })}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
              <Checkbox checked={r.required} onChange={(v) => setRow(r.id, { required: v })}>Required</Checkbox>
            </div>
            {r.type === 'select' && <Input style={{ marginTop: 6 }} aria-label="Options" maxLength={200} value={r.options} onChange={(e) => setRow(r.id, { options: e.target.value })} placeholder="Options, comma separated — e.g. Small, Medium, Large" />}
            {err[r.id] && <span className="field-error" role="alert">{err[r.id]}</span>}
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => setRows([...rows, blank()])}><Plus size={14} /> Add a field</button>
        <div className="row" style={{ gap: 8, marginTop: 6 }}><button type="button" className="btn grow" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary grow" onClick={save}>{parent ? 'Add type' : 'Create category'}</button></div>
      </div>
    </Sheet>
  );
}
