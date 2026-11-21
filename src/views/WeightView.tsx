import { useState } from 'react';
import { Legend, LineChart } from '../components/LineChart';
import { Icon, fmtLb, num, signed } from '../components/ui';
import { addDays, daysBetween, fmtDow, fmtShort, fmtWeek, today, uid, weekStart } from '../lib/dates';
import { CREATINE_DATE, weeklyWeight, weightWeek } from '../lib/calc';
import { useStore } from '../store';

export function WeightView() {
  const { data, upsert, remove } = useStore();
  const [date, setDate] = useState(today());
  const [lb, setLb] = useState('');

  const weeks = weeklyWeight(data.weight);
  const latestWeek = weeks[weeks.length - 1];
  const thisWeek = weekStart(today());
  const focus = weeks.find((w) => w.start === thisWeek) ? thisWeek : latestWeek?.start;
  const ww = focus ? weightWeek(data.weight, focus) : undefined;
  const readings = [...data.weight].sort((a, b) => (a.date < b.date ? 1 : -1));
  const focusReadings = focus ? readings.filter((r) => weekStart(r.date) === focus) : [];

  // Show the creatine note on the chart if it falls within ~6 weeks before the first reading.
  const first = readings[readings.length - 1];
  const showCreatine = first && daysBetween(CREATINE_DATE, first.date) <= 42;

  const save = async () => {
    const v = num(lb);
    if (v === undefined) return;
    await upsert('weight', { id: uid(), date, lb: v });
    setLb('');
  };

  return (
    <div className="page">
      <section className="card">
        <h2>Weekly average</h2>
        {ww?.cur ? (
          <>
            <div className="hero">{fmtLb(ww.cur.avg)}<small>lb</small></div>
            <div className="sub">
              {focus === thisWeek ? 'This week' : `Week of ${fmtWeek(focus!)}`} · {ww.cur.n} weigh-in{ww.cur.n === 1 ? '' : 's'}
            </div>
            <div className="stat">
              <span className="label">Week-over-week</span>
              {ww.delta !== undefined ? (
                <>
                  <span className="value">{signed(ww.delta)} <small>lb</small></span>
                  <span className="detail">
                    vs {fmtLb(ww.prev!.avg)} {ww.gapWeeks === 1 ? 'last week' : `the week of ${fmtShort(ww.prev!.start)} (${ww.gapWeeks} weeks earlier — no weigh-ins in between)`}
                  </span>
                </>
              ) : <span className="detail">No earlier week to compare yet.</span>}
            </div>
            <div className="muted small">
              This week's readings: {focusReadings.map((r) => `${fmtDow(r.date)} ${fmtLb(r.lb)}`).join(' · ')}
            </div>
          </>
        ) : <div className="muted">No weigh-ins yet.</div>}
      </section>

      <section className="card">
        <h2>Log morning weigh-in</h2>
        <div className="grid2">
          <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} /></label>
          <label className="field">Weight (lb)<input type="number" inputMode="decimal" step="0.1" value={lb} onChange={(e) => setLb(e.target.value)} placeholder="206.0" /></label>
        </div>
        <button className="btn primary block" disabled={num(lb) === undefined} onClick={save}>Save weigh-in</button>
      </section>

      <section className="card">
        <h2>Trend</h2>
        <LineChart
          ariaLabel="Weekly average weight with individual weigh-ins"
          series={[
            { id: 'daily', label: 'Weigh-in', color: 'var(--text-muted)', points: data.weight.map((w) => ({ x: w.date, y: w.lb })), mode: 'dots', dotR: 3 },
            { id: 'avg', label: 'Week avg', color: 'var(--series-1)', points: weeks.map((w) => ({ x: addDays(w.start, 3), y: w.avg })), mode: 'both' },
          ]}
          annotations={showCreatine ? [{ x: CREATINE_DATE, label: 'Creatine 5g' }] : []}
          yFmt={(n) => String(Number(n.toFixed(1)))}
          minYSpan={4}
        />
        <Legend items={[{ label: 'Weekly average (plotted mid-week)', color: 'var(--series-1)' }, { label: 'Single weigh-in', color: 'var(--text-muted)', dot: true }]} />
        <div className="note">Creatine went up to 5 g/day around {fmtShort(CREATINE_DATE)}. That typically adds 1–3 lb of water weight, so readings from mid-October on include it.</div>
      </section>

      <section className="card">
        <h2>Weekly averages</h2>
        <table className="tbl">
          <thead><tr><th>Week</th><th>Avg</th><th>Change</th><th>n</th></tr></thead>
          <tbody>
            {[...weeks].reverse().map((w, i, arr) => {
              const prev = arr[i + 1];
              return (
                <tr key={w.start}>
                  <td>{fmtShort(w.start)}</td>
                  <td>{fmtLb(w.avg)}</td>
                  <td>{prev ? signed(w.avg - prev.avg) : '–'}</td>
                  <td className="muted">{w.n}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Weigh-ins</h2>
        <div className="list">
          {readings.map((r) => (
            <div className="list-item" key={r.id}>
              <span className="small">{fmtDow(r.date)} {fmtShort(r.date)} · <span className="muted">{fmtLb(r.lb)} lb</span></span>
              <button className="icon-btn" aria-label="Delete weigh-in" onClick={() => confirm('Delete this weigh-in?') && remove('weight', r.id)}><Icon name="trash" /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
