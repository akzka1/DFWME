import { useState } from 'react';
import { Check, Icon, Seg, Sheet, num } from '../components/ui';
import { fmtDow, fmtShort, inWeek, today, uid, weekStart } from '../lib/dates';
import { PROGRAM, allDefs, history, nextWorkout, repLabel, suggest, type ExerciseDef } from '../lib/program';
import type { ExerciseLog, LiftSession } from '../lib/types';
import { useStore } from '../store';

const MAIN_KEYS = ['squat', 'bench', 'ohp', 'deadlift'];

export function LiftView() {
  const { data, upsert, remove } = useStore();
  const [editing, setEditing] = useState<LiftSession | null>(null);
  const next = nextWorkout(data.lifts);
  const wk = weekStart(today());
  const thisWeek = data.lifts.filter((l) => inWeek(l.date, wk)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const sessions = [...data.lifts].sort((a, b) => (a.date < b.date ? 1 : -1));
  const minimum = data.settings.minimumPlan;
  const defs = allDefs();

  const newSession = (w: 'A' | 'B'): LiftSession => ({ id: uid(), date: today(), workout: w, exercises: buildExercises(w, data.lifts) });

  return (
    <div className="page">
      <section className="card">
        <h2>Next in rotation</h2>
        <div className="hero">Workout {next}</div>
        <div className="sub">{PROGRAM[next].map((d) => d.name).join(' · ')}</div>
        <button className="btn primary block" onClick={() => setEditing(newSession(next))}><Icon name="plus" /> Log Workout {next}</button>
        <button className="btn ghost block small" onClick={() => setEditing(newSession(next === 'A' ? 'B' : 'A'))}>Log Workout {next === 'A' ? 'B' : 'A'} instead</button>
      </section>

      <section className="card">
        <h2>Sessions this week</h2>
        <div className="spread">
          <div className="hero">{thisWeek.length}<small>/ 2{minimum ? '' : ' (3 when possible)'}</small></div>
        </div>
        <div className="progress"><div style={{ width: `${Math.min(100, (thisWeek.length / (minimum ? 2 : 3)) * 100)}%` }} /></div>
        <div className="muted small">
          {thisWeek.length ? thisWeek.map((s) => `${fmtDow(s.date)} (${s.workout})`).join(' · ') : 'None logged yet this week.'} Plan: Mon + Fri{minimum ? '' : ', plus a third when it fits'}.
        </div>
      </section>

      <section className="card">
        <h2>Main lifts — next weights</h2>
        <table className="tbl">
          <thead><tr><th>Lift</th><th>Last</th><th>Next</th></tr></thead>
          <tbody>
            {MAIN_KEYS.map((k) => {
              const def = defs.find((d) => d.key === k)!;
              const h = history(data.lifts, k)[0];
              const s = suggest(def, data.lifts);
              return (
                <tr key={k}>
                  <td>{def.name}</td>
                  <td className="muted">{h ? `${Math.max(...h.log.sets.map((x) => x.weight))} (${fmtShort(h.date)})` : '–'}</td>
                  <td><strong>{s.weight}</strong> <span className="muted small">{s.reason}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>History</h2>
        {!sessions.length && <div className="muted">No sessions logged yet.</div>}
        <div className="list">
          {sessions.map((s) => (
            <div className="list-item" key={s.id}>
              <div className="main">
                <span><strong>Workout {s.workout}</strong> <span className="muted small">{fmtDow(s.date)} {fmtShort(s.date)}</span></span>
                <span className="muted small">
                  {s.exercises.filter((e) => !e.skipped && MAIN_KEYS.includes(e.key)).map((e) => `${shortName(e.name)} ${Math.max(...e.sets.map((x) => x.weight))}×${e.sets.map((x) => x.reps).join('/')}`).join(' · ')}
                </span>
              </div>
              <div className="row">
                <button className="icon-btn" aria-label="Edit session" onClick={() => setEditing(s)}><Icon name="edit" /></button>
                <button className="icon-btn" aria-label="Delete session" onClick={() => confirm('Delete this session?') && remove('lifts', s.id)}><Icon name="trash" /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editing && (
        <LiftForm
          initial={editing}
          others={data.lifts.filter((l) => l.id !== editing.id)}
          onClose={() => setEditing(null)}
          onSave={async (s) => { await upsert('lifts', s); setEditing(null); }}
        />
      )}
    </div>
  );
}

const shortName = (n: string) => ({ 'Bench Press': 'Bench', 'Overhead Press': 'OHP' } as Record<string, string>)[n] ?? n;

function defaultReps(d: ExerciseDef) {
  return d.kind === 'range' ? d.repsMin : d.repsMax;
}

function buildExercises(w: 'A' | 'B', sessions: LiftSession[]): ExerciseLog[] {
  return PROGRAM[w].map((d) => {
    const variant = d.variants ? (history(sessions, d.key)[0]?.log.name ?? d.variants[0]) : d.name;
    const s = suggest(d, sessions, d.variants ? variant : undefined);
    return { key: d.key, name: variant, sets: Array.from({ length: d.sets }, () => ({ weight: s.weight, reps: defaultReps(d) })) };
  });
}

function LiftForm({ initial, others, onClose, onSave }: { initial: LiftSession; others: LiftSession[]; onClose: () => void; onSave: (s: LiftSession) => Promise<void> }) {
  const [s, setS] = useState<LiftSession>(initial);
  // only sessions before this one count for suggestions
  const prior = others.filter((o) => o.date <= s.date);

  const setEx = (i: number, e: ExerciseLog) => setS({ ...s, exercises: s.exercises.map((x, j) => (j === i ? e : x)) });
  const switchWorkout = (w: 'A' | 'B') => {
    if (w === s.workout) return;
    setS({ ...s, workout: w, exercises: buildExercises(w, prior) });
  };

  return (
    <Sheet title={`Workout ${s.workout}`} onClose={onClose}>
      <div className="grid2">
        <label className="field">Date<input type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value || today() })} /></label>
        <div className="field">Workout<Seg value={s.workout} options={[{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]} onChange={switchWorkout} /></div>
      </div>
      {s.exercises.map((e, i) => {
        const def = PROGRAM[s.workout].find((d) => d.key === e.key) ?? allDefs().find((d) => d.key === e.key)!;
        const sug = suggest(def, prior, def.variants ? e.name : undefined);
        const bw = def.kind === 'bodyweight' || (def.variants && e.name === 'Pull-ups');
        return (
          <div className="card" key={e.key} style={{ padding: 12, opacity: e.skipped ? 0.55 : 1 }}>
            <div className="spread">
              <div>
                <h3>{def.variants ? (
                  <select value={e.name} aria-label="Variant" onChange={(ev) => {
                    const sug2 = suggest(def, prior, ev.target.value);
                    setEx(i, { ...e, name: ev.target.value, sets: e.sets.map((x) => ({ ...x, weight: sug2.weight })) });
                  }} style={{ minHeight: 40, fontSize: 16, fontWeight: 600 }}>
                    {def.variants.map((v) => <option key={v}>{v}</option>)}
                  </select>
                ) : def.name}</h3>
                <div className="muted small">{repLabel(def)}{def.note ? ` · ${def.note}` : ''} · {sug.weight ? `${sug.weight} lb — ` : ''}{sug.reason}</div>
              </div>
            </div>
            {!e.skipped && (
              <div className="sets">
                <span className="hdr">Set</span><span className="hdr">{bw ? 'Added lb' : 'Weight'}</span><span className="hdr">Reps</span><span />
                {e.sets.map((set, k) => (
                  <SetRow key={`${k}-${e.sets.length}-${e.name}`} n={k + 1} weight={set.weight} reps={set.reps}
                    onChange={(w, r) => setEx(i, { ...e, sets: e.sets.map((x, j) => (j === k ? { weight: w, reps: r } : x)) })}
                    onRemove={() => setEx(i, { ...e, sets: e.sets.filter((_, j) => j !== k) })} />
                ))}
              </div>
            )}
            <div className="row wrap">
              {!e.skipped && <button className="btn small" onClick={() => setEx(i, { ...e, sets: [...e.sets, e.sets[e.sets.length - 1] ?? { weight: sug.weight, reps: defaultReps(def) }] })}><Icon name="plus" /> Set</button>}
              <button className="btn small ghost" onClick={() => setEx(i, { ...e, skipped: !e.skipped })}>{e.skipped ? 'Un-skip' : 'Skip'}</button>
            </div>
            {def.kind === 'main' && !e.skipped && (
              <Check label={def.key === 'deadlift' ? 'Reps slowed down (switch to +5 jumps)' : 'Reps slowed / not all clean'} checked={!!e.slowed} onChange={(v) => setEx(i, { ...e, slowed: v })} />
            )}
          </div>
        );
      })}
      <label className="field">Note<textarea value={s.note ?? ''} onChange={(e) => setS({ ...s, note: e.target.value })} placeholder="Optional" /></label>
      <button className="btn primary block" onClick={() => onSave(s)}>Save session</button>
    </Sheet>
  );
}

function SetRow({ n, weight, reps, onChange, onRemove }: { n: number; weight: number; reps: number; onChange: (w: number, r: number) => void; onRemove: () => void }) {
  const [w, setW] = useState(String(weight));
  const [r, setR] = useState(String(reps));
  return (
    <>
      <span className="muted">{n}</span>
      <input type="number" inputMode="decimal" aria-label={`Set ${n} weight`} value={w} onChange={(e) => { setW(e.target.value); onChange(num(e.target.value) ?? 0, num(r) ?? 0); }} />
      <input type="number" inputMode="numeric" aria-label={`Set ${n} reps`} value={r} onChange={(e) => { setR(e.target.value); onChange(num(w) ?? 0, num(e.target.value) ?? 0); }} />
      <button className="icon-btn" aria-label={`Remove set ${n}`} onClick={onRemove}><Icon name="x" /></button>
    </>
  );
}
