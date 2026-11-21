import { useEffect, useState } from 'react';
import { Check, WeekNav, num } from '../components/ui';
import { fmtDow, fmtShort, inWeek, parseISO, today, weekDays, weekStart } from '../lib/dates';
import { hitMinimumPlan, isLightEating, trainingDates } from '../lib/calc';
import type { HabitDay, ISODate } from '../lib/types';
import { useStore } from '../store';

const blankDay = (date: ISODate): HabitDay => ({ date, breakfast: false, lunch: false, carbs: false, preSnack: false, shake: false, treat: false });

export function HabitsView() {
  const { data, patchHabit } = useStore();
  const [start, setStart] = useState(weekStart(today()));
  const [sel, setSel] = useState<ISODate>(today());
  useEffect(() => { if (!inWeek(sel, start)) setSel(inWeek(today(), start) ? today() : start); }, [start, sel]);

  const by = new Map(data.habits.map((h) => [h.date, h]));
  const training = trainingDates(data);
  const days = weekDays(start);
  const light = days.filter((d) => training.has(d) && isLightEating(by.get(d)));
  const unlogged = days.filter((d) => training.has(d) && !by.get(d) && d <= today());
  const steps = days.map((d) => by.get(d)?.steps).filter((s): s is number => !!s);
  const day = by.get(sel) ?? blankDay(sel);
  const isTraining = training.has(sel);
  const set = (patch: Partial<HabitDay>) => patchHabit(sel, patch);

  return (
    <div className="page">
      <section className="card">
        <WeekNav start={start} onChange={setStart} />
        <div className="days">
          {days.map((d) => {
            const h = by.get(d);
            const cls = ['day', d === sel ? 'sel' : '', training.has(d) && isLightEating(h) ? 'light' : ''].join(' ');
            return (
              <button key={d} className={cls} onClick={() => setSel(d)} aria-label={`${fmtDow(d)} ${fmtShort(d)}`}>
                <span className="muted">{fmtDow(d)[0]}</span>
                <span className="dnum">{parseISO(d).getDate()}</span>
                <span className="pips">
                  {h ? [h.breakfast, h.lunch, h.carbs, h.shake].map((v, i) => <span key={i} className={v ? 'pip on' : 'pip'} />) : <span className="muted">·</span>}
                </span>
                {training.has(d) && <span className="small" style={{ fontSize: 9, color: 'var(--text-secondary)' }}>train</span>}
              </button>
            );
          })}
        </div>
        <div className="muted small">Dots: breakfast · lunch · carbs · shake. Outlined days are training days with light eating.</div>
      </section>

      <section className="card">
        <h2>Training-day fueling this week</h2>
        {light.length === 0 && unlogged.length === 0 && <div className="sub">{days.some((d) => training.has(d)) ? 'No training days with light eating logged.' : 'No training days logged yet.'}</div>}
        {light.map((d) => {
          const h = by.get(d)!;
          const missing = [!h.breakfast && 'breakfast', !h.lunch && 'real lunch', !h.carbs && 'carbs with meals'].filter(Boolean).join(', ');
          return <div key={d} className="spread"><span><strong>{fmtDow(d)} {fmtShort(d)}</strong></span><span className="flag small">Light — no {missing}</span></div>;
        })}
        {unlogged.map((d) => <div key={d} className="spread"><span>{fmtDow(d)} {fmtShort(d)}</span><span className="muted small">Training day, habits not logged</span></div>)}
        <div className="muted small">"Light" = a lift or run day with fewer than 2 of: breakfast, real lunch, carbs with meals.</div>
        {steps.length > 0 && <div className="sub">Steps: avg {Math.round(steps.reduce((a, b) => a + b, 0) / steps.length).toLocaleString()} over {steps.length} day{steps.length === 1 ? '' : 's'}</div>}
      </section>

      <section className="card" key={sel}>
        <div className="spread">
          <h2>{fmtDow(sel)} {fmtShort(sel)}</h2>
          <span className="muted small">{isTraining ? 'Training day' : 'Rest day'}{hitMinimumPlan(by.get(sel)) ? ' · minimum plan hit' : ''}</span>
        </div>
        <Check label="Ate breakfast" checked={day.breakfast} onChange={(v) => set({ breakfast: v })} />
        <Check label="Real lunch" checked={day.lunch} onChange={(v) => set({ lunch: v })} />
        <Check label={<>Carbs with meals {!isTraining && <span className="muted small">(training days)</span>}</>} checked={day.carbs} onChange={(v) => set({ carbs: v })} />
        <Check label="Pre-workout snack" checked={day.preSnack} onChange={(v) => set({ preSnack: v })} />
        <Check label="Protein shake" checked={day.shake} onChange={(v) => set({ shake: v })} />
        <StepsField value={day.steps} onSave={(v) => set({ steps: v })} />
        <Check label="Planned treat meal" checked={day.treat} onChange={(v) => set({ treat: v })} />
        <NoteField value={day.note} onSave={(v) => set({ note: v })} />
      </section>
    </div>
  );
}

function StepsField({ value, onSave }: { value?: number; onSave: (v?: number) => void }) {
  const [v, setV] = useState(value ? String(value) : '');
  return (
    <label className="field">Steps
      <input type="number" inputMode="numeric" value={v} placeholder="12000" onChange={(e) => setV(e.target.value)} onBlur={() => { const n = num(v); if (n !== value) onSave(n); }} />
    </label>
  );
}

function NoteField({ value, onSave }: { value?: string; onSave: (v?: string) => void }) {
  const [v, setV] = useState(value ?? '');
  return (
    <label className="field">Meals note
      <textarea value={v} placeholder="Optional" onChange={(e) => setV(e.target.value)} onBlur={() => { const t = v.trim() || undefined; if (t !== value) onSave(t); }} />
    </label>
  );
}
