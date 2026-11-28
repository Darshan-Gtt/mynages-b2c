import { FormSheet, type FieldSpec } from '../ui/EntityForm';
import { useToast } from '../ui/Toast';
import { getDb, setDb } from '../../lib/store';
import { ActionError } from '../../lib/actions';
import { uid } from '../../lib/utils';
import type { Db, FieldDef } from '../../lib/types';

export type DocKind = 'asset' | 'person';
/** Settings key for a document category's extra fields. */
export const docCatKey = (kind: DocKind, name: string) => `${kind}:${name}`;
export const docFieldsOf = (d: Db, kind: DocKind, name: string): FieldDef[] => d.settings.docFields?.[docCatKey(kind, name)] ?? [];

const TYPES: { value: FieldDef['type']; label: string }[] = [
  { value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'currency', label: 'Amount (money)' }, { value: 'date', label: 'Date' },
  { value: 'select', label: 'Choose from a list' }, { value: 'boolean', label: 'Yes / No' }, { value: 'textarea', label: 'Long text' },
];
export const fieldTypeLabel = (t: FieldDef['type']) => TYPES.find((x) => x.value === t)?.label ?? t;
const RESERVED = ['title', 'category', 'number', 'issuer', 'issue_date', 'expiry_date', 'tags', 'notes'];

/** Form-field spec for a category field inside the document form (key prefix df__). */
export function docFieldSpec(f: FieldDef, showIf: FieldSpec<Record<string, unknown>>['showIf']): FieldSpec<Record<string, unknown>> {
  const base = { key: `df__${f.key}`, label: f.label, required: (v: Record<string, unknown>) => f.required && (!showIf || showIf(v)), showIf };
  if (f.type === 'select') return { ...base, type: 'select', options: (f.options ?? []).map((o) => ({ value: o, label: o })) };
  if (f.type === 'boolean') return { ...base, type: 'checkbox', hint: f.label };
  return { ...base, type: f.type === 'textarea' ? 'textarea' : f.type === 'currency' ? 'currency' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text' };
}

export function removeDocField(kind: DocKind, name: string, fieldId: string) {
  const k = docCatKey(kind, name);
  setDb((d) => ({ ...d, settings: { ...d.settings, docFields: { ...d.settings.docFields, [k]: (d.settings.docFields?.[k] ?? []).filter((f) => f.id !== fieldId) } } }));
}

/** Add a field to a document category (e.g. "Policy number" for Insurance, "Blood group" for Medical). */
export function DocFieldSheet({ kind, name, onClose }: { kind: DocKind; name: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <FormSheet<Record<string, unknown>> open onClose={onClose} title={`New field in “${name}”`}
      fields={[
        { key: 'label', label: 'Field name', type: 'text', required: true, full: true, placeholder: 'e.g. Account number, Blood group, Locker no.' },
        { key: 'type', label: 'Type of answer', type: 'select', required: true, options: TYPES },
        { key: 'options', label: 'Options (comma separated)', type: 'text', full: true, showIf: (v) => v.type === 'select', required: (v) => v.type === 'select', placeholder: 'e.g. Original, Photocopy, Scanned', validate: (x) => (String(x).split(',').map((s) => s.trim()).filter(Boolean).length < 2 ? 'Add at least 2 options' : undefined) },
        { key: 'required', label: 'Required', type: 'checkbox', hint: 'Must be filled when adding a document in this category' },
      ]}
      initial={{ type: 'text' }}
      after={() => <p className="xs muted" style={{ marginTop: 10 }}>Shows on every “{name}” document form. Documents already saved keep working — the new field is blank for them.</p>}
      onSubmit={(v) => {
        const label = String(v.label).trim();
        const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        if (!key || !/\p{L}/u.test(label)) throw new ActionError('Use letters in the field name');
        if (RESERVED.includes(key)) throw new ActionError('Every document already has this field');
        if (docFieldsOf(getDb(), kind, name).some((f) => f.key === key)) throw new ActionError('This category already has a field with this name');
        const f: FieldDef = { id: uid('df'), key, label, type: v.type as FieldDef['type'], required: !!v.required, options: v.type === 'select' ? String(v.options).split(',').map((s) => s.trim()).filter(Boolean) : undefined };
        const k = docCatKey(kind, name);
        setDb((d) => ({ ...d, settings: { ...d.settings, docFields: { ...d.settings.docFields, [k]: [...(d.settings.docFields?.[k] ?? []), f] } } }));
        toast({ type: 'success', title: `“${label}” added to ${name}` });
        onClose();
      }} />
  );
}
