import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { del, loadAll, put, replaceAll, toExport, validateImport } from './db';

describe('db', () => {
  it('seeds once, persists, and round-trips export/import', async () => {
    const a = await loadAll();
    expect(a.waist.length).toBe(4);
    expect(a.weight.length).toBe(3);
    expect(a.runs.length).toBe(4);
    await put('weight', { id: 'x', date: '2026-11-21', lb: 205 });
    const b = await loadAll();
    expect(b.weight.length).toBe(4); // not re-seeded
    const json = JSON.parse(JSON.stringify(toExport(b)));
    await del('weight', 'x');
    await replaceAll({ ...b, weight: [], runs: [] });
    expect((await loadAll()).weight.length).toBe(0);
    await replaceAll(validateImport(json));
    const c = await loadAll();
    expect(c.weight.length).toBe(4);
    expect(c.runs.length).toBe(4);
    expect(() => validateImport({ foo: 1 })).toThrow();
  });
});
