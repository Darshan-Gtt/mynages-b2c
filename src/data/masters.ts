import type { Category, FieldDef, ReminderPreset, StatusDef, Subcategory } from '../lib/types';

let n = 0;
const f = (label: string, type: FieldDef['type'] = 'text', extra: Partial<FieldDef> = {}): FieldDef => ({
  id: `fd${++n}`, key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), label, type, required: false, ...extra,
});

// PRD §6.1 B2C base category package (India)
export const CATEGORIES: Category[] = [
  { id: 'c_veh', name: 'Vehicles', icon: 'car', sort: 1 },
  { id: 'c_prop', name: 'Property', icon: 'home', sort: 2 },
  { id: 'c_elec', name: 'Electronics & gadgets', icon: 'laptop', sort: 3 },
  { id: 'c_app', name: 'Home appliances', icon: 'fridge', sort: 4 },
  { id: 'c_furn', name: 'Furniture & fixtures', icon: 'sofa', sort: 5 },
  { id: 'c_jew', name: 'Jewellery & valuables', icon: 'gem', sort: 6 },
  { id: 'c_sav', name: 'Savings & investments', icon: 'piggy', sort: 7 },
  { id: 'c_dig', name: 'Digital & online', icon: 'globe', sort: 8 },
  { id: 'c_oth', name: 'Other', icon: 'package', sort: 9 },
];

const vehicle = () => [
  f('Make', 'text', { required: true }), f('Model', 'text', { required: true }), f('Variant'), f('Fuel', 'select', { options: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'] }),
  f('Manufacturing year', 'number'), f('Registration number', 'text', { required: true }), f('Chassis number'), f('Engine number'), f('Colour'),
  f('Odometer reading', 'number', { unit: 'km' }), f('FASTag ID'),
];
const gadget = (extra: FieldDef[] = []) => [f('Brand', 'text', { required: true }), f('Model', 'text', { required: true }), ...extra];
const appliance = (extra: FieldDef[] = []) => [f('Brand', 'text', { required: true }), f('Model'), ...extra];
const saving = (extra: FieldDef[] = []) => [
  f('Institution', 'text', { required: true }), f('Account reference (masked)', 'text', { required: false }), f('Invested amount', 'currency', { required: true }),
  f('Current value', 'currency'), f('Start date', 'date'), ...extra, f('Nominee'),
];
const maturity = () => [f('Maturity date', 'date'), f('Maturity value', 'currency'), f('Interest rate', 'number', { unit: '%' })];

export const SUBCATEGORIES: Subcategory[] = [
  { id: 's_car', categoryId: 'c_veh', name: 'Car', fields: vehicle(), valuation: 'depreciation', depRate: 15 },
  { id: 's_2w', categoryId: 'c_veh', name: 'Two-wheeler', fields: vehicle(), valuation: 'depreciation', depRate: 15 },
  { id: 's_cycle', categoryId: 'c_veh', name: 'Bicycle', fields: [f('Brand'), f('Model'), f('Frame number')], valuation: 'none' },
  { id: 's_flat', categoryId: 'c_prop', name: 'House / flat', fields: [f('Address', 'textarea', { required: true }), f('Property type', 'select', { options: ['Apartment', 'Independent house', 'Row house', 'Villa'] }), f('Built-up area', 'number', { unit: 'sq ft' }), f('Ownership', 'select', { options: ['Sole', 'Joint'] }), f('Sale deed number'), f('Registration date', 'date'), f('Property tax ID'), f('Society name')], valuation: 'manual' },
  { id: 's_land', categoryId: 'c_prop', name: 'Agricultural land', fields: [f('Survey / gat number', 'text', { required: true }), f('7/12 extract number'), f('Area', 'text', { unit: 'acre / guntha' }), f('Village'), f('Taluka'), f('District'), f('Ownership share', 'text')], valuation: 'manual' },
  { id: 's_plot', categoryId: 'c_prop', name: 'Plot', fields: [f('Address', 'textarea', { required: true }), f('Area', 'number', { unit: 'sq ft' }), f('Sale deed number')], valuation: 'manual' },
  { id: 's_mobile', categoryId: 'c_elec', name: 'Mobile', fields: gadget([f('IMEI', 'text'), f('Storage')]), valuation: 'depreciation', depRate: 20 },
  { id: 's_laptop', categoryId: 'c_elec', name: 'Laptop', fields: gadget([f('Serial number'), f('Processor'), f('RAM'), f('Storage'), f('Operating system')]), valuation: 'depreciation', depRate: 20 },
  { id: 's_tv', categoryId: 'c_elec', name: 'TV', fields: gadget([f('Screen size', 'number', { unit: 'inch' })]), valuation: 'depreciation', depRate: 20 },
  { id: 's_camera', categoryId: 'c_elec', name: 'Camera', fields: gadget(), valuation: 'depreciation', depRate: 20 },
  { id: 's_ac', categoryId: 'c_app', name: 'Air conditioner', fields: appliance([f('Tonnage', 'select', { options: ['1 T', '1.5 T', '2 T'] }), f('Room')]), valuation: 'none' },
  { id: 's_fridge', categoryId: 'c_app', name: 'Refrigerator', fields: appliance([f('Capacity', 'number', { unit: 'L' })]), valuation: 'none' },
  { id: 's_wm', categoryId: 'c_app', name: 'Washing machine', fields: appliance([f('Capacity', 'number', { unit: 'kg' })]), valuation: 'none' },
  { id: 's_ro', categoryId: 'c_app', name: 'Water purifier', fields: appliance([f('Filter change every', 'number', { unit: 'months' })]), valuation: 'none' },
  { id: 's_inverter', categoryId: 'c_app', name: 'Inverter', fields: appliance([f('Battery', 'text')]), valuation: 'none' },
  { id: 's_sofa', categoryId: 'c_furn', name: 'Sofa', fields: [f('Brand'), f('Material')], valuation: 'none' },
  { id: 's_kitchen', categoryId: 'c_furn', name: 'Modular kitchen', fields: [f('Vendor'), f('Material')], valuation: 'none' },
  { id: 's_gold', categoryId: 'c_jew', name: 'Gold', fields: [f('Item type', 'text', { required: true }), f('Weight', 'number', { unit: 'g', required: true }), f('Purity', 'select', { options: ['22K', '24K', '18K'] }), f('HUID hallmark'), f('Rate per gram at purchase', 'currency'), f('Making charges', 'currency'), f('Stored at', 'select', { options: ['Home', 'Bank locker'] })], valuation: 'manual' },
  { id: 's_watch', categoryId: 'c_jew', name: 'Luxury watch', fields: [f('Brand', 'text', { required: true }), f('Model'), f('Serial number')], valuation: 'manual' },
  { id: 's_fd', categoryId: 'c_sav', name: 'Fixed deposit', fields: saving(maturity()), valuation: 'manual' },
  { id: 's_ppf', categoryId: 'c_sav', name: 'PPF', fields: saving(maturity()), valuation: 'manual' },
  { id: 's_nps', categoryId: 'c_sav', name: 'NPS', fields: saving([f('PRAN (masked)')]), valuation: 'manual' },
  { id: 's_mf', categoryId: 'c_sav', name: 'Mutual funds', fields: saving([f('Folio (masked)'), f('SIP amount', 'currency'), f('SIP date', 'number')]), valuation: 'manual' },
  { id: 's_sgb', categoryId: 'c_sav', name: 'Sovereign gold bond', fields: saving([...maturity(), f('Units (g)', 'number')]), valuation: 'manual' },
  { id: 's_sub', categoryId: 'c_dig', name: 'Online subscription', fields: [f('Provider', 'text', { required: true }), f('Plan'), f('Billing cycle', 'select', { options: ['Monthly', 'Quarterly', 'Yearly'] }), f('Amount', 'currency'), f('Next renewal date', 'date'), f('Auto-renew', 'boolean'), f('Payment-method label'), f('Account email')], valuation: 'none' },
  { id: 's_domain', categoryId: 'c_dig', name: 'Domain', fields: [f('Domain name', 'text', { required: true }), f('Registrar'), f('Expiry date', 'date'), f('Auto-renew', 'boolean'), f('DNS provider')], valuation: 'none' },
  { id: 's_music', categoryId: 'c_oth', name: 'Musical instrument', fields: [f('Brand'), f('Model')], valuation: 'none' },
  { id: 's_other', categoryId: 'c_oth', name: 'Other', fields: [f('Description', 'textarea')], valuation: 'none' },
];

// PRD §6.7
export const STATUSES: StatusDef[] = [
  { id: 'st_active', name: 'Active / In use', tone: 'success', reasons: ['Purchased', 'Returned from repair', 'Found'] },
  { id: 'st_repair', name: 'In repair', tone: 'warning', reasons: ['Breakdown', 'Accident', 'Scheduled service'] },
  { id: 'st_storage', name: 'In storage', tone: 'neutral', reasons: ['Not in use', 'Seasonal'] },
  { id: 'st_lost', name: 'Lost / Stolen', tone: 'danger', reasons: ['Lost', 'Theft'] },
  { id: 'st_sold', name: 'Sold / Gifted / Scrapped', tone: 'neutral', reasons: ['Sold', 'Gifted', 'End of life', 'Damaged beyond repair'] },
];

// PRD §8.3
export const PRESETS: ReminderPreset[] = [
  { id: 'rp_0', label: 'At time of event', minutesBefore: 0 },
  { id: 'rp_15m', label: '15 minutes before', minutesBefore: 15 },
  { id: 'rp_1h', label: '1 hour before', minutesBefore: 60 },
  { id: 'rp_3h', label: '3 hours before', minutesBefore: 180 },
  { id: 'rp_1d', label: '1 day before, 9 AM', minutesBefore: 1440, isDefault: true },
  { id: 'rp_3d', label: '3 days before, 9 AM', minutesBefore: 4320 },
  { id: 'rp_5d', label: '5 days before, 9 AM', minutesBefore: 7200 },
  { id: 'rp_7d', label: '7 days before, 9 AM', minutesBefore: 10080 },
  { id: 'rp_15d', label: '15 days before, 9 AM', minutesBefore: 21600 },
  { id: 'rp_30d', label: '30 days before, 9 AM', minutesBefore: 43200 },
];

export const OBLIGATION_TYPES: { id: string; label: string; presets: string[] }[] = [
  { id: 'insurance_premium', label: 'Insurance premium', presets: ['rp_30d', 'rp_15d', 'rp_7d'] },
  { id: 'warranty_expiry', label: 'Warranty expiry', presets: ['rp_15d', 'rp_7d'] },
  { id: 'amc_renewal', label: 'AMC renewal', presets: ['rp_7d', 'rp_1d'] },
  { id: 'subscription_renewal', label: 'Subscription renewal', presets: ['rp_5d', 'rp_1d'] },
  { id: 'tax', label: 'Tax', presets: ['rp_30d', 'rp_7d'] },
  { id: 'puc', label: 'PUC', presets: ['rp_3d', 'rp_1d'] },
  { id: 'registration', label: 'Registration', presets: ['rp_30d', 'rp_7d'] },
  { id: 'loan_emi', label: 'Loan EMI', presets: ['rp_3d', 'rp_1d'] },
  { id: 'bill', label: 'Bill', presets: ['rp_3d', 'rp_1d'] },
  { id: 'maturity', label: 'Maturity', presets: ['rp_30d', 'rp_7d'] },
  { id: 'contribution', label: 'Contribution due', presets: ['rp_7d', 'rp_1d'] },
  { id: 'custom', label: 'Custom', presets: ['rp_1d'] },
];

// PRD §9.1
export const DOC_CATEGORIES = {
  person: ['Identity & KYC', 'Civil records', 'Education', 'Achievements & memories', 'Medical', 'Tax', 'Legal & estate'],
  asset: ['Purchase', 'Ownership', 'Coverage', 'Service', 'Payments'],
};

export const RELATIONS = ['Self', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandparent', 'Other'];

export const POLICY_TYPES: { id: string; label: string; group: 'asset' | 'person' | 'investment' }[] = [
  { id: 'motor', label: 'Motor', group: 'asset' }, { id: 'home', label: 'Home', group: 'asset' }, { id: 'gadget', label: 'Gadget', group: 'asset' }, { id: 'jewellery', label: 'Jewellery', group: 'asset' },
  { id: 'health', label: 'Health', group: 'person' }, { id: 'term', label: 'Term life', group: 'person' }, { id: 'personal_accident', label: 'Personal accident', group: 'person' }, { id: 'critical_illness', label: 'Critical illness', group: 'person' },
  { id: 'life', label: 'Life', group: 'investment' }, { id: 'endowment', label: 'Endowment', group: 'investment' }, { id: 'ulip', label: 'ULIP', group: 'investment' }, { id: 'travel', label: 'Travel', group: 'person' },
];

export const CONTACT_TYPES = ['service_provider', 'dealer', 'insurance_agent', 'doctor', 'ca', 'lawyer', 'family_friend', 'other'] as const;

// Plans (PRD §10.2 — prices indicative)
export const PLANS = [
  { id: 'individual', trialDays: 14, name: 'Individual', monthly: 99, yearly: 990, members: 0, assets: 100, storageGb: 5, ai: 10, modules: ['insurance', 'warranties', 'maintenance', 'qr', 'reports'], sharing: 'No', reminders: 'Push + WhatsApp' },
  { id: 'family', trialDays: 18, name: 'Family', monthly: 199, yearly: 1990, members: 4, assets: 300, storageGb: 20, ai: 30, modules: ['insurance', 'warranties', 'maintenance', 'qr', 'reports', 'health'], sharing: '7-day links', reminders: 'Push + WhatsApp' },
  { id: 'family_plus', trialDays: 28, name: 'Family Plus', monthly: 349, yearly: 3490, members: 8, assets: Infinity, storageGb: 50, ai: 100, modules: ['insurance', 'warranties', 'maintenance', 'qr', 'reports', 'health', 'savings'], sharing: 'Any expiry', reminders: 'Push + WhatsApp + email' },
] as const;
export type PlanId = (typeof PLANS)[number]['id'];
export const planOf = (id: string) => PLANS.find((p) => p.id === id) ?? PLANS[1];

export const MODULE_LABELS: Record<string, string> = {
  insurance: 'Insurance', warranties: 'Warranties & AMC', maintenance: 'Maintenance', savings: 'Savings & investments', health: 'Health records', qr: 'QR labels', reports: 'Reports',
};

export const COLORS = ['#0E9384', '#3B6FB6', '#C98A1B', '#8E5BC7', '#C2557A', '#5E8C31'];
