/** Countries offered at sign-in: dial code, accepted mobile length, and the defaults they suggest. */
export interface Country { iso: string; name: string; dial: string; min: number; max: number; currency: string; tz: string; sample: string }

export const COUNTRIES: Country[] = [
  { iso: 'IN', name: 'India', dial: '91', min: 10, max: 10, currency: 'INR', tz: 'Asia/Kolkata', sample: '98765 43210' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971', min: 9, max: 9, currency: 'AED', tz: 'Asia/Dubai', sample: '50 123 4567' },
  { iso: 'US', name: 'United States', dial: '1', min: 10, max: 10, currency: 'USD', tz: 'America/New_York', sample: '201 555 0123' },
  { iso: 'GB', name: 'United Kingdom', dial: '44', min: 10, max: 10, currency: 'GBP', tz: 'Europe/London', sample: '7400 123456' },
  { iso: 'CA', name: 'Canada', dial: '1', min: 10, max: 10, currency: 'CAD', tz: 'America/Toronto', sample: '416 555 0123' },
  { iso: 'AU', name: 'Australia', dial: '61', min: 9, max: 9, currency: 'AUD', tz: 'Australia/Sydney', sample: '412 345 678' },
  { iso: 'SG', name: 'Singapore', dial: '65', min: 8, max: 8, currency: 'SGD', tz: 'Asia/Singapore', sample: '8123 4567' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966', min: 9, max: 9, currency: 'SAR', tz: 'Asia/Riyadh', sample: '51 234 5678' },
  { iso: 'QA', name: 'Qatar', dial: '974', min: 8, max: 8, currency: 'QAR', tz: 'Asia/Qatar', sample: '3312 3456' },
  { iso: 'KW', name: 'Kuwait', dial: '965', min: 8, max: 8, currency: 'KWD', tz: 'Asia/Kuwait', sample: '500 12345' },
  { iso: 'OM', name: 'Oman', dial: '968', min: 8, max: 8, currency: 'OMR', tz: 'Asia/Muscat', sample: '9212 3456' },
  { iso: 'DE', name: 'Germany', dial: '49', min: 10, max: 11, currency: 'EUR', tz: 'Europe/Berlin', sample: '1512 3456789' },
  { iso: 'FR', name: 'France', dial: '33', min: 9, max: 9, currency: 'EUR', tz: 'Europe/Paris', sample: '6 12 34 56 78' },
  { iso: 'NZ', name: 'New Zealand', dial: '64', min: 8, max: 10, currency: 'NZD', tz: 'Pacific/Auckland', sample: '21 123 4567' },
  { iso: 'MY', name: 'Malaysia', dial: '60', min: 9, max: 10, currency: 'MYR', tz: 'Asia/Kuala_Lumpur', sample: '12 345 6789' },
  { iso: 'NP', name: 'Nepal', dial: '977', min: 10, max: 10, currency: 'NPR', tz: 'Asia/Kathmandu', sample: '984 1234567' },
  { iso: 'BD', name: 'Bangladesh', dial: '880', min: 10, max: 10, currency: 'BDT', tz: 'Asia/Dhaka', sample: '1812 345678' },
  { iso: 'LK', name: 'Sri Lanka', dial: '94', min: 9, max: 9, currency: 'LKR', tz: 'Asia/Colombo', sample: '71 234 5678' },
  { iso: 'ZA', name: 'South Africa', dial: '27', min: 9, max: 9, currency: 'ZAR', tz: 'Africa/Johannesburg', sample: '71 123 4567' },
  { iso: 'JP', name: 'Japan', dial: '81', min: 10, max: 10, currency: 'JPY', tz: 'Asia/Tokyo', sample: '90 1234 5678' },
];
export const countryOf = (iso?: string) => COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0];

/** Indian mobiles start 6–9; elsewhere only the length is checked. */
export function validMobile(c: Country, digits: string): boolean {
  if (c.iso === 'IN') return /^[6-9]\d{9}$/.test(digits);
  return /^\d+$/.test(digits) && digits.length >= c.min && digits.length <= c.max;
}

export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'INR', name: 'Indian rupee' }, { code: 'USD', name: 'US dollar' }, { code: 'EUR', name: 'Euro' }, { code: 'GBP', name: 'British pound' },
  { code: 'AED', name: 'UAE dirham' }, { code: 'SAR', name: 'Saudi riyal' }, { code: 'QAR', name: 'Qatari riyal' }, { code: 'KWD', name: 'Kuwaiti dinar' },
  { code: 'OMR', name: 'Omani rial' }, { code: 'SGD', name: 'Singapore dollar' }, { code: 'AUD', name: 'Australian dollar' }, { code: 'CAD', name: 'Canadian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' }, { code: 'MYR', name: 'Malaysian ringgit' }, { code: 'JPY', name: 'Japanese yen' }, { code: 'CHF', name: 'Swiss franc' },
  { code: 'ZAR', name: 'South African rand' }, { code: 'NPR', name: 'Nepalese rupee' }, { code: 'BDT', name: 'Bangladeshi taka' }, { code: 'LKR', name: 'Sri Lankan rupee' },
];
