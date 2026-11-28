// B2C (family) data model — PRD v2.1 sections 4–10 and Appendix A.1/A.2, simplified for a browser demo.

export type ID = string;
export type Space = 'family' | 'private';
export type FamilyRole = 'owner' | 'adult' | 'view_only';
export type MemberState = 'self' | 'profile' | 'invited' | 'joined' | 'declined' | 'removed';
export type Recurrence = 'none' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';

/** family_members — a profile until the person joins; joined members can sign in. */
export interface Member {
  id: ID;
  name: string;
  relation: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  mobile?: string;
  /** Country dial code without '+'; India (91) when absent. */
  dial?: string;
  email?: string;
  state: MemberState;
  role?: FamilyRole;
  invitedAt?: string;
  inviteExpiresAt?: string;
  inviteChannel?: 'whatsapp' | 'sms';
  joinedAt?: string;
  color: string;
  createdAt: string;
}

export interface Property {
  id: ID;
  name: string;
  type: 'flat' | 'house' | 'farmhouse' | 'land' | 'office' | 'other';
  city: string;
  address?: string;
}

export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'select' | 'boolean' | 'textarea';
export interface FieldDef {
  id: ID;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  unit?: string;
  section?: string;
}

export interface Category { id: ID; name: string; icon: string; sort: number; custom?: boolean }
export interface Subcategory {
  id: ID;
  categoryId: ID;
  name: string;
  fields: FieldDef[];
  valuation: 'manual' | 'depreciation' | 'none';
  depRate?: number;
  custom?: boolean;
}

export interface StatusDef { id: ID; name: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral'; reasons: string[] }

interface Owned {
  space: Space;
  privateOwnerId?: ID; // member id when space = private
  createdBy: ID;
  createdAt: string;
  updatedBy?: ID;
  updatedAt?: string;
}

export interface Asset extends Owned {
  id: ID;
  code: string;
  name: string;
  categoryId: ID;
  subcategoryId: ID;
  ownerMemberId: ID;
  propertyId?: ID;
  statusId: ID;
  serialNo?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  vendorContactId?: ID;
  invoiceNo?: string;
  fields: Record<string, string | number | boolean>;
  tags: string[];
  notes?: string;
  parentId?: ID;
  /** Up to 5 photos (resized data URLs). */
  photos?: string[];
  archived: boolean;
  color: string;
}

export interface Valuation { id: ID; assetId: ID; date: string; value: number; by: ID; note?: string }

export type CoverageKind = 'insurance' | 'warranty' | 'extended_warranty' | 'amc';
export type PolicyType =
  | 'motor' | 'home' | 'gadget' | 'jewellery' | 'health' | 'term' | 'life' | 'personal_accident' | 'critical_illness' | 'endowment' | 'ulip' | 'travel';

/** insurance_policies + warranties + amc_contracts — linked to an asset or to family members (PRD §6.2). */
export interface Coverage extends Owned {
  id: ID;
  kind: CoverageKind;
  policyType?: PolicyType;
  linkedType: 'asset' | 'member';
  assetId?: ID;
  insured: { memberId: ID; cover?: number }[];
  provider: string;
  number: string;
  sumInsured?: number;
  premium?: number;
  premiumFrequency?: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'single';
  startDate: string;
  endDate: string;
  maturityDate?: string;
  maturityValue?: number;
  nominee?: string;
  agentContactId?: ID;
  /** Insurer / brand helpline or branch contact. */
  providerContactId?: ID;
  supersededById?: ID;
}

export type ObligationType =
  | 'insurance_premium' | 'warranty_expiry' | 'amc_renewal' | 'subscription_renewal' | 'tax' | 'puc' | 'registration' | 'loan_emi' | 'bill' | 'maturity' | 'contribution' | 'custom';

export interface Obligation extends Owned {
  id: ID;
  title: string;
  type: ObligationType;
  /** Name the user gave when the type is "custom" (e.g. "Gas cylinder booking"). */
  customType?: string;
  assetId?: ID;
  memberId?: ID;
  coverageId?: ID;
  /** Expiry reminder created for a document. */
  docId?: ID;
  amount?: number;
  dueDate: string;
  dueTime?: string;
  recurrence: Recurrence;
  /** For recurrence "custom": the next dates the user picked, as YYYY-MM-DDTHH:mm. */
  customDates?: string[];
  autoRenew: boolean;
  reminders: ID[];
  contactId?: ID;
  status: 'open' | 'completed' | 'cancelled';
  completedAt?: string;
  completedBy?: ID;
  snoozedUntil?: string;
}

export interface Task extends Owned {
  id: ID;
  title: string;
  description?: string;
  assetId?: ID;
  memberId?: ID;
  assigneeId: ID;
  dueDate: string;
  dueTime?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  recurrence: Recurrence;
  customDates?: string[];
  reminders: ID[];
  completedAt?: string;
  completedBy?: ID;
}

export interface Doc extends Owned {
  id: ID;
  title: string;
  category: string;
  ownerType: 'asset' | 'member';
  ownerId: ID;
  number?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  tags: string[];
  notes?: string;
  /** Values of the category's own fields (Settings → Document categories). */
  fields?: Record<string, string | number | boolean>;
  fileName: string;
  size: number;
  pages: number;
  starred?: boolean;
}

export interface Contact {
  id: ID;
  name: string;
  type: 'service_provider' | 'dealer' | 'insurance_agent' | 'doctor' | 'ca' | 'lawyer' | 'family_friend' | 'other';
  phone: string;
  email?: string;
  notes?: string;
  /** What they do, when the type is "other" (e.g. Gardener). */
  role?: string;
  fromPhone?: boolean;
}

export interface AssetContact { id: ID; assetId: ID; contactId: ID; purpose: string }

export interface Schedule { id: ID; assetId: ID; title: string; intervalDays: number; nextDue: string; contactId?: ID; active: boolean }

export interface ServiceLog { id: ID; assetId: ID; date: string; provider: string; workDone: string; cost: number; reading?: string; scheduleId?: ID; contactId?: ID; createdBy: ID }

export interface Expense { id: ID; assetId: ID; date: string; type: string; amount: number; paidBy: ID; notes?: string; ref?: string; createdBy: ID }

export interface Event { id: ID; assetId?: ID; at: string; by: ID; type: string; text: string; reason?: string; space: Space; privateOwnerId?: ID }

export interface MedicalRecord { id: ID; memberId: ID; type: 'prescription' | 'lab_report' | 'discharge_summary' | 'scan' | 'other'; date: string; title: string; hospital?: string; doctorContactId?: ID; notes?: string; docId?: ID; createdBy: ID }

export interface Vaccination { id: ID; memberId: ID; itemType: 'vaccination' | 'checkup'; name: string; dueDate?: string; givenDate?: string; provider?: string; status: 'due' | 'done' | 'skipped' }

export interface Nominee { id: ID; name: string; relationship: string; memberId?: ID; mobile?: string; dial?: string; email?: string; access: 'pending' | 'active' | 'revoked'; items: { type: 'asset' | 'document' | 'coverage'; id: ID }[]; createdAt: string }

export interface Notification { id: ID; userId: ID | 'all'; text: string; link?: string; at: string; read: boolean; kind: 'reminder' | 'invite' | 'assignment' | 'share' | 'billing' | 'system' }

/** minutesBefore counts back from the due date & time; with atTime (HH:mm) it means "N days before, at this time". */
export interface ReminderPreset { id: ID; label: string; minutesBefore: number; atTime?: string; isDefault?: boolean }

export interface Invoice { no: string; date: string; planId: string; cycle: 'monthly' | 'yearly'; amount: number; gst: number; status: 'paid' | 'failed' | 'refunded'; method: string }

export interface Subscription {
  planId: 'individual' | 'family' | 'family_plus';
  cycle: 'monthly' | 'yearly';
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  trialEndsAt?: string;
  periodEnd: string;
  method: string;
  pendingPlanId?: 'individual' | 'family' | 'family_plus';
  invoices: Invoice[];
}

export interface Settings {
  familyName: string;
  ownerId: ID;
  language: string;
  currency: string;
  country?: string;
  address?: string;
  timeZone: string;
  dateFormat: string;
  theme: 'light' | 'dark' | 'auto';
  notif: Record<'reminders' | 'tasks' | 'invites' | 'billing', { push: boolean; whatsapp: boolean; email: boolean }>;
  quietHours: boolean;
  modules: Record<'insurance' | 'warranties' | 'maintenance' | 'savings' | 'health' | 'qr' | 'reports', boolean>;
  docCategories: { asset: string[]; person: string[] };
  /** Extra fields per document category, keyed "asset:Insurance" / "person:Medical". */
  docFields?: Record<string, FieldDef[]>;
  /** Reminder types the family created with "Custom", offered again next time. */
  reminderTypes?: string[];
  consent: { analytics: boolean; marketing: boolean; whatsapp: boolean };
  onboarded: boolean;
}

export interface Feedback { id: ID; type: string; subject: string; text: string; at: string; by: ID }

export interface Db {
  version: number;
  settings: Settings;
  subscription: Subscription;
  members: Member[];
  properties: Property[];
  categories: Category[];
  subcategories: Subcategory[];
  statuses: StatusDef[];
  assets: Asset[];
  valuations: Valuation[];
  coverages: Coverage[];
  obligations: Obligation[];
  tasks: Task[];
  docs: Doc[];
  contacts: Contact[];
  assetContacts: AssetContact[];
  schedules: Schedule[];
  services: ServiceLog[];
  expenses: Expense[];
  events: Event[];
  medical: MedicalRecord[];
  vaccinations: Vaccination[];
  nominees: Nominee[];
  notifications: Notification[];
  presets: ReminderPreset[];
  feedback: Feedback[];
  counters: Record<string, number>;
}
