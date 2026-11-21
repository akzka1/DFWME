import { useState } from 'react';
import { Legend, LineChart } from '../components/LineChart';
import { Check, Icon, Seg, Sheet, num } from '../components/ui';
import { fmtDow, fmtDuration, fmtPace, fmtShort, parseClock, today, uid } from '../lib/dates';
import { EASY_PACE_SEC, avgPace, carbComparison, mile1Fast, noRecentEasyRun } from '../lib/calc';
import type { Run } from '../lib/types';
import { useStore } from '../store';

export function RunView() {
  const { data, upsert, remove } = useStore();
  const [editing, setEditing] = useState<Run | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const runs = [...data.runs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const chrono = [...runs].reverse();
  const noEasy = noRecentEasyRun(data.runs, today());
  const cmp = carbComparison(data.runs);

  const blank: Run = { id: uid(), date: today(), distance: 0, timeSec: 0, splits: [], kind: 'easy', carbSnack: false };

  return (
    <div className="page">
      {noEasy && (
        <div className="note">No run at 9:30/mi or slower in the past 7 days. If one of this week's runs can be easy, that's an option.</div>
      )}
      <button className="btn primary block" onClick={() => setEditing(blank)}><Icon name="plus" /> Log run</button>

      <section className="card">
        <h2>Pace over time</h2>
        <LineChart
          ariaLabel="Average pace and mile 1 pace per run"
          series={[
            { id: 'avg', label: 'Avg pace', color: 'var(--series-1)', points: chrono.map((r) => ({ x: r.date, y: avgPace(r) })), mode: 'both' },
            { id: 'm1', label: 'Mile 1', color: 'var(--series-2)', points: chrono.filter((r) => r.splits.length && r.distance >= 1).map((r) => ({ x: r.date, y: r.splits[0] })), mode: 'both' },
          ]}
          yFmt={fmtPace}
          invertY
          minYSpan={45}
          yStep={30}
        />
        <Legend items={[{ label: 'Average pace', color: 'var(--series-1)' }, { label: 'Mile 1 pace', color: 'var(--series-2)' }]} />
        <div className="muted small">Faster is higher. A gap between the lines is mile 1 running ahead of the average.</div>
      </section>

      <section className="card">
        <h2>Runs</h2>
        {!runs.length && <div className="muted">No runs yet.</div>}
        <div className="list">
          {runs.map((r) => {
            const fast = mile1Fast(r);
            const pace = avgPace(r);
            return (
              <div key={r.id}>
                <div className="list-item" onClick={() => setOpen(open === r.id ? null : r.id)} style={{ cursor: 'pointer' }}>
                  <div className="main">
                    <span><strong>{r.distance.toFixed(2)} mi</strong> · {fmtPace(pace)}/mi <span className="muted small">{fmtDow(r.date)} {fmtShort(r.date)}</span></span>
                    <span className="muted small">
                      {fmtDuration(r.timeSec)}{r.hr ? ` · HR ${r.hr}` : ''}{r.elevFt ? ` · ${r.elevFt} ft` : ''}{r.tempF !== undefined ? ` · ${r.tempF}°F` : ''}
                      {r.carbSnack === true ? ' · carb snack' : r.carbSnack === false ? ' · no snack' : ''}
                    </span>
                    {fast !== null && <span className="small flag">Mile 1 {fmtPace(r.splits[0])} — {Math.round(fast)}s faster than avg</span>}
                  </div>
                  <span className={r.kind === 'easy' ? 'tag blue' : 'tag'}>{r.kind === 'easy' ? 'Easy' : 'Hard'}</span>
                </div>
                {open === r.id && (
                  <div style={{ paddingBottom: 12 }}>
                    <table className="tbl">
                      <thead><tr><th>Mile</th><th>Pace</th><th>vs avg</th></tr></thead>
                      <tbody>
                        {r.splits.map((s, i) => {
                          const partial = i === r.splits.length - 1 && r.distance % 1 > 0.01 && i + 1 > Math.floor(r.distance);
                          const d = s - pace;
                          return (
                            <tr key={i}>
                              <td>{partial ? `${(r.distance - i).toFixed(2)} (partial)` : i + 1}</td>
                              <td>{fmtPace(s)}</td>
                              <td className="muted">{d === 0 ? '0' : `${d > 0 ? '+' : '−'}${Math.round(Math.abs(d))}s`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {r.note && <p className="muted small">{r.note}</p>}
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="btn small" onClick={() => setEditing(r)}><Icon name="edit" /> Edit</button>
                      <button className="btn small danger" onClick={() => confirm('Delete this run?') && remove('runs', r.id)}><Icon name="trash" /> Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Pre-run carb snack</h2>
        <table className="tbl">
          <thead><tr><th></th><th>Runs</th><th>Avg pace</th><th>Avg HR</th><th>Fast mile 1</th></tr></thead>
          <tbody>
            {([['Snack', cmp.yes], ['No snack', cmp.no]] as const).map(([l, g]) => (
              <tr key={l}><td>{l}</td><td>{g.n}</td><td>{g.n ? fmtPace(g.pace) : '–'}</td><td>{isFinite(g.hr) ? Math.round(g.hr) : '–'}</td><td>{g.n ? g.mile1Flags : '–'}</td></tr>
            ))}
          </tbody>
        </table>
        {cmp.unknown > 0 && <div className="muted small">{cmp.unknown} run{cmp.unknown === 1 ? '' : 's'} with snack not recorded (excluded).</div>}
      </section>

      {editing && <RunForm initial={editing} onClose={() => setEditing(null)} onSave={async (r) => { await upsert('runs', r); setEditing(null); }} />}
    </div>
  );
}

function RunForm({ initial, onClose, onSave }: { initial: Run; onClose: () => void; onSave: (r: Run) => Promise<void> }) {
  const [date, setDate] = useState(initial.date);
  const [dist, setDist] = useState(initial.distance ? String(initial.distance) : '');
  const [time, setTime] = useState(initial.timeSec ? fmtDuration(initial.timeSec) : '');
  const [hr, setHr] = useState(initial.hr ? String(initial.hr) : '');
  const [elev, setElev] = useState(initial.elevFt !== undefined ? String(initial.elevFt) : '');
  const [temp, setTemp] = useState(initial.tempF !== undefined ? String(initial.tempF) : '');
  const [splits, setSplits] = useState<string[]>(initial.splits.map(fmtPace));
  const [kind, setKind] = useState<Run['kind']>(initial.kind);
  const [kindTouched, setKindTouched] = useState(!!initial.distance);
  const [snack, setSnack] = useState<boolean | undefined>(initial.carbSnack);
  const [note, setNote] = useState(initial.note ?? '');

  const d = num(dist) ?? 0;
  const t = parseClock(time);
  const pace = d > 0 && isFinite(t) ? t / d : NaN;
  const nSplits = d > 0 ? Math.ceil(d - 0.001) : 0;
  const shownSplits = Array.from({ length: nSplits }, (_, i) => splits[i] ?? '');
  const autoKind: Run['kind'] = isFinite(pace) && pace >= EASY_PACE_SEC ? 'easy' : 'hard';
  const effKind = kindTouched ? kind : isFinite(pace) ? autoKind : kind;
  const m1 = parseClock(shownSplits[0] ?? '');
  const m1Fast = d >= 1 && isFinite(m1) && isFinite(pace) && pace - m1 > 15;
  const valid = d > 0 && isFinite(t) && t > 0;

  const save = () => {
    if (!valid) return;
    onSave({
      id: initial.id, date, distance: d, timeSec: t, hr: num(hr), elevFt: num(elev), tempF: num(temp),
      splits: shownSplits.map(parseClock).filter((x) => isFinite(x)), kind: effKind, carbSnack: snack, note: note.trim() || undefined,
    });
  };

  return (
    <Sheet title={initial.distance ? 'Edit run' : 'Log run'} onClose={onClose}>
      <div className="grid2">
        <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} /></label>
        <label className="field">Distance (mi)<input type="number" inputMode="decimal" step="0.01" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="5.30" /></label>
        <label className="field">Total time<input type="text" inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} placeholder="43:30" /></label>
        <div className="stat"><span className="label">Avg pace</span><span className="value">{fmtPace(pace)}<small>/mi</small></span></div>
        <label className="field">Avg HR<input type="number" inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} placeholder="bpm" /></label>
        <label className="field">Elevation gain (ft)<input type="number" inputMode="numeric" value={elev} onChange={(e) => setElev(e.target.value)} /></label>
        <label className="field">Temperature (°F)<input type="number" inputMode="numeric" value={temp} onChange={(e) => setTemp(e.target.value)} /></label>
      </div>
      {nSplits > 0 && (
        <>
          <div className="muted small">Per-mile splits as pace (m:ss). The last one is the partial mile's pace.</div>
          <div className="splits">
            {shownSplits.map((s, i) => (
              <label className="field" key={i}>
                {i === nSplits - 1 && d % 1 > 0.01 ? `Mile ${i + 1} (${(d - i).toFixed(2)})` : `Mile ${i + 1}`}
                <input type="text" inputMode="numeric" value={s} placeholder="8:15" onChange={(e) => {
                  const next = [...shownSplits]; next[i] = e.target.value; setSplits(next);
                }} />
              </label>
            ))}
          </div>
          {m1Fast && <div className="small flag">Mile 1 is {Math.round(pace - m1)}s faster than the average pace.</div>}
        </>
      )}
      <div className="field">Type<Seg value={effKind} options={[{ value: 'easy', label: 'Easy' }, { value: 'hard', label: 'Hard' }]} onChange={(v) => { setKind(v); setKindTouched(true); }} /></div>
      <Check label="Pre-run carb snack" checked={!!snack} onChange={setSnack} />
      {snack === undefined && <div className="muted small">Snack wasn't recorded for this run. Tap above to record yes, or tap twice for no.</div>}
      <label className="field">Note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></label>
      <button className="btn primary block" disabled={!valid} onClick={save}>Save run</button>
    </Sheet>
  );
}
