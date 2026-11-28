/**
 * Field-aware input rules, applied automatically by every form (EntityForm, onboarding, sign-in, Snap review).
 * A rule is chosen from the field's type and its key/label, so a new "Mobile", "IMEI" or "Interest rate" field
 * is validated without extra code. Each rule can clean what is typed (sanitize), set the phone keyboard
 * (inputMode) and a length cap, and check the final value.
 */
import { getDb } from './store';
import { countryOf, validMobile as validMobileFor } from '../data/countries';

export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'time' | 'select' | 'textarea' | 'checkbox' | 'multiselect' | 'email' | 'tel' | 'color' | 'custom';
export interface Rule {
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url';
  maxLength?: number;
  autoCapitalize?: 'off' | 'characters' | 'words' | 'sentences';
  sanitize?: (s: string) => string;
  check?: (s: string) => string | undefined;
}

const digits = (max: number) => (s: string) => s.replace(/\D/g, '').slice(0, max);
const decimal = (places: number) => (s: string) => {
  const clean = s.replace(/[^\d.]/g, '');
  const [int, ...rest] = clean.split('.');
  return rest.length ? `${int}.${rest.join('').slice(0, places)}` : int;
};
const upper = (s: string) => s.toUpperCase();
const thisYear = new Date().getFullYear();

const RX = {
  personName: /^\p{L}[\p{L} .'-]*$/u,
  hasLetter: /\p{L}/u,
  orgName: /^[\p{L}\d][\p{L}\d &.,'()/+@#-]*$/u,
  reference: /^[A-Za-z0-9][A-Za-z0-9 /.\-_#]*$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  upi: /^[\w.-]{2,}@[a-zA-Z]{2,}$/,
  gstin: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  vehicleIN: /^([A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{1,4}|\d{2}\s?BH\s?\d{4}\s?[A-Z]{1,2})$/,
  domain: /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})*\.[a-z]{2,}$/i,
};

const range = (lo: number, hi: number, what: string, int = false) => (s: string) => {
  const n = Number(s);
  if (!s || Number.isNaN(n)) return 'Enter a number';
  if (int && !Number.isInteger(n)) return `${what} must be a whole number`;
  if (n < lo || n > hi) return `${what} must be between ${lo} and ${hi}`;
  return undefined;
};
const len = (min: number, max: number) => (s: string) => (s.trim().length < min ? `Enter at least ${min} characters` : s.length > max ? `Keep it under ${max} characters` : undefined);

/** Returns the rule for a field. `key`/`label` are matched case-insensitively. */
export function ruleFor(key: string, label: string, type: FieldType): Rule {
  const k = `${key} ${label}`.toLowerCase();
  const has = (...w: string[]) => w.some((x) => k.includes(x));

  if (type === 'email' || has('email')) return { inputMode: 'email', maxLength: 80, autoCapitalize: 'off', sanitize: (s) => s.replace(/\s/g, ''), check: (s) => (RX.email.test(s) ? undefined : 'Enter a valid email, e.g. name@gmail.com') };

  if (type === 'tel' || has('mobile', 'phone', 'whatsapp')) {
    const c = countryOf(getDb().settings.country);
    if (has('mobile', 'whatsapp')) {
      return { inputMode: 'numeric', maxLength: c.max, sanitize: digits(c.max), check: (s) => (validMobileFor(c, s) ? undefined : c.iso === 'IN' ? 'Enter a valid 10-digit mobile starting with 6–9' : `Enter a valid ${c.name} mobile number`) };
    }
    return { inputMode: 'numeric', maxLength: 12, sanitize: digits(12), check: (s) => (s.length >= 8 && s.length <= 12 ? undefined : 'Enter a valid phone number (8–12 digits, with STD code for landlines)') };
  }

  if (type === 'currency') {
    return { inputMode: 'decimal', maxLength: 14, sanitize: decimal(2), check: (s) => { const n = Number(s); if (Number.isNaN(n)) return 'Enter an amount'; if (n <= 0) return 'Amount must be more than 0'; if (n > 1e11) return 'That amount looks too large'; return undefined; } };
  }

  if (type === 'number') {
    if (has('%', 'rate', 'percent') && !has('per gram')) return { inputMode: 'decimal', maxLength: 6, sanitize: decimal(2), check: range(0, 100, 'Rate') };
    if (has('year')) return { inputMode: 'numeric', maxLength: 4, sanitize: digits(4), check: range(1900, thisYear + 1, 'Year', true) };
    if (has('sip date', 'day of month')) return { inputMode: 'numeric', maxLength: 2, sanitize: digits(2), check: range(1, 31, 'Day', true) };
    if (has('days', 'every')) return { inputMode: 'numeric', maxLength: 4, sanitize: digits(4), check: range(1, 3650, 'Days', true) };
    if (has('how many')) return { inputMode: 'numeric', maxLength: 3, sanitize: digits(3), check: range(1, 500, 'Count', true) };
    if (has('odometer', 'reading')) return { inputMode: 'numeric', maxLength: 7, sanitize: digits(7), check: range(0, 9_999_999, 'Reading', true) };
    if (has('screen')) return { inputMode: 'decimal', maxLength: 5, sanitize: decimal(1), check: range(1, 200, 'Screen size') };
    return { inputMode: 'decimal', maxLength: 12, sanitize: decimal(3), check: (s) => { const n = Number(s); if (Number.isNaN(n)) return 'Enter a number'; if (n <= 0) return 'Must be more than 0'; if (n > 1e9) return 'That number looks too large'; return undefined; } };
  }

  if (type === 'textarea') return { maxLength: 1000, autoCapitalize: 'sentences', check: len(2, 1000) };
  if (type !== 'text') return {};

  // Text fields, most specific first
  if (has('upi')) return { inputMode: 'email', maxLength: 50, autoCapitalize: 'off', sanitize: (s) => s.replace(/\s/g, ''), check: (s) => (RX.upi.test(s) ? undefined : 'Enter a valid UPI ID, e.g. name@okicici') };
  if (has('gst')) return { maxLength: 15, autoCapitalize: 'characters', sanitize: (s) => upper(s).replace(/[^A-Z0-9]/g, '').slice(0, 15), check: (s) => (RX.gstin.test(s) ? undefined : 'Enter a valid 15-character GSTIN, e.g. 27AAPFU0939F1ZV') };
  if (/\bpan\b/.test(k)) return { maxLength: 10, autoCapitalize: 'characters', sanitize: (s) => upper(s).replace(/[^A-Z0-9]/g, '').slice(0, 10), check: (s) => (RX.pan.test(s) ? undefined : 'Enter a valid PAN, e.g. ABCDE1234F') };
  if (has('aadhaar', 'aadhar')) return { inputMode: 'numeric', maxLength: 12, sanitize: digits(12), check: (s) => (/^[2-9]\d{11}$/.test(s) ? undefined : 'Enter a valid 12-digit Aadhaar number') };
  if (has('ifsc')) return { maxLength: 11, autoCapitalize: 'characters', sanitize: (s) => upper(s).replace(/[^A-Z0-9]/g, '').slice(0, 11), check: (s) => (RX.ifsc.test(s) ? undefined : 'Enter a valid IFSC, e.g. HDFC0001234') };
  if (has('pincode', 'pin code', 'postal')) return { inputMode: 'numeric', maxLength: 6, sanitize: digits(6), check: (s) => (/^[1-9]\d{5}$/.test(s) ? undefined : 'Enter a valid 6-digit PIN code') };
  if (has('imei')) return { inputMode: 'numeric', maxLength: 15, sanitize: digits(15), check: (s) => (/^\d{15}$/.test(s) ? undefined : 'IMEI has 15 digits') };
  if (has('last 4')) return { inputMode: 'numeric', maxLength: 4, sanitize: digits(4), check: (s) => (/^\d{4}$/.test(s) ? undefined : 'Enter the last 4 digits') };
  if (has('registration number')) {
    const india = (getDb().settings.country ?? 'IN') === 'IN';
    return { maxLength: 15, autoCapitalize: 'characters', sanitize: (s) => upper(s).replace(/[^A-Z0-9 ]/g, '').slice(0, 15), check: (s) => (india ? (RX.vehicleIN.test(s.trim()) ? undefined : 'Enter a valid number, e.g. MH12 AB 1234') : /^[A-Z0-9 ]{3,15}$/.test(s) ? undefined : 'Use letters and numbers only') };
  }
  if (has('chassis', 'engine number', 'vin')) return { maxLength: 20, autoCapitalize: 'characters', sanitize: (s) => upper(s).replace(/[^A-Z0-9]/g, '').slice(0, 20), check: (s) => (s.length >= 5 ? undefined : 'Enter at least 5 letters / numbers') };
  if (has('fastag')) return { maxLength: 24, autoCapitalize: 'characters', sanitize: (s) => upper(s).replace(/[^A-Z0-9]/g, '').slice(0, 24), check: (s) => (s.length >= 10 ? undefined : 'Enter the full FASTag ID') };
  if (has('domain')) return { inputMode: 'url', maxLength: 80, autoCapitalize: 'off', sanitize: (s) => s.replace(/\s/g, '').toLowerCase(), check: (s) => (RX.domain.test(s) ? undefined : 'Enter a domain, e.g. kulkarni.in') };
  if (has('no.', 'number', 'serial', 'invoice', 'bill', 'fir', 'reference', 'survey', 'gat', 'account')) {
    return { maxLength: 40, autoCapitalize: 'characters', check: (s) => (s.trim().length < 2 ? 'Enter at least 2 characters' : RX.reference.test(s.trim()) ? undefined : 'Use letters, numbers and / - . only') };
  }
  if ((key === 'name' && has('full name')) || has('your name', 'nominee', 'relationship', 'relation')) {
    return { maxLength: 60, autoCapitalize: 'words', check: (s) => (s.trim().length < 2 ? 'Enter at least 2 letters' : RX.personName.test(s.trim()) ? undefined : 'Use letters, spaces and . \' - only') };
  }
  if (has('city', 'village', 'taluka', 'district')) return { maxLength: 50, autoCapitalize: 'words', check: (s) => (s.trim().length < 2 ? 'Enter at least 2 letters' : RX.personName.test(s.trim()) ? undefined : 'Use letters only') };
  if (has('make', 'model', 'brand', 'institution', 'provider', 'insurer', 'issuer', 'issued by', 'hospital', 'clinic', 'done by', 'name', 'family', 'item type', 'battery')) {
    return { maxLength: 60, autoCapitalize: 'words', check: (s) => (s.trim().length < 2 ? 'Enter at least 2 characters' : !RX.hasLetter.test(s) && !has('model', 'battery') ? 'Must include letters' : RX.orgName.test(s.trim()) ? undefined : 'Remove special characters') };
  }
  if (has('tags')) return { maxLength: 120, check: (s) => (s.split(',').some((t) => t.trim().length > 24) ? 'Keep each tag under 24 characters' : undefined) };
  if (has('address')) return { maxLength: 200, autoCapitalize: 'words', check: (s) => (s.trim().length < 5 ? 'Enter the full address' : RX.hasLetter.test(s) ? undefined : 'Address must include letters') };
  if (has('area', 'share')) return { maxLength: 40, check: len(1, 40) };
  // Titles, purpose, place, label, notes…
  return { maxLength: 100, autoCapitalize: 'sentences', check: (s) => (s.trim().length < 2 ? 'Enter at least 2 characters' : RX.hasLetter.test(s) || /\d/.test(s) ? undefined : 'Enter a proper value') };
}

/** Date sanity: real date, between 1900 and 2100; past-only fields can't be in the future. */
export function checkDate(key: string, label: string, s: string): string | undefined {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return 'Enter a valid date';
  const y = d.getFullYear();
  if (y < 1900 || y > 2100) return 'Enter a date between 1900 and 2100';
  const k = `${key} ${label}`.toLowerCase();
  const pastOnly = ['birth', 'dob', 'purchase', 'paid on', 'done on', 'date done', 'issued', 'registration date', 'joined'].some((w) => k.includes(w));
  if (pastOnly && s > new Date().toISOString().slice(0, 10)) return 'Can’t be in the future';
  return undefined;
}

/** Validate one value against its rule; empty values are left to the "required" check. */
export function checkValue(key: string, label: string, type: FieldType, value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (type === 'date') return checkDate(key, label, String(value));
  return ruleFor(key, label, type).check?.(String(value));
}
