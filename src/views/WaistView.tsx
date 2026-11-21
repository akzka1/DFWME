import { useState } from 'react';
import { Legend, LineChart } from '../components/LineChart';
import { Icon, Switch, num, signed } from '../components/ui';
import { addDays, daysBetween, dow, fmtDow, fmtShort, fmtWeek, today, uid, weekStart } from '../lib/dates';
import { WAIST_MILESTONES, linreg, officialForWeek, officialWaist, round2, waistPace } from '../lib/calc';
import type { WaistEntry } from '../lib/types';
import { useStore } from '../store';

export function WaistView() {
  const { data, upsert, remove } = useStore();
  const off = officialWaist(data.waist);
  const latest = off[off.length - 1];
  const pace = waistPace(data.waist);

  const fit = linreg(off.map((w) => ({ x: daysBetween(off[0].date, w.date), y: w.value })));
  const trend = fit && off.length >= 2
    ? [off[0], latest].map((w) => ({ x: w.date, y: fit.intercept + fit.slope * daysBetween(off[0].date, w.date) }))
    : [];

  const makeOfficial = async (e: WaistEntry) => {
    const existing = officialForWeek(data.waist, weekStart(e.date));
    if (existing && existing.id !== e.id) await upsert('waist', { ...existing, official: false });
    await upsert('waist', { ...e, official: true });
  };

  const all = [...data.waist].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="page">
      <section className="card">
        <h2>Official waist</h2>
        {latest ? (
          <>
            <div className="hero">{latest.value.toFixed(2)}<small>in</small></div>
            <div className="sub">{fmtShort(latest.date)} check-in</div>
            {pace && (
              <div className="stat">
                <span className="label">Current pace</span>
                <span className="value">{signed(pace.perWeek, 2)} <small>in/week</small></span>
                <span className="detail">Trend across last {pace.n} official readings ({fmtShort(pace.from)} – {fmtShort(pace.to)})</span>
              </div>
            )}
          </>
        ) : <div className="muted">No official reading yet.</div>}
      </section>

      <CheckIn data={data.waist} onSave={(e) => upsert('waist', e)} />

      <section className="card">
        <h2>Official readings</h2>
        <LineChart
          ariaLabel="Official waist readings with trend line"
          series={[
            { id: 'off', label: 'Official', color: 'var(--series-1)', points: off.map((w) => ({ x: w.date, y: w.value })), mode: 'both' },
            { id: 'trend', label: 'Trend', color: 'var(--text-secondary)', points: trend, mode: 'line', dashed: true, hideInTooltip: true },
          ]}
          refLines={WAIST_MILESTONES.map((m) => ({ y: m, label: `${m}"`, done: !!latest && latest.value <= m }))}
          yFmt={(n) => String(Number(n.toFixed(2)))}
          minYSpan={1.5}
        />
        <Legend items={[{ label: 'Official reading', color: 'var(--series-1)' }, { label: 'Trend (all official)', color: 'var(--text-secondary)', dashed: true }]} />
        <p className="muted small" style={{ margin: 0 }}>Unofficial readings are listed below but not charted.</p>
      </section>

      <section className="card">
        <h2>Milestones</h2>
        <div className="list">
          {WAIST_MILESTONES.map((m) => {
            const reached = off.find((w) => w.value <= m);
            const gap = latest ? latest.value - m : undefined;
            const weeks = pace && pace.perWeek < 0 && gap && gap > 0 ? gap / -pace.perWeek : undefined;
            return (
              <div className="list-item" key={m}>
                <div className="main">
                  <strong>{m}"</strong>
                  <span className="muted small">
                    {reached ? `Reached ${fmtShort(reached.date)}` : gap !== undefined ? `${gap.toFixed(2)} in to go${weeks ? ` · ~${Math.ceil(weeks)} wk at current pace` : ''}` : ''}
                  </span>
                </div>
                <span className={reached ? 'tag blue' : 'tag'}>{reached ? 'Done' : 'Ahead'}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>All readings</h2>
        <div className="list">
          {all.map((e) => (
            <div className="list-item" key={e.id}>
              <div className="main">
                <span><strong>{e.value.toFixed(2)}"</strong> <span className="muted small">{fmtDow(e.date)} {fmtShort(e.date)}</span></span>
                <span className="muted small">{e.r1 === e.r2 ? `${e.r1}"` : `${e.r1}" / ${e.r2}"`}</span>
              </div>
              <div className="row">
                {e.official ? <span className="tag blue">Official</span> : (
                  <button className="btn small" onClick={() => makeOfficial(e)}>Make official</button>
                )}
                <button className="icon-btn" aria-label="Delete reading" onClick={() => confirm('Delete this reading?') && remove('waist', e.id)}><Icon name="trash" /></button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CheckIn({ data, onSave }: { data: WaistEntry[]; onSave: (e: WaistEntry) => Promise<void> }) {
  const [date, setDate] = useState(today());
  const [r1, setR1] = useState('');
  const [r2, setR2] = useState('');
  const [officialPick, setOfficialPick] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const existing = officialForWeek(data, weekStart(date));
  const official = existing ? false : (officialPick ?? true);
  const a = num(r1);
  const b = num(r2);
  const avg = a !== undefined && b !== undefined ? round2((a + b) / 2) : undefined;
  const isThu = dow(date) === 4;
  const nextThu = addDays(date, (4 - dow(date) + 7) % 7);

  const save = async () => {
    if (avg === undefined) return;
    await onSave({ id: uid(), date, r1: a!, r2: b!, value: avg, official });
    setR1(''); setR2(''); setOfficialPick(null);
    setSaved(`Saved ${avg.toFixed(2)}" as ${official ? 'official' : 'unofficial'}.`);
  };

  return (
    <section className="card">
      <h2>Check-in</h2>
      <div className="muted small">
        {isThu ? 'Thursday morning check-in.' : `Official check-ins are Thursday mornings (next: ${fmtDow(nextThu)} ${fmtShort(nextThu)}).`}
      </div>
      <label className="field">Date<input type="date" value={date} onChange={(e) => { setDate(e.target.value || today()); setSaved(null); }} /></label>
      <div className="grid2">
        <label className="field">Reading 1 (in)<input type="number" inputMode="decimal" step="0.05" value={r1} onChange={(e) => { setR1(e.target.value); setSaved(null); }} placeholder="37.0" /></label>
        <label className="field">Reading 2 (in)<input type="number" inputMode="decimal" step="0.05" value={r2} onChange={(e) => { setR2(e.target.value); setSaved(null); }} placeholder="37.0" /></label>
      </div>
      <div className="spread">
        <span className="muted">Average</span>
        <strong style={{ fontSize: 22 }}>{avg !== undefined ? `${avg.toFixed(2)}"` : '–'}</strong>
      </div>
      {existing ? (
        <div className="banner">Week of {fmtWeek(weekStart(date))} already has an official reading ({existing.value.toFixed(2)}" on {fmtShort(existing.date)}). This one will be saved as unofficial.</div>
      ) : (
        <Switch label="Official reading" sub="One per week; only official readings are charted" checked={official} onChange={setOfficialPick} />
      )}
      <button className="btn primary block" disabled={avg === undefined} onClick={save}>Save reading</button>
      {saved && <div className="muted small" role="status">{saved}</div>}
    </section>
  );
}
