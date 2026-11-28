import { ChevronDown } from 'lucide-react';
import { COUNTRIES, countryOf } from '../../data/countries';
import { Input, Select } from './Form';

/** Mobile number with a country-code dropdown in front (“IN +91 ▾ | 98765 43210”). */
export function PhoneInput({ iso, onIso, value, onChange, invalid, autoFocus }: {
  iso: string; onIso: (iso: string) => void; value: string; onChange: (digits: string) => void; invalid?: boolean; autoFocus?: boolean;
}) {
  const c = countryOf(iso);
  return (
    <div className="input-group">
      <Select className="addon dial" aria-label="Country code" value={iso} onChange={(e) => onIso(e.target.value)}
        display={<><span>{c.iso} +{c.dial}</span><ChevronDown size={14} aria-hidden="true" /></>}>
        {COUNTRIES.map((x) => <option key={x.iso} value={x.iso}>{x.name} (+{x.dial})</option>)}
      </Select>
      <Input autoFocus={autoFocus} inputMode="numeric" maxLength={c.max} value={value} placeholder={c.sample} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} invalid={invalid} />
    </div>
  );
}
