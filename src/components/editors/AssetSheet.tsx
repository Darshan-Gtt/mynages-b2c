import { useMemo, useState } from 'react';
import { ArrowLeft, Lock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../ui/Modal';
import { EntityForm, type FieldSpec } from '../ui/EntityForm';
import { useToast } from '../ui/Toast';
import { CatIcon } from '../Icons';
import { getDb, useDb } from '../../lib/store';
import { useMe, useSpace } from '../../lib/session';
import { canCreateIn } from '../../lib/access';
import { ActionError, findDuplicate, saveAsset } from '../../lib/actions';
import { today } from '../../lib/utils';
import type { Asset, FieldDef, Space } from '../../lib/types';

type V = Record<string, unknown>;
function spec(f: FieldDef): FieldSpec<V> {
  const base = { key: `f__${f.key}`, label: f.unit ? `${f.label} (${f.unit})` : f.label, required: f.required };
  if (f.type === 'select') return { ...base, type: 'select', options: (f.options ?? []).map((o) => ({ value: o, label: o })) };
  if (f.type === 'boolean') return { ...base, type: 'checkbox', hint: f.label };
  return { ...base, type: f.type === 'textarea' ? 'textarea' : f.type === 'currency' ? 'currency' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text' };
}

/** Add asset: category tile → subcategory → dynamic form (PRD §7.2, AC-18). */
export function AssetSheet({ asset, onClose }: { asset?: Asset; onClose: () => void }) {
  const db = useDb();
  const me = useMe()!;
  const activeSpace = useSpace();
  const toast = useToast();
  const navigate = useNavigate();
  const isNew = !asset;
  const [cat, setCat] = useState(asset?.categoryId);
  const [subId, setSubId] = useState(asset?.subcategoryId);
  const [allowDup, setAllowDup] = useState(false);
  const sub = db.subcategories.find((s) => s.id === subId);
  const category = db.categories.find((c) => c.id === cat);
  const defaultSpace: Space = asset?.space ?? (canCreateIn(me, activeSpace) ? activeSpace : 'private');

  const initial = useMemo<V>(() => {
    const v: V = {
      name: asset?.name ?? '', space: defaultSpace, ownerMemberId: asset?.ownerMemberId ?? me.id, propertyId: asset?.propertyId ?? db.properties[0]?.id,
      purchaseDate: asset?.purchaseDate ?? '', purchaseCost: asset?.purchaseCost ?? '', invoiceNo: asset?.invoiceNo ?? '', serialNo: asset?.serialNo ?? '', tags: (asset?.tags ?? []).join(', '), notes: asset?.notes ?? '',
    };
    Object.entries(asset?.fields ?? {}).forEach(([k, val]) => (v[`f__${k}`] = val));
    return v;
  }, [asset, subId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields: FieldSpec<V>[] = sub ? [
    { key: 'name', label: 'Name', type: 'text', required: true, full: true, placeholder: `e.g. ${sub.name === 'Car' ? 'Honda City' : sub.name === 'House / flat' ? 'Baner flat' : sub.name}` },
    { key: 'space', label: 'Who can see it', type: 'select', required: true, disabled: !isNew, options: [...(canCreateIn(me, 'family') ? [{ value: 'family', label: `Family — ${db.settings.familyName}` }] : []), { value: 'private', label: 'Only me (private space)' }], hint: isNew ? 'Private items are hidden from everyone else and left out of family totals' : 'Use “Sharing & visibility” on the asset page to move it' },
    { key: 'ownerMemberId', label: 'Owner', type: 'select', required: true, options: db.members.filter((m) => m.state !== 'removed' && m.state !== 'declined').map((m) => ({ value: m.id, label: `${m.name.split(' ')[0]} (${m.relation === 'Self' ? 'Owner' : m.relation})` })) },
    { key: 'propertyId', label: 'Kept at', type: 'select', options: db.properties.map((p) => ({ value: p.id, label: p.name })), emptyLabel: 'Not at a property' },
    ...sub.fields.map((f, i) => ({ ...spec(f), section: i === 0 ? `${sub.name} details` : undefined })),
    { key: 'purchaseDate', label: 'Purchase date', type: 'date', section: 'Purchase', validate: (v) => (v && String(v) > today() ? 'Can’t be in the future' : undefined) },
    { key: 'purchaseCost', label: 'Purchase cost', type: 'currency', min: 0 },
    { key: 'invoiceNo', label: 'Invoice / bill no.', type: 'text' },
    { key: 'serialNo', label: 'Serial number', type: 'text', showIf: () => ['c_elec', 'c_app', 'c_veh'].includes(sub.categoryId) },
    { key: 'tags', label: 'Tags', type: 'text', placeholder: 'comma separated' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ] : [];

  const submit = (v: V) => {
    const fieldsOut: Asset['fields'] = {};
    sub!.fields.forEach((f) => { const x = v[`f__${f.key}`]; if (x !== undefined && x !== '') fieldsOut[f.key] = f.type === 'number' || f.type === 'currency' ? Number(x) : (x as string); });
    const space = v.space as Space;
    const draft: Asset = {
      ...(asset ?? ({ statusId: 'st_active', archived: false, color: ['#0E9384', '#3B6FB6', '#C98A1B', '#8E5BC7', '#C2557A'][Math.floor(Math.random() * 5)], code: '', createdBy: me.id, createdAt: '' } as Asset)),
      id: asset?.id ?? '', name: String(v.name).trim(), categoryId: category!.id, subcategoryId: sub!.id, ownerMemberId: String(v.ownerMemberId), propertyId: (v.propertyId as string) || undefined,
      purchaseDate: (v.purchaseDate as string) || undefined, purchaseCost: v.purchaseCost === '' || v.purchaseCost === undefined ? undefined : Number(v.purchaseCost), invoiceNo: (v.invoiceNo as string) || undefined,
      serialNo: (v.serialNo as string) || undefined, fields: fieldsOut, tags: String(v.tags ?? '').split(',').map((x) => x.trim()).filter(Boolean), notes: (v.notes as string) || undefined,
      space, privateOwnerId: space === 'private' ? asset?.privateOwnerId ?? me.id : undefined,
    };
    if (space === 'family') {
      const dup = findDuplicate(getDb(), draft);
      if (dup && !allowDup) { setAllowDup(true); throw new ActionError(`Looks like this is already in the family: “${dup.name}” (${dup.code}), added by ${getDb().members.find((m) => m.id === dup.createdBy)?.name.split(' ')[0]}. Save again to add it anyway.`); }
    }
    const saved = saveAsset(draft, isNew);
    toast({ type: 'success', title: isNew ? 'Asset added' : 'Saved', message: isNew ? saved.name : undefined });
    onClose();
    if (isNew) navigate(`/assets/${saved.id}`);
  };

  return (
    <Sheet open onClose={onClose} title={isNew ? (sub ? `New ${sub.name.toLowerCase()}` : category ? category.name : 'Add an asset') : `Edit ${asset!.name}`} full>
      {!category && (
        <div className="stack">
          <p className="small muted">What would you like to add?</p>
          <div className="tile3">
            {[...db.categories].sort((a, b) => a.sort - b.sort).map((c) => (
              <button key={c.id} className="ctile" onClick={() => setCat(c.id)}>
                <span className="icon-tile"><CatIcon name={c.icon} /></span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {category && !sub && (
        <div className="stack">
          <button className="link-btn small" onClick={() => setCat(undefined)}><ArrowLeft size={14} /> All categories</button>
          <div className="stack-sm">
            {db.subcategories.filter((s) => s.categoryId === category.id).map((s) => (
              <button key={s.id} className="mrow" onClick={() => setSubId(s.id)}>
                <span className="icon-tile sm"><CatIcon name={category.icon} size={16} /></span>
                <span className="row-text"><b>{s.name}</b><em>{s.fields.slice(0, 3).map((f) => f.label).join(' · ')}</em></span>
              </button>
            ))}
          </div>
        </div>
      )}
      {sub && (
        <div className="stack">
          {isNew && <button className="link-btn small" onClick={() => { setSubId(undefined); setAllowDup(false); }}><ArrowLeft size={14} /> {category?.name}</button>}
          <div className="space-hint">{defaultSpace === 'private' ? <><Lock size={13} /> Will be saved in your private space</> : <><Users size={13} /> Will be shared with {db.settings.familyName}</>}</div>
          <EntityForm<V> key={sub.id} fields={fields} initial={initial} onSubmit={submit} onCancel={onClose} submitLabel={isNew ? 'Add asset' : 'Save'} compact />
        </div>
      )}
    </Sheet>
  );
}
