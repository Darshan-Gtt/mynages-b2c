import { planOf, PLANS } from '../data/masters';
import type { Db, Member, Space } from './types';

type Ownable = { space: Space; privateOwnerId?: string; createdBy?: string };

/** Private items are visible only to their owner; family items to every joined member (PRD §4.1, AC-15). */
export const visible = (x: Ownable, me: Member | null) => !!me && (x.space === 'family' || x.privateOwnerId === me.id);

/** Items of the active space (Family workspace or My private space). */
export const inSpace = (x: Ownable, space: Space, me: Member | null) => !!me && (space === 'family' ? x.space === 'family' : x.space === 'private' && x.privateOwnerId === me.id);

export const isOwner = (me: Member | null) => me?.role === 'owner';

/** Role rules (PRD §4.4). View-only members can manage only their own private space. */
export function canEdit(me: Member | null, x?: Ownable): boolean {
  if (!me) return false;
  if (!x) return me.role === 'owner' || me.role === 'adult';
  if (x.space === 'private') return x.privateOwnerId === me.id;
  return me.role === 'owner' || me.role === 'adult';
}
export const canCreateIn = (me: Member | null, space: Space) => !!me && (space === 'private' || me.role === 'owner' || me.role === 'adult');
export const canMoveSpace = (me: Member | null, x: Ownable) => !!me && (me.role === 'owner' || x.createdBy === me.id || x.privateOwnerId === me.id);

export interface Gate { ok: boolean; reason?: string; limit?: string; suggest?: (typeof PLANS)[number] }

/** Entitlement checks (PRD §10.3): subscription state, asset / member limits, plan modules. */
export function entitlement(db: Db, kind: 'write' | 'asset' | 'member' | `module:${string}`): Gate {
  const sub = db.subscription;
  const plan = planOf(sub.planId);
  if (sub.status === 'expired') return { ok: false, reason: 'Your subscription has ended. You can still view, search and export; adding and editing are paused.', limit: 'Subscription expired', suggest: plan };
  if (kind === 'write') return { ok: true };
  if (kind === 'asset') {
    const used = db.assets.filter((a) => !a.archived).length;
    if (used >= plan.assets) return { ok: false, reason: `Your ${plan.name} plan allows ${plan.assets} assets and you have ${used}.`, limit: `${plan.assets} assets`, suggest: PLANS.find((p) => p.assets > used) };
    return { ok: true };
  }
  if (kind === 'member') {
    const used = db.members.filter((m) => m.state === 'joined' || m.state === 'invited').length;
    if (used >= plan.members) return { ok: false, reason: plan.members === 0 ? `The ${plan.name} plan is for one person — family members can’t join.` : `Your ${plan.name} plan includes the Owner + ${plan.members} members and all slots are used.`, limit: plan.members === 0 ? 'Owner only' : `Owner + ${plan.members}`, suggest: PLANS.find((p) => p.members > used) };
    return { ok: true };
  }
  const mod = kind.slice(7);
  if (!(plan.modules as readonly string[]).includes(mod)) return { ok: false, reason: `This module isn’t included in the ${plan.name} plan.`, limit: 'Module not in plan', suggest: PLANS.find((p) => (p.modules as readonly string[]).includes(mod)) };
  return { ok: true };
}

export const moduleOn = (db: Db, mod: keyof Db['settings']['modules']) => db.settings.modules[mod] !== false && entitlement(db, `module:${mod}`).ok;
