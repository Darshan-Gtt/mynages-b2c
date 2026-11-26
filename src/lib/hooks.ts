import { useMemo } from 'react';
import { useDb } from './store';
import { useMe, useSpace } from './session';
import { inSpace, visible } from './access';

/** Records of the active space (family workspace or my private space), already permission-filtered. */
export function useActive() {
  const db = useDb();
  const me = useMe();
  const space = useSpace();
  return useMemo(() => {
    const f = <T extends { space: 'family' | 'private'; privateOwnerId?: string }>(xs: T[]) => xs.filter((x) => inSpace(x, space, me));
    return {
      db, me: me!, space,
      assets: f(db.assets).filter((a) => !a.archived),
      archived: f(db.assets).filter((a) => a.archived),
      obligations: f(db.obligations),
      tasks: f(db.tasks),
      docs: f(db.docs),
      coverages: f(db.coverages),
      events: f(db.events),
    };
  }, [db, me, space]);
}

/** Everything the signed-in member may see (both spaces) — for search and cross views. */
export function useVisible() {
  const db = useDb();
  const me = useMe();
  return useMemo(() => {
    const f = <T extends { space: 'family' | 'private'; privateOwnerId?: string }>(xs: T[]) => xs.filter((x) => visible(x, me));
    return { db, me: me!, assets: f(db.assets), obligations: f(db.obligations), tasks: f(db.tasks), docs: f(db.docs), coverages: f(db.coverages), events: f(db.events) };
  }, [db, me]);
}
