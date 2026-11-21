import { openDB, type IDBPDatabase } from 'idb';
import { seedData } from './seed';
import type { AppData, Settings } from './types';

export const STORES = ['waist', 'weight', 'lifts', 'runs', 'habits'] as const;
export type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  dbp ??= openDB('dfwme', 1, {
    upgrade(d) {
      for (const s of STORES) d.createObjectStore(s, { keyPath: s === 'habits' ? 'date' : 'id' });
      d.createObjectStore('meta');
    },
  });
  return dbp;
}

const DEFAULT_SETTINGS: Settings = { minimumPlan: false };

export async function loadAll(): Promise<AppData> {
  const d = await db();
  if (!(await d.get('meta', 'seeded'))) {
    const seed = seedData();
    const tx = d.transaction([...STORES, 'meta'], 'readwrite');
    for (const s of STORES) for (const row of seed[s]) await tx.objectStore(s).put(row);
    await tx.objectStore('meta').put(true, 'seeded');
    await tx.done;
  }
  const [waist, weight, lifts, runs, habits, settings] = await Promise.all([
    ...STORES.map((s) => d.getAll(s)),
    d.get('meta', 'settings'),
  ]);
  return { waist, weight, lifts, runs, habits, settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) } } as AppData;
}

export async function put(store: StoreName, row: unknown) {
  await (await db()).put(store, row);
}
export async function del(store: StoreName, key: string) {
  await (await db()).delete(store, key);
}
export async function saveSettings(s: Settings) {
  await (await db()).put('meta', s, 'settings');
}

/* ---------- Backup ---------- */

export const EXPORT_FORMAT = 'dfwme-backup';

export function toExport(data: AppData) {
  return { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), ...data };
}

export function validateImport(obj: unknown): AppData {
  if (!obj || typeof obj !== 'object') throw new Error('Not a JSON object');
  const o = obj as Record<string, unknown>;
  if (o.format !== EXPORT_FORMAT) throw new Error('This file is not a DFWME backup');
  for (const s of STORES) if (!Array.isArray(o[s])) throw new Error(`Missing "${s}" list`);
  return {
    waist: o.waist, weight: o.weight, lifts: o.lifts, runs: o.runs, habits: o.habits,
    settings: { ...DEFAULT_SETTINGS, ...((o.settings as object) ?? {}) },
  } as AppData;
}

/** Replaces everything on this device with the given data. */
export async function replaceAll(data: AppData) {
  const d = await db();
  const tx = d.transaction([...STORES, 'meta'], 'readwrite');
  for (const s of STORES) {
    await tx.objectStore(s).clear();
    for (const row of data[s]) await tx.objectStore(s).put(row);
  }
  await tx.objectStore('meta').put(true, 'seeded');
  await tx.objectStore('meta').put(data.settings, 'settings');
  await tx.done;
}
