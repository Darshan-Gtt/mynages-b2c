import type { Asset, Coverage, Db, Doc, Event, Expense, Member, Obligation, ServiceLog, Task } from '../lib/types';
import { CATEGORIES, COLORS, PRESETS, STATUSES, SUBCATEGORIES, DOC_CATEGORIES } from './masters';
import { addDays, addMonths, today } from '../lib/utils';

export const DB_VERSION = 2;
const d = (n: number) => addDays(today(), n);
const ts = (n: number, h = 11) => `${d(n)}T${String(h).padStart(2, '0')}:15:00`;

/** Phone address book used by the "Import from phone" flow (VEN-07). */
export const PHONE_CONTACTS = [
  { name: 'Anil Plumber', phone: '9822113344' }, { name: 'Bharat Electricals', phone: '9890223311' }, { name: 'Dr. Kavita Shah (Dentist)', phone: '9823011122' },
  { name: 'Ganesh Car Wash', phone: '9765500111' }, { name: 'HDFC Bank RM — Pooja', phone: '9819911223' }, { name: 'Kalpesh (Society Secretary)', phone: '9850012000' },
  { name: 'Manoj Carpenter', phone: '9881234500' }, { name: 'Neha Sharma', phone: '9920011223' }, { name: 'Prakash LIC Agent', phone: '9922334411' },
  { name: 'Rahul Gupta', phone: '9811122233' }, { name: 'Shubham Pest Control', phone: '9767812345' }, { name: 'Vaishali Tuition', phone: '9970011223' },
];

const baseSettings = (familyName: string, ownerId: string): Db['settings'] => ({
  familyName, ownerId, language: 'English', currency: 'INR', timeZone: 'Asia/Kolkata', dateFormat: 'DD MMM YYYY', theme: 'light',
  notif: { reminders: { push: true, whatsapp: true, email: false }, tasks: { push: true, whatsapp: false, email: false }, invites: { push: true, whatsapp: true, email: false }, billing: { push: true, whatsapp: false, email: true } },
  quietHours: true,
  modules: { insurance: true, warranties: true, maintenance: true, savings: true, health: true, qr: true, reports: true },
  docCategories: structuredClone(DOC_CATEGORIES), consent: { analytics: true, marketing: false, whatsapp: true }, onboarded: true,
});

/** A new owner straight after sign-up — goes through first-run onboarding. */
export function createNewUserDb(name = 'Ananya Deshpande', mobile: string | undefined = '9123456780', opts: { dial?: string; email?: string; country?: string; currency?: string; tz?: string } = {}): Db {
  const me: Member = { id: 'm_me', name, relation: 'Self', mobile, dial: opts.dial, email: opts.email, state: 'self', role: 'owner', color: COLORS[0], createdAt: new Date().toISOString(), joinedAt: new Date().toISOString() };
  const s = baseSettings(`${name.split(' ')[0]}'s Family`, me.id);
  s.onboarded = false;
  if (opts.country) s.country = opts.country;
  if (opts.currency) s.currency = opts.currency;
  if (opts.tz) s.timeZone = opts.tz;
  return {
    version: DB_VERSION, settings: s,
    subscription: { planId: 'family', cycle: 'yearly', status: 'trialing', trialEndsAt: d(14), periodEnd: d(14), method: 'Not set', invoices: [] },
    members: [me], properties: [], categories: structuredClone(CATEGORIES), subcategories: structuredClone(SUBCATEGORIES), statuses: structuredClone(STATUSES),
    assets: [], valuations: [], coverages: [], obligations: [], tasks: [], docs: [], contacts: [], assetContacts: [], schedules: [], services: [], expenses: [], events: [],
    medical: [], vaccinations: [], nominees: [], notifications: [], presets: structuredClone(PRESETS), feedback: [], counters: {},
  };
}

export function createSampleDb(): Db {
  const M = (id: string, name: string, relation: string, state: Member['state'], role: Member['role'], i: number, extra: Partial<Member> = {}): Member =>
    ({ id, name, relation, state, role, color: COLORS[i % COLORS.length], createdAt: ts(-400), ...extra });
  const members: Member[] = [
    M('m_nitin', 'Nitin Kulkarni', 'Self', 'self', 'owner', 0, { mobile: '9876543210', email: 'nitin.kulkarni@gmail.com', dob: '1986-07-14', gender: 'male', joinedAt: ts(-400) }),
    M('m_sneha', 'Sneha Kulkarni', 'Spouse', 'joined', 'adult', 1, { mobile: '9876500011', email: 'sneha.k@gmail.com', dob: '1989-02-03', gender: 'female', joinedAt: ts(-157), invitedAt: ts(-158) }),
    M('m_aai', 'Sunanda Kulkarni', 'Mother', 'joined', 'view_only', 2, { mobile: '9822054320', dob: '1958-11-21', gender: 'female', joinedAt: ts(-120), invitedAt: ts(-121) }),
    M('m_baba', 'Vasant Kulkarni', 'Father', 'profile', undefined, 3, { dob: '1954-05-09', gender: 'male' }),
    M('m_aarav', 'Aarav Kulkarni', 'Son', 'profile', undefined, 4, { dob: '2012-09-17', gender: 'male' }),
    M('m_ira', 'Ira Kulkarni', 'Daughter', 'profile', undefined, 5, { dob: '2019-04-26', gender: 'female' }),
    M('m_rohan', 'Rohan Kulkarni', 'Brother', 'invited', 'adult', 0, { mobile: '9850098500', invitedAt: ts(-3), inviteExpiresAt: d(4), inviteChannel: 'whatsapp' }),
  ];
  const properties: Db['properties'] = [
    { id: 'p_baner', name: 'Baner flat', type: 'flat', city: 'Pune', address: 'B-1203, Sai Ganga Heights, Baner, Pune 411045' },
    { id: 'p_satara', name: 'Native home, Satara', type: 'house', city: 'Satara', address: 'Shivaji Peth, Satara 415002' },
    { id: 'p_wai', name: 'Farmland, Wai', type: 'land', city: 'Wai', address: 'Gat No. 214, Bavdhan, Tal. Wai, Dist. Satara' },
  ];

  let ac = 0;
  const A = (id: string, sub: string, name: string, owner: string, prop: string | undefined, cost: number | undefined, ago: number | undefined, fields: Asset['fields'], extra: Partial<Asset> = {}): Asset => {
    ac++;
    const s = SUBCATEGORIES.find((x) => x.id === sub)!;
    return {
      id, code: `AST-${String(ac).padStart(4, '0')}`, name, categoryId: s.categoryId, subcategoryId: sub, ownerMemberId: owner, propertyId: prop, statusId: 'st_active',
      purchaseCost: cost, purchaseDate: ago !== undefined ? d(-ago) : undefined, fields, tags: [], archived: false, color: COLORS[ac % COLORS.length],
      space: 'family', createdBy: owner === 'm_sneha' || owner === 'm_ira' ? 'm_sneha' : 'm_nitin', createdAt: ts(-(ago ?? 300)), ...extra,
    };
  };
  const assets: Asset[] = [
    A('a_flat', 's_flat', 'Baner 2BHK flat', 'm_nitin', 'p_baner', 78_00_000, 3600, { address: 'B-1203, Sai Ganga Heights, Baner, Pune 411045', property_type: 'Apartment', built_up_area: 1180, ownership: 'Joint', sale_deed_number: 'HVL-4/7712/2016', registration_date: d(-3590), property_tax_id: 'PMC/BNR/0412/1203', society_name: 'Sai Ganga Heights CHS' }, { tags: ['home'] }),
    A('a_native', 's_flat', 'Native home, Satara', 'm_baba', 'p_satara', 18_00_000, 9000, { address: 'Shivaji Peth, Satara 415002', property_type: 'Independent house', built_up_area: 1650, ownership: 'Sole', property_tax_id: 'SMC/SP/2214' }),
    A('a_land', 's_land', 'Farmland, Wai', 'm_baba', 'p_wai', 6_50_000, 10500, { survey_gat_number: 'Gat 214', '7_12_extract_number': '7/12-BVD-214', area: '2 acre 10 guntha', village: 'Bavdhan', taluka: 'Wai', district: 'Satara', ownership_share: '100%' }),
    A('a_innova', 's_car', 'Toyota Innova Crysta', 'm_nitin', 'p_baner', 24_60_000, 1000, { make: 'Toyota', model: 'Innova Crysta', variant: '2.4 ZX 7-seater', fuel: 'Diesel', manufacturing_year: 2023, registration_number: 'MH12 TK 4521', chassis_number: 'MBJ11AK41P0047821', colour: 'Silver', odometer_reading: 48_210, fastag_id: '34161FA820328E0400F1A2B3' }, { serialNo: 'MBJ11AK41P0047821', tags: ['car'] }),
    A('a_activa', 's_2w', 'Honda Activa 6G', 'm_sneha', 'p_baner', 82_000, 900, { make: 'Honda', model: 'Activa 6G', fuel: 'Petrol', manufacturing_year: 2023, registration_number: 'MH12 RT 8890', odometer_reading: 9_420 }),
    A('a_cycle', 's_cycle', 'Firefox Rapide cycle', 'm_aarav', 'p_baner', 14_500, 400, { brand: 'Firefox', model: 'Rapide 21S' }),
    A('a_macbook', 's_laptop', 'MacBook Air M2', 'm_nitin', 'p_baner', 1_14_900, 520, { brand: 'Apple', model: 'MacBook Air 13 M2', serial_number: 'C02HV1JQMD6T', processor: 'Apple M2', ram: '16 GB', storage: '512 GB', operating_system: 'macOS' }, { serialNo: 'C02HV1JQMD6T' }),
    A('a_iphone', 's_mobile', 'iPhone 15', 'm_nitin', 'p_baner', 79_900, 240, { brand: 'Apple', model: 'iPhone 15 128GB', imei: '35•••••••••4412', storage: '128 GB' }),
    A('a_galaxy', 's_mobile', 'Samsung Galaxy S23', 'm_sneha', 'p_baner', 64_999, 610, { brand: 'Samsung', model: 'Galaxy S23', imei: '35•••••••••8890', storage: '256 GB' }),
    A('a_tv', 's_tv', 'Samsung 55" QLED TV', 'm_nitin', 'p_baner', 69_990, 690, { brand: 'Samsung', model: 'QA55Q60C', screen_size: 55 }),
    A('a_ac', 's_ac', 'Daikin 1.5T split AC — bedroom', 'm_nitin', 'p_baner', 46_500, 1150, { brand: 'Daikin', model: 'FTKF50', tonnage: '1.5 T', room: 'Master bedroom' }),
    A('a_fridge', 's_fridge', 'LG 360 L refrigerator', 'm_sneha', 'p_baner', 41_990, 800, { brand: 'LG', model: 'GL-T382', capacity: 360 }),
    A('a_wm', 's_wm', 'LG front-load washing machine', 'm_sneha', 'p_baner', 36_490, 705, { brand: 'LG', model: 'FHM1207', capacity: 7 }),
    A('a_ro', 's_ro', 'Kent Grand+ RO purifier', 'm_sneha', 'p_baner', 18_500, 980, { brand: 'Kent', model: 'Grand Plus', filter_change_every: 6 }),
    A('a_inverter', 's_inverter', 'Luminous inverter', 'm_baba', 'p_satara', 22_000, 1500, { brand: 'Luminous', model: 'Zelio+ 1100', battery: 'Luminous RC18000 150Ah' }),
    A('a_sofa', 's_sofa', 'Urban Ladder 3-seater sofa', 'm_sneha', 'p_baner', 54_000, 1400, { brand: 'Urban Ladder', material: 'Fabric' }),
    A('a_kitchen', 's_kitchen', 'Modular kitchen', 'm_nitin', 'p_baner', 3_20_000, 3500, { vendor: 'Sleek', material: 'Acrylic finish' }),
    A('a_chain', 's_gold', 'Gold chain (mangalsutra)', 'm_aai', 'p_baner', 1_12_000, 2400, { item_type: 'Mangalsutra', weight: 20, purity: '22K', huid_hallmark: 'HUID AB12CD', rate_per_gram_at_purchase: 5200, stored_at: 'Bank locker' }),
    A('a_bangles', 's_gold', 'Gold bangles (pair)', 'm_sneha', undefined, 2_60_000, 1100, { item_type: 'Bangles', weight: 40, purity: '22K', huid_hallmark: 'HUID 7XK2P9', rate_per_gram_at_purchase: 6100, making_charges: 14_000, stored_at: 'Bank locker' }, { space: 'private', privateOwnerId: 'm_sneha', createdBy: 'm_sneha' }),
    A('a_fd', 's_fd', 'SBI fixed deposit', 'm_sneha', undefined, 5_00_000, 690, { institution: 'State Bank of India, Baner', account_reference_masked: 'XXXXXX4471', invested_amount: 500000, current_value: 573500, start_date: d(-690), maturity_date: d(40), maturity_value: 586500, interest_rate: 7.1, nominee: 'Nitin Kulkarni' }, { space: 'private', privateOwnerId: 'm_sneha', createdBy: 'm_sneha' }),
    A('a_ppf', 's_ppf', 'PPF account', 'm_nitin', undefined, 13_50_000, 3100, { institution: 'HDFC Bank', account_reference_masked: 'XXXX9921', invested_amount: 1350000, current_value: 2215000, start_date: d(-3100), maturity_date: d(2400), interest_rate: 7.1, nominee: 'Sneha Kulkarni' }),
    A('a_nps', 's_nps', 'NPS Tier I', 'm_nitin', undefined, 6_80_000, 2000, { institution: 'HDFC Pension Fund', invested_amount: 680000, current_value: 935000, start_date: d(-2000), pran_masked: 'XXXXXXXX3312', nominee: 'Sneha Kulkarni' }),
    A('a_mf', 's_mf', 'Mutual fund SIPs', 'm_nitin', undefined, 8_40_000, 1800, { institution: 'Groww · 4 funds', invested_amount: 840000, current_value: 1124000, start_date: d(-1800), folio_masked: 'XXXX/77', sip_amount: 15000, sip_date: 5, nominee: 'Sneha Kulkarni' }),
    A('a_sgb', 's_sgb', 'Sovereign gold bond 2021-22', 'm_aai', undefined, 1_45_000, 1600, { institution: 'RBI via SBI', invested_amount: 145000, current_value: 236000, start_date: d(-1600), maturity_date: d(1320), interest_rate: 2.5, units_g: 30, nominee: 'Nitin Kulkarni' }),
    A('a_netflix', 's_sub', 'Netflix Premium', 'm_nitin', undefined, undefined, 700, { provider: 'Netflix', plan: 'Premium 4K', billing_cycle: 'Monthly', amount: 649, next_renewal_date: d(6), auto_renew: true, payment_method_label: 'HDFC credit card ••21', account_email: 'nitin.kulkarni@gmail.com' }),
    A('a_domain', 's_domain', 'kulkarnifamily.in', 'm_nitin', undefined, 1_150, 2000, { domain_name: 'kulkarnifamily.in', registrar: 'GoDaddy', expiry_date: d(58), auto_renew: false, dns_provider: 'Cloudflare' }),
    A('a_guitar', 's_music', 'Yamaha F310 acoustic guitar', 'm_aarav', 'p_baner', 9_900, 300, { brand: 'Yamaha', model: 'F310' }),
  ];
  assets.find((a) => a.id === 'a_ac')!.statusId = 'st_repair';
  assets.find((a) => a.id === 'a_cycle')!.parentId = undefined;
  const ac2 = assets.length;

  const valuations: Db['valuations'] = [
    { id: 'v1', assetId: 'a_flat', date: d(-2200), value: 92_00_000, by: 'm_nitin' }, { id: 'v2', assetId: 'a_flat', date: d(-1100), value: 1_05_00_000, by: 'm_nitin' },
    { id: 'v3', assetId: 'a_flat', date: d(-60), value: 1_15_00_000, by: 'm_nitin', note: 'Broker estimate' },
    { id: 'v4', assetId: 'a_native', date: d(-400), value: 45_00_000, by: 'm_nitin' }, { id: 'v5', assetId: 'a_land', date: d(-300), value: 32_00_000, by: 'm_nitin', note: 'Ready reckoner + local rate' },
    { id: 'v6', assetId: 'a_chain', date: d(-20), value: 1_48_000, by: 'm_nitin', note: '₹7,400/g 22K' }, { id: 'v7', assetId: 'a_bangles', date: d(-20), value: 2_96_000, by: 'm_sneha' },
    { id: 'v8', assetId: 'a_ppf', date: d(-240), value: 20_60_000, by: 'm_nitin' }, { id: 'v9', assetId: 'a_ppf', date: d(-5), value: 22_15_000, by: 'm_nitin' },
    { id: 'v10', assetId: 'a_mf', date: d(-365), value: 9_10_000, by: 'm_nitin' }, { id: 'v11', assetId: 'a_mf', date: d(-180), value: 10_20_000, by: 'm_nitin' }, { id: 'v12', assetId: 'a_mf', date: d(-5), value: 11_24_000, by: 'm_nitin' },
    { id: 'v13', assetId: 'a_nps', date: d(-5), value: 9_35_000, by: 'm_nitin' }, { id: 'v14', assetId: 'a_sgb', date: d(-5), value: 2_36_000, by: 'm_aai' }, { id: 'v15', assetId: 'a_fd', date: d(-5), value: 5_73_500, by: 'm_sneha' },
  ];

  const cov: Coverage[] = [];
  const C = (id: string, p: Partial<Coverage> & Pick<Coverage, 'kind' | 'provider' | 'number' | 'startDate' | 'endDate'>) =>
    cov.push({ id, linkedType: p.assetId ? 'asset' : 'member', insured: [], space: 'family', createdBy: 'm_nitin', createdAt: ts(-300), ...p });
  C('cv_innova', { kind: 'insurance', policyType: 'motor', assetId: 'a_innova', provider: 'ICICI Lombard', number: '3001/2147/88412/00/000', sumInsured: 16_50_000, premium: 34_860, premiumFrequency: 'yearly', startDate: d(-354), endDate: d(11), agentContactId: 'ct_ashwini' });
  C('cv_innova_old', { kind: 'insurance', policyType: 'motor', assetId: 'a_innova', provider: 'ICICI Lombard', number: '3001/2147/71208/00/000', sumInsured: 19_80_000, premium: 37_210, premiumFrequency: 'yearly', startDate: d(-719), endDate: d(-355), supersededById: 'cv_innova' });
  C('cv_activa', { kind: 'insurance', policyType: 'motor', assetId: 'a_activa', provider: 'Bajaj Allianz', number: 'OG-26-1901-1802-00011234', sumInsured: 58_000, premium: 2_150, premiumFrequency: 'yearly', startDate: d(-370), endDate: d(-5), createdBy: 'm_sneha' });
  C('cv_flat', { kind: 'insurance', policyType: 'home', assetId: 'a_flat', provider: 'HDFC ERGO', number: '2311 2026 7712 9900 000', sumInsured: 50_00_000, premium: 6_480, premiumFrequency: 'yearly', startDate: d(-165), endDate: d(200) });
  C('cv_iphone', { kind: 'insurance', policyType: 'gadget', assetId: 'a_iphone', provider: 'OneAssist', number: 'OA-MOB-88213412', sumInsured: 79_900, premium: 4_999, premiumFrequency: 'yearly', startDate: d(-240), endDate: d(125) });
  C('cv_mac', { kind: 'extended_warranty', assetId: 'a_macbook', provider: 'AppleCare+', number: 'AC+ C02HV1JQMD6T', startDate: d(-520), endDate: d(575), premium: 19_900 });
  C('cv_tv', { kind: 'warranty', assetId: 'a_tv', provider: 'Samsung India', number: 'Warranty card QA55-77120', startDate: d(-690), endDate: d(40) });
  C('cv_ac_w', { kind: 'warranty', assetId: 'a_ac', provider: 'Daikin', number: 'DKN-WTY-50021', startDate: d(-1150), endDate: d(-55) });
  C('cv_ac_amc', { kind: 'amc', assetId: 'a_ac', provider: 'Suresh Electricals (Daikin authorised)', number: 'AMC/2026/118', startDate: d(-300), endDate: d(65), premium: 2_800, agentContactId: 'ct_suresh' });
  C('cv_fridge', { kind: 'warranty', assetId: 'a_fridge', provider: 'LG Electronics', number: 'Compressor warranty 10Y', startDate: d(-800), endDate: d(2850) });
  C('cv_wm', { kind: 'warranty', assetId: 'a_wm', provider: 'LG Electronics', number: 'LG-WM-2Y-55120', startDate: d(-705), endDate: d(25), createdBy: 'm_sneha' });
  C('cv_ro', { kind: 'amc', assetId: 'a_ro', provider: 'Kent RO Systems', number: 'KENT-AMC-PUN-99123', startDate: d(-353), endDate: d(12), premium: 3_600, agentContactId: 'ct_ramesh', createdBy: 'm_sneha' });
  C('cv_health', { kind: 'insurance', policyType: 'health', provider: 'Star Health', number: 'P/151111/01/2026/007712', sumInsured: 10_00_000, premium: 28_400, premiumFrequency: 'yearly', startDate: d(-293), endDate: d(72), insured: [{ memberId: 'm_nitin', cover: 10_00_000 }, { memberId: 'm_sneha', cover: 10_00_000 }, { memberId: 'm_aarav', cover: 10_00_000 }, { memberId: 'm_ira', cover: 10_00_000 }], nominee: 'Sneha Kulkarni', agentContactId: 'ct_ashwini' });
  C('cv_senior', { kind: 'insurance', policyType: 'health', provider: 'Niva Bupa', number: '31220011223344', sumInsured: 5_00_000, premium: 46_800, premiumFrequency: 'yearly', startDate: d(-347), endDate: d(18), insured: [{ memberId: 'm_aai', cover: 5_00_000 }, { memberId: 'm_baba', cover: 5_00_000 }] });
  C('cv_term', { kind: 'insurance', policyType: 'term', provider: 'HDFC Life', number: '24671198', sumInsured: 1_00_00_000, premium: 18_500, premiumFrequency: 'yearly', startDate: d(-1780), endDate: addMonths(today(), 300), insured: [{ memberId: 'm_nitin', cover: 1_00_00_000 }], nominee: 'Sneha Kulkarni' });
  C('cv_lic', { kind: 'insurance', policyType: 'endowment', provider: 'LIC of India', number: '9154 4471 22', sumInsured: 3_00_000, premium: 6_820, premiumFrequency: 'quarterly', startDate: d(-5200), endDate: d(780), maturityDate: d(780), maturityValue: 5_60_000, insured: [{ memberId: 'm_aai', cover: 3_00_000 }], nominee: 'Nitin Kulkarni', agentContactId: 'ct_prakash' });

  const obs: Obligation[] = [];
  const O = (id: string, title: string, type: Obligation['type'], due: number, p: Partial<Obligation> = {}) =>
    obs.push({ id, title, type, dueDate: d(due), recurrence: 'none', autoRenew: false, reminders: ['rp_7d', 'rp_1d'], status: 'open', space: 'family', createdBy: 'm_nitin', createdAt: ts(-60), ...p });
  O('ob_innova', 'Renew motor insurance — Innova', 'insurance_premium', 11, { assetId: 'a_innova', coverageId: 'cv_innova', amount: 34_860, recurrence: 'yearly', reminders: ['rp_30d', 'rp_15d', 'rp_7d'], contactId: 'ct_ashwini' });
  O('ob_activa', 'Renew motor insurance — Activa', 'insurance_premium', -5, { assetId: 'a_activa', coverageId: 'cv_activa', amount: 2_150, recurrence: 'yearly', reminders: ['rp_15d', 'rp_7d'], createdBy: 'm_sneha' });
  O('ob_flat_ins', 'Renew home insurance — Baner flat', 'insurance_premium', 200, { assetId: 'a_flat', coverageId: 'cv_flat', amount: 6_480, recurrence: 'yearly', reminders: ['rp_30d', 'rp_7d'] });
  O('ob_health', 'Star Health family floater premium', 'insurance_premium', 72, { memberId: 'm_nitin', coverageId: 'cv_health', amount: 28_400, recurrence: 'yearly', reminders: ['rp_30d', 'rp_15d', 'rp_7d'], contactId: 'ct_ashwini' });
  O('ob_senior', 'Niva Bupa senior citizen policy — Aai & Baba', 'insurance_premium', 18, { memberId: 'm_aai', coverageId: 'cv_senior', amount: 46_800, recurrence: 'yearly', reminders: ['rp_30d', 'rp_15d', 'rp_7d'] });
  O('ob_term', 'HDFC Life term premium', 'insurance_premium', 45, { memberId: 'm_nitin', coverageId: 'cv_term', amount: 18_500, recurrence: 'yearly', reminders: ['rp_30d', 'rp_7d'] });
  O('ob_lic', 'LIC premium — Aai', 'insurance_premium', 22, { memberId: 'm_aai', coverageId: 'cv_lic', amount: 6_820, recurrence: 'quarterly', reminders: ['rp_15d', 'rp_3d'], contactId: 'ct_prakash' });
  O('ob_tv_w', 'Warranty expiry — Samsung TV', 'warranty_expiry', 40, { assetId: 'a_tv', coverageId: 'cv_tv', reminders: ['rp_15d', 'rp_7d'] });
  O('ob_wm_w', 'Warranty expiry — LG washing machine', 'warranty_expiry', 25, { assetId: 'a_wm', coverageId: 'cv_wm', reminders: ['rp_15d', 'rp_7d'], createdBy: 'm_sneha' });
  O('ob_ro_amc', 'Renew Kent RO AMC', 'amc_renewal', 12, { assetId: 'a_ro', coverageId: 'cv_ro', amount: 3_600, recurrence: 'yearly', reminders: ['rp_7d', 'rp_1d'], contactId: 'ct_ramesh' });
  O('ob_ac_amc', 'Renew AC AMC — Daikin', 'amc_renewal', 65, { assetId: 'a_ac', coverageId: 'cv_ac_amc', amount: 2_800, recurrence: 'yearly' });
  O('ob_puc_innova', 'PUC certificate — Innova', 'puc', 19, { assetId: 'a_innova', amount: 150, recurrence: 'half_yearly', reminders: ['rp_3d', 'rp_1d'] });
  O('ob_puc_activa', 'PUC certificate — Activa', 'puc', -2, { assetId: 'a_activa', amount: 100, recurrence: 'half_yearly', reminders: ['rp_3d', 'rp_1d'], createdBy: 'm_sneha' });
  O('ob_ptax', 'Property tax — Baner flat (PMC)', 'tax', 28, { assetId: 'a_flat', amount: 18_400, recurrence: 'yearly', reminders: ['rp_30d', 'rp_7d'] });
  O('ob_ptax_satara', 'Property tax — Satara house', 'tax', 95, { assetId: 'a_native', amount: 4_200, recurrence: 'yearly', reminders: ['rp_30d', 'rp_7d'] });
  O('ob_society', 'Society maintenance — Sai Ganga CHS', 'bill', 5, { assetId: 'a_flat', amount: 4_500, recurrence: 'monthly', reminders: ['rp_3d'] });
  O('ob_elec', 'Electricity bill — MSEDCL', 'bill', 8, { assetId: 'a_flat', amount: 3_200, recurrence: 'monthly', reminders: ['rp_3d', 'rp_1d'], createdBy: 'm_sneha' });
  O('ob_emi', 'Home loan EMI — HDFC', 'loan_emi', 9, { assetId: 'a_flat', amount: 42_300, recurrence: 'monthly', reminders: ['rp_3d', 'rp_1d'] });
  O('ob_fd', 'FD maturity — SBI', 'maturity', 40, { assetId: 'a_fd', amount: 5_86_500, reminders: ['rp_30d', 'rp_7d'], space: 'private', privateOwnerId: 'm_sneha', createdBy: 'm_sneha' });
  O('ob_ppf', 'PPF yearly contribution', 'contribution', 125, { assetId: 'a_ppf', amount: 1_50_000, recurrence: 'yearly', reminders: ['rp_30d', 'rp_7d'] });
  O('ob_sip', 'SIP debit — ₹15,000', 'contribution', 3, { assetId: 'a_mf', amount: 15_000, recurrence: 'monthly', reminders: ['rp_1d'] });
  O('ob_netflix', 'Netflix renews', 'subscription_renewal', 6, { assetId: 'a_netflix', amount: 649, recurrence: 'monthly', autoRenew: true, reminders: ['rp_5d', 'rp_1d'] });
  O('ob_domain', 'Domain renewal — kulkarnifamily.in', 'subscription_renewal', 58, { assetId: 'a_domain', amount: 1_150, recurrence: 'yearly', reminders: ['rp_30d', 'rp_5d'] });
  O('ob_fastag', 'FASTag recharge — Innova', 'bill', 4, { assetId: 'a_innova', amount: 1_000, recurrence: 'monthly', reminders: ['rp_1d'] });
  O('ob_locker', 'Bank locker rent — SBI Baner', 'bill', 34, { amount: 4_130, recurrence: 'yearly', reminders: ['rp_7d'], memberId: 'm_nitin' });
  O('ob_society_old', 'Society maintenance — Sai Ganga CHS', 'bill', -25, { assetId: 'a_flat', amount: 4_500, status: 'completed', completedAt: ts(-26), completedBy: 'm_nitin' });
  O('ob_elec_old', 'Electricity bill — MSEDCL', 'bill', -22, { assetId: 'a_flat', amount: 2_980, status: 'completed', completedAt: ts(-23), completedBy: 'm_sneha' });

  const tasks: Task[] = [];
  const T = (id: string, title: string, assignee: string, due: number, p: Partial<Task> = {}) =>
    tasks.push({ id, title, assigneeId: assignee, dueDate: d(due), priority: 'medium', status: 'pending', recurrence: 'none', reminders: ['rp_1d'], space: 'family', createdBy: 'm_nitin', createdAt: ts(-6), ...p });
  T('t1', 'Get 3 renewal quotes for Innova insurance', 'm_sneha', 4, { assetId: 'a_innova', priority: 'high', dueTime: '18:00', description: 'Compare ICICI Lombard, Tata AIG and HDFC ERGO — zero-dep + RSA.' });
  T('t2', 'Renew Activa PUC at Baner petrol pump', 'm_nitin', -1, { assetId: 'a_activa', priority: 'high', createdBy: 'm_sneha' });
  T('t3', 'Cancel Netflix before renewal if not watching', 'm_nitin', 5, { assetId: 'a_netflix', priority: 'low' });
  T('t4', 'Book Baba’s eye check-up at H.V. Desai', 'm_sneha', 10, { memberId: 'm_baba', priority: 'medium' });
  T('t5', 'Upload Ira’s updated vaccination card', 'm_sneha', 2, { memberId: 'm_ira' });
  T('t6', 'Get AC compressor repaired — not cooling', 'm_nitin', 1, { assetId: 'a_ac', priority: 'high', status: 'in_progress', description: 'Suresh Electricals visited; gas refill + capacitor quote ₹4,200.' });
  T('t7', 'Change RO filter', 'm_aai', 14, { assetId: 'a_ro', recurrence: 'quarterly', createdBy: 'm_sneha' });
  T('t8', 'Take Aai’s BP medicine refill', 'm_sneha', 0, { memberId: 'm_aai', dueTime: '19:30', recurrence: 'monthly' });
  T('t9', 'Service Innova — 50,000 km', 'm_nitin', 30, { assetId: 'a_innova' });
  T('t10', 'Pay Satara property tax online', 'm_nitin', -12, { assetId: 'a_native', status: 'done', completedAt: ts(-12), completedBy: 'm_nitin' });
  T('t11', 'Collect FD renewal form from SBI', 'm_sneha', 35, { assetId: 'a_fd', space: 'private', privateOwnerId: 'm_sneha', createdBy: 'm_sneha' });

  const docs: Doc[] = [];
  let dn = 0;
  const D = (ownerType: Doc['ownerType'], ownerId: string, title: string, category: string, p: Partial<Doc> = {}) => {
    dn++;
    docs.push({ id: `doc${dn}`, title, category, ownerType, ownerId, tags: [], fileName: `${title.replace(/[^\w]+/g, '_').slice(0, 36)}.pdf`, size: 140_000 + dn * 23_117, pages: 1 + (dn % 4), space: 'family', createdBy: 'm_nitin', createdAt: ts(-100 - dn * 7), ...p });
  };
  D('member', 'm_nitin', 'Aadhaar card', 'Identity & KYC', { number: 'XXXX XXXX 4412', issuer: 'UIDAI', fileName: 'aadhaar_nitin.jpg', pages: 2, starred: true });
  D('member', 'm_nitin', 'PAN card', 'Identity & KYC', { number: 'ABCPK1234F', issuer: 'Income Tax Dept.' });
  D('member', 'm_nitin', 'Passport', 'Identity & KYC', { number: 'Z1234567', issuer: 'RPO Pune', issueDate: d(-2700), expiryDate: d(950) });
  D('member', 'm_nitin', 'Driving licence', 'Identity & KYC', { number: 'MH12 20080012345', issuer: 'RTO Pune', expiryDate: d(2100) });
  D('member', 'm_sneha', 'Aadhaar card', 'Identity & KYC', { number: 'XXXX XXXX 8890', issuer: 'UIDAI', createdBy: 'm_sneha' });
  D('member', 'm_sneha', 'Driving licence', 'Identity & KYC', { number: 'MH12 20110067890', issuer: 'RTO Pune', expiryDate: d(20), createdBy: 'm_sneha' });
  D('member', 'm_aai', 'Aadhaar card', 'Identity & KYC', { number: 'XXXX XXXX 1209', issuer: 'UIDAI' });
  D('member', 'm_aai', 'Senior citizen card', 'Identity & KYC', { issuer: 'Satara Municipal Council' });
  D('member', 'm_aarav', 'Birth certificate', 'Civil records', { number: 'PMC/B/2012/77120', issuer: 'Pune Municipal Corporation' });
  D('member', 'm_aarav', 'Class 7 report card', 'Education', { issuer: 'DPS Pune', createdBy: 'm_sneha' });
  D('member', 'm_ira', 'Vaccination card', 'Medical', { issuer: 'Surya Child Care', createdBy: 'm_sneha' });
  D('member', 'm_nitin', 'ITR-V AY 2026-27', 'Tax', { number: 'ACK 512345678901126', issuer: 'Income Tax Dept.', issueDate: d(-110) });
  D('member', 'm_nitin', 'Marriage certificate', 'Civil records', { number: 'MC/PUN/2011/4412' });
  D('member', 'm_baba', 'Registered will', 'Legal & estate', { issuer: 'Sub-Registrar Satara', issueDate: d(-1200), notes: 'Original in bank locker' });
  D('member', 'm_baba', 'Cataract surgery discharge summary', 'Medical', { issuer: 'H.V. Desai Eye Hospital', issueDate: d(-210) });
  D('asset', 'a_flat', 'Sale deed', 'Ownership', { number: 'HVL-4/7712/2016', issuer: 'Sub-Registrar Haveli 4', issueDate: d(-3590), pages: 42, starred: true });
  D('asset', 'a_flat', 'Property tax receipt 2025-26', 'Payments', { number: 'PMC/PT/2526/88120', issueDate: d(-340) });
  D('asset', 'a_flat', 'Home insurance policy', 'Coverage', { number: '2311 2026 7712 9900 000', issuer: 'HDFC ERGO', expiryDate: d(200) });
  D('asset', 'a_innova', 'Registration certificate (RC)', 'Ownership', { number: 'MH12TK4521', issuer: 'RTO Pune' });
  D('asset', 'a_innova', 'Purchase invoice', 'Purchase', { number: 'KT/INV/2023/1182', issuer: 'Kothari Toyota' });
  D('asset', 'a_innova', 'Motor policy 2025-26', 'Coverage', { number: '3001/2147/88412/00/000', issuer: 'ICICI Lombard', expiryDate: d(11) });
  D('asset', 'a_innova', 'PUC certificate', 'Coverage', { number: 'PUC/MH12/558812', expiryDate: d(19) });
  D('asset', 'a_activa', 'Registration certificate (RC)', 'Ownership', { number: 'MH12RT8890', createdBy: 'm_sneha' });
  D('asset', 'a_macbook', 'Purchase invoice', 'Purchase', { number: 'IMAG/2024/99812', issuer: 'Imagine Store Pune' });
  D('asset', 'a_tv', 'Purchase invoice + warranty card', 'Purchase', { number: 'CRM/PN/7712', issuer: 'Croma Baner', pages: 2 });
  D('asset', 'a_ac', 'Purchase invoice', 'Purchase', { number: 'VS/AC/2023/4471', issuer: 'Vijay Sales' });
  D('asset', 'a_wm', 'Warranty card', 'Coverage', { issuer: 'LG Electronics', expiryDate: d(25), createdBy: 'm_sneha' });
  D('asset', 'a_chain', 'Purchase bill — PNG Jewellers', 'Purchase', { number: 'PNG/2019/22198', issuer: 'PNG Jewellers' });
  D('asset', 'a_bangles', 'Purchase bill — Tanishq', 'Purchase', { number: 'TNQ/PUN/2023/8812', issuer: 'Tanishq', space: 'private', privateOwnerId: 'm_sneha', createdBy: 'm_sneha' });
  D('asset', 'a_fd', 'FD receipt', 'Ownership', { number: 'XXXXXX4471', issuer: 'SBI Baner', space: 'private', privateOwnerId: 'm_sneha', createdBy: 'm_sneha' });
  D('asset', 'a_land', '7/12 extract', 'Ownership', { number: '7/12-BVD-214', issuer: 'Talathi, Bavdhan', issueDate: d(-300) });
  D('member', 'm_nitin', 'Star Health policy document', 'Medical', { number: 'P/151111/01/2026/007712', issuer: 'Star Health', expiryDate: d(72) });

  const contacts: Db['contacts'] = [
    { id: 'ct_imran', name: 'Imran Khan', type: 'dealer', phone: '9767123456', notes: 'Kothari Toyota service advisor' },
    { id: 'ct_ashwini', name: 'Ashwini Deshpande', type: 'insurance_agent', phone: '9823344556', email: 'ashwini.d@icicilombard.com' },
    { id: 'ct_ramesh', name: 'Ramesh Pawar (RO technician)', type: 'service_provider', phone: '9822041177' },
    { id: 'ct_suresh', name: 'Suresh Electricals', type: 'service_provider', phone: '9890112200', notes: 'Daikin authorised — AC service' },
    { id: 'ct_drmeena', name: 'Dr. Meena Joshi', type: 'doctor', phone: '9822988776', notes: 'Family physician, Baner' },
    { id: 'ct_drrao', name: 'Dr. Pradeep Rao', type: 'doctor', phone: '9881100223', notes: 'Paediatrician — Surya Child Care' },
    { id: 'ct_vivek', name: 'CA Vivek Gokhale', type: 'ca', phone: '9850077665', email: 'vivek@gokhaleassociates.in' },
    { id: 'ct_shirish', name: 'Adv. Shirish Patwardhan', type: 'lawyer', phone: '9822500411' },
    { id: 'ct_mahesh', name: 'Mahesh Jadhav (Satara caretaker)', type: 'family_friend', phone: '9767700112' },
    { id: 'ct_prakash', name: 'Prakash Joshi (LIC agent)', type: 'insurance_agent', phone: '9922334411', fromPhone: true },
  ];
  const assetContacts: Db['assetContacts'] = [
    { id: 'm1', assetId: 'a_innova', contactId: 'ct_imran', purpose: 'Service & repair' }, { id: 'm2', assetId: 'a_innova', contactId: 'ct_ashwini', purpose: 'Insurance renewal & claims' },
    { id: 'm3', assetId: 'a_ro', contactId: 'ct_ramesh', purpose: 'Repair: RO technician' }, { id: 'm4', assetId: 'a_ac', contactId: 'ct_suresh', purpose: 'Service & AMC' },
    { id: 'm5', assetId: 'a_native', contactId: 'ct_mahesh', purpose: 'Caretaker' }, { id: 'm6', assetId: 'a_land', contactId: 'ct_mahesh', purpose: 'Caretaker' },
    { id: 'm7', assetId: 'a_flat', contactId: 'ct_shirish', purpose: 'Property documents' },
  ];
  const schedules: Db['schedules'] = [
    { id: 'sc1', assetId: 'a_innova', title: 'Periodic service (10,000 km / 6 months)', intervalDays: 182, nextDue: d(30), contactId: 'ct_imran', active: true },
    { id: 'sc2', assetId: 'a_ac', title: 'AC service before summer', intervalDays: 365, nextDue: d(95), contactId: 'ct_suresh', active: true },
    { id: 'sc3', assetId: 'a_ro', title: 'RO filter change', intervalDays: 90, nextDue: d(14), contactId: 'ct_ramesh', active: true },
    { id: 'sc4', assetId: 'a_activa', title: 'Two-wheeler service', intervalDays: 120, nextDue: d(-6), active: true },
  ];
  const services: ServiceLog[] = [
    { id: 'sv1', assetId: 'a_innova', date: d(-85), provider: 'Kothari Toyota, Baner', workDone: '40,000 km periodic service; wiper blades and cabin filter', cost: 14_860, reading: '40,212 km', scheduleId: 'sc1', createdBy: 'm_nitin' },
    { id: 'sv2', assetId: 'a_innova', date: d(-255), provider: 'Kothari Toyota, Baner', workDone: '30,000 km service; brake pads', cost: 11_420, reading: '30,780 km', createdBy: 'm_nitin' },
    { id: 'sv3', assetId: 'a_ac', date: d(-7), provider: 'Suresh Electricals', workDone: 'Low cooling — gas leak at flare joint; quote for gas refill', cost: 450, createdBy: 'm_nitin' },
    { id: 'sv4', assetId: 'a_ro', date: d(-76), provider: 'Ramesh Pawar', workDone: 'Sediment + carbon filter replaced (AMC)', cost: 0, scheduleId: 'sc3', createdBy: 'm_sneha' },
    { id: 'sv5', assetId: 'a_activa', date: d(-126), provider: 'Honda Wings, Aundh', workDone: 'General service, oil change', cost: 1_150, reading: '8,900 km', createdBy: 'm_sneha' },
    { id: 'sv6', assetId: 'a_wm', date: d(-200), provider: 'LG service', workDone: 'Drain pump cleaned (warranty)', cost: 0, createdBy: 'm_sneha' },
  ];
  const expenses: Expense[] = services.filter((s) => s.cost > 0).map((s) => ({ id: `ex_${s.id}`, assetId: s.assetId, date: s.date, type: 'Service', amount: s.cost, paidBy: s.createdBy, ref: `SRV:${s.id}`, createdBy: s.createdBy }));
  const E = (id: string, assetId: string, ago: number, type: string, amount: number, paidBy: string, notes?: string) => expenses.push({ id, assetId, date: d(-ago), type, amount, paidBy, notes, createdBy: paidBy });
  E('e1', 'a_innova', 354, 'Insurance', 34_860, 'm_nitin', 'Motor policy 2025-26'); E('e2', 'a_innova', 18, 'Fuel', 6_420, 'm_nitin', 'Diesel — Nov'); E('e3', 'a_innova', 48, 'Fuel', 7_150, 'm_nitin', 'Diesel — Oct');
  E('e4', 'a_innova', 120, 'Accessories', 12_500, 'm_nitin', 'Seat covers + dashcam'); E('e5', 'a_flat', 400, 'Repairs & painting', 85_000, 'm_nitin', 'Full flat painting — Asian Paints');
  E('e6', 'a_flat', 340, 'Tax', 18_400, 'm_nitin', 'Property tax 2025-26'); E('e7', 'a_flat', 25, 'Society maintenance', 4_500, 'm_nitin'); E('e8', 'a_activa', 15, 'Fuel', 950, 'm_sneha');
  E('e9', 'a_ac', 300, 'AMC', 2_800, 'm_nitin'); E('e10', 'a_ro', 353, 'AMC', 3_600, 'm_sneha'); E('e11', 'a_kitchen', 200, 'Repairs & painting', 6_800, 'm_sneha', 'Chimney filter + hinge');
  E('e12', 'a_netflix', 24, 'Subscription', 649, 'm_nitin'); E('e13', 'a_netflix', 54, 'Subscription', 649, 'm_nitin'); E('e14', 'a_native', 12, 'Tax', 4_200, 'm_nitin');

  const medical: Db['medical'] = [
    { id: 'md1', memberId: 'm_aai', type: 'lab_report', date: d(-30), title: 'HbA1c & lipid profile', hospital: 'Metropolis Labs', doctorContactId: 'ct_drmeena', notes: 'HbA1c 6.4 — continue diet control', createdBy: 'm_sneha' },
    { id: 'md2', memberId: 'm_aai', type: 'prescription', date: d(-30), title: 'BP + thyroid medicines', doctorContactId: 'ct_drmeena', createdBy: 'm_sneha' },
    { id: 'md3', memberId: 'm_baba', type: 'discharge_summary', date: d(-210), title: 'Cataract surgery — right eye', hospital: 'H.V. Desai Eye Hospital', createdBy: 'm_nitin', docId: 'doc15' },
    { id: 'md4', memberId: 'm_ira', type: 'prescription', date: d(-45), title: 'Viral fever', doctorContactId: 'ct_drrao', createdBy: 'm_sneha' },
    { id: 'md5', memberId: 'm_nitin', type: 'lab_report', date: d(-150), title: 'Annual health check-up', hospital: 'Ruby Hall Clinic', createdBy: 'm_nitin' },
  ];
  const vaccinations: Db['vaccinations'] = [
    { id: 'vx1', memberId: 'm_ira', itemType: 'vaccination', name: 'MMR booster', dueDate: d(-400), givenDate: d(-398), provider: 'Surya Child Care', status: 'done' },
    { id: 'vx2', memberId: 'm_ira', itemType: 'vaccination', name: 'Typhoid conjugate', dueDate: d(-10), provider: 'Surya Child Care', status: 'due' },
    { id: 'vx3', memberId: 'm_ira', itemType: 'vaccination', name: 'Influenza (annual)', dueDate: d(20), provider: 'Surya Child Care', status: 'due' },
    { id: 'vx4', memberId: 'm_aarav', itemType: 'vaccination', name: 'HPV dose 1', dueDate: d(60), provider: 'Surya Child Care', status: 'due' },
    { id: 'vx5', memberId: 'm_aai', itemType: 'vaccination', name: 'Influenza (annual)', dueDate: d(-60), givenDate: d(-58), status: 'done' },
    { id: 'vx6', memberId: 'm_baba', itemType: 'checkup', name: 'Eye check-up (post cataract)', dueDate: d(15), provider: 'H.V. Desai Eye Hospital', status: 'due' },
    { id: 'vx7', memberId: 'm_nitin', itemType: 'checkup', name: 'Annual health check-up', dueDate: d(215), provider: 'Ruby Hall Clinic', status: 'due' },
    { id: 'vx8', memberId: 'm_aai', itemType: 'checkup', name: 'Diabetes review', dueDate: d(60), provider: 'Dr. Meena Joshi', status: 'due' },
  ];
  const nominees: Db['nominees'] = [
    { id: 'nm1', name: 'Sneha Kulkarni', relationship: 'Spouse', memberId: 'm_sneha', access: 'active', items: [{ type: 'asset', id: 'a_ppf' }, { type: 'asset', id: 'a_nps' }, { type: 'coverage', id: 'cv_term' }, { type: 'document', id: 'doc12' }], createdAt: ts(-140) },
    { id: 'nm2', name: 'Rohan Kulkarni', relationship: 'Brother', mobile: '9850098500', access: 'pending', items: [{ type: 'asset', id: 'a_land' }, { type: 'document', id: 'doc14' }], createdAt: ts(-3) },
  ];

  const events: Event[] = [];
  const EV = (assetId: string | undefined, at: string, by: string, type: string, text: string, reason?: string, priv?: string) => events.push({ id: `ev${events.length}`, assetId, at, by, type, text, reason, space: priv ? 'private' : 'family', privateOwnerId: priv });
  for (const a of assets) EV(a.id, a.createdAt, a.createdBy, 'created', `Added ${a.name}`, undefined, a.space === 'private' ? a.privateOwnerId : undefined);
  for (const c of cov.filter((x) => x.assetId)) EV(c.assetId, c.createdAt, c.createdBy, 'coverage', `${c.kind === 'insurance' ? 'Insurance' : c.kind === 'amc' ? 'AMC' : 'Warranty'} ${c.number} added`);
  for (const s of services) EV(s.assetId, `${s.date}T16:00:00`, s.createdBy, 'service', `Service logged: ${s.workDone}`, s.cost ? `₹${s.cost.toLocaleString('en-IN')}` : undefined);
  EV('a_ac', ts(-7, 18), 'm_nitin', 'status', 'Status Active → In repair', 'Breakdown — low cooling');
  EV(undefined, ts(-157), 'm_sneha', 'family', 'Sneha joined the family');
  EV(undefined, ts(-120), 'm_aai', 'family', 'Sunanda joined the family (view-only)');
  EV(undefined, ts(-3), 'm_nitin', 'family', 'Invite sent to Rohan on WhatsApp');
  EV('a_wm', ts(-2, 20), 'm_sneha', 'document', 'Document added: Warranty card');

  const notifications: Db['notifications'] = [
    { id: 'n1', userId: 'all', text: 'Motor insurance for Innova expires in 11 days', link: '/assets/a_innova#coverage', at: ts(-1, 9), read: false, kind: 'reminder' },
    { id: 'n2', userId: 'm_sneha', text: 'Nitin assigned you: Get 3 renewal quotes for Innova insurance', link: '/tasks', at: ts(-6), read: false, kind: 'assignment' },
    { id: 'n3', userId: 'all', text: 'Activa insurance lapsed 5 days ago — renew now', link: '/assets/a_activa#coverage', at: ts(-4, 9), read: false, kind: 'reminder' },
    { id: 'n4', userId: 'm_nitin', text: 'Rohan hasn’t accepted your invite yet — it expires in 4 days', link: '/more/family', at: ts(-1, 10), read: true, kind: 'invite' },
    { id: 'n5', userId: 'm_sneha', text: 'Your FD at SBI matures in 40 days', link: '/assets/a_fd', at: ts(-2, 9), read: false, kind: 'reminder' },
    { id: 'n6', userId: 'm_nitin', text: 'Payment received — Family Plus yearly · invoice MYN-INV-2026-4412', link: '/more/settings/plan', at: ts(-155), read: true, kind: 'billing' },
  ];

  return {
    version: DB_VERSION, settings: baseSettings('Kulkarni Family', 'm_nitin'),
    subscription: {
      planId: 'family_plus', cycle: 'yearly', status: 'active', periodEnd: d(210), method: 'UPI autopay · nitin@okhdfcbank',
      invoices: [
        { no: 'MYN-INV-2026-4412', date: d(-155), planId: 'family_plus', cycle: 'yearly', amount: 3490, gst: 628, status: 'paid', method: 'UPI autopay' },
        { no: 'MYN-INV-2025-1187', date: d(-520), planId: 'family', cycle: 'yearly', amount: 1990, gst: 358, status: 'paid', method: 'Card ••21' },
      ],
    },
    members, properties, categories: structuredClone(CATEGORIES), subcategories: structuredClone(SUBCATEGORIES), statuses: structuredClone(STATUSES),
    assets, valuations, coverages: cov, obligations: obs, tasks, docs, contacts, assetContacts, schedules, services, expenses, events, medical, vaccinations, nominees, notifications,
    presets: structuredClone(PRESETS), feedback: [], counters: { AST: ac2 },
  };
}
