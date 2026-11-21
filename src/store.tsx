import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as db from './lib/db';
import type { AppData, HabitDay, ISODate, Settings } from './lib/types';

type Row = { id?: string; date?: string };
interface Store {
  data: AppData;
  upsert: (store: db.StoreName, row: object) => Promise<void>;
  remove: (store: db.StoreName, key: string) => Promise<void>;
  /** Merge fields into a day's habits, based on the latest state (safe for rapid taps). */
  patchHabit: (date: ISODate, patch: Partial<HabitDay>) => Promise<void>;
  setSettings: (s: Settings) => Promise<void>;
  replaceAll: (d: AppData) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
const keyOf = (store: db.StoreName, r: Row) => (store === 'habits' ? r.date : r.id);
const blankDay = (date: ISODate): HabitDay => ({ date, breakfast: false, lunch: false, carbs: false, preSnack: false, shake: false, treat: false });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<AppData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<AppData | null>(null);
  // Writes are queued so they land in IndexedDB in the order they were made.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const commit = useCallback((next: AppData, write: () => Promise<void>) => {
    ref.current = next;
    setDataState(next);
    const p = queue.current.then(write);
    queue.current = p.catch((e) => setErr(String(e)));
    return p;
  }, []);

  useEffect(() => {
    db.loadAll().then((d) => { ref.current = d; setDataState(d); }, (e) => setErr(String(e)));
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  const upsert = useCallback((store: db.StoreName, obj: object) => {
    const row = obj as Row;
    const d = ref.current!;
    const list = (d[store] as Row[]).filter((r) => keyOf(store, r) !== keyOf(store, row));
    return commit({ ...d, [store]: [...list, row] }, () => db.put(store, row));
  }, [commit]);

  const remove = useCallback((store: db.StoreName, key: string) => {
    const d = ref.current!;
    return commit({ ...d, [store]: (d[store] as Row[]).filter((r) => keyOf(store, r) !== key) }, () => db.del(store, key));
  }, [commit]);

  const patchHabit = useCallback((date: ISODate, patch: Partial<HabitDay>) => {
    const cur = ref.current!.habits.find((h) => h.date === date) ?? blankDay(date);
    return upsert('habits', { ...cur, ...patch, date });
  }, [upsert]);

  const setSettings = useCallback((s: Settings) => commit({ ...ref.current!, settings: s }, () => db.saveSettings(s)), [commit]);

  const replaceAll = useCallback((nd: AppData) => commit(nd, () => db.replaceAll(nd)), [commit]);

  if (err) return <div className="page"><p>Could not use on-device storage: {err}</p></div>;
  if (!data) return <div className="page muted">Loading…</div>;
  return <Ctx.Provider value={{ data, upsert, remove, patchHabit, setSettings, replaceAll }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
