import { useState } from 'react';
import { WeekNav, fmtLb, signed } from '../components/ui';
import { addDays, fmtDow, fmtShort, inWeek, today, weekStart } from '../lib/dates';
import { noRecentEasyRun, officialWaist, weekSummary } from '../lib/calc';
import { useStore } from '../store';

export function WeekView({ go }: { go: (tab: string) => void }) {
  const { data, setSettings } = useStore();
  const [start, setStart] = useState(weekStart(today()));
  const s = weekSummary(data, start);
  const min = data.settings.minimumPlan;
  const off = officialWaist(data.waist);
  const prevOff = s.waist ? [...off].reverse().find((w) => w.date < s.waist!.date) : undefined;
  const isCurrent = inWeek(today(), start);
  const elapsed = isCurrent ? s.days.filter((d) => d <= today()).length : 7;
  const recent = Array.from({ length: 6 }, (_, i) => addDays(weekStart(today()), -7 * i));

  return (
    <div className="page">
      <section className="card" style={{ gap: 4 }}>
        <div className="toggle-row">
          <div>
            <div><strong>Minimum Plan mode</strong></div>
            <div className="muted small">For finals and holidays: hold steady with a shake daily, real lunch daily, 2 lifts/week.</div>
          </div>
          <label className="switch"><input type="checkbox" role="switch" aria-label="Minimum Plan mode" checked={min} onChange={(e) => setSettings({ ...data.settings, minimumPlan: e.target.checked })} /><span /></label>
        </div>
      </section>

      <WeekNav start={start} onChange={setStart} />

      {min && <div className="banner">Goal this week: hold steady. Shake daily · real lunch daily · 2 lifts.</div>}

      <div className="grid2">
        <button className="stat" onClick={() => go('waist')} style={{ border: 0, textAlign: 'left' }}>
          <span className="label">Official waist</span>
          {s.waist ? (
            <>
              <span className="value">{s.waist.value.toFixed(2)}<small>in</small></span>
              <span className="detail">{fmtDow(s.waist.date)} {fmtShort(s.waist.date)}{prevOff ? ` · ${signed(s.waist.value - prevOff.value, 2)} vs prior` : ''}</span>
            </>
          ) : <><span className="value muted">–</span><span className="detail">No official check-in{isCurrent ? ' yet (Thursday)' : ''}</span></>}
        </button>

        <button className="stat" onClick={() => go('weight')} style={{ border: 0, textAlign: 'left' }}>
          <span className="label">Avg weight</span>
          {s.weight.cur ? (
            <>
              <span className="value">{fmtLb(s.weight.cur.avg)}<small>lb</small></span>
              <span className="detail">{s.weight.delta !== undefined ? `${signed(s.weight.delta)} vs ${s.weight.gapWeeks === 1 ? 'last week' : `${s.weight.gapWeeks} wk earlier`}` : 'No prior week'} · {s.weight.cur.n} weigh-in{s.weight.cur.n === 1 ? '' : 's'}</span>
            </>
          ) : <><span className="value muted">–</span><span className="detail">No weigh-ins</span></>}
        </button>

        <button className="stat" onClick={() => go('lift')} style={{ border: 0, textAlign: 'left' }}>
          <span className="label">Lift sessions</span>
          <span className="value">{s.lifts.length}<small>/ 2</small></span>
          <span className="detail">{s.lifts.length ? s.lifts.map((l) => `${fmtDow(l.date)} ${l.workout}`).join(' · ') : 'None logged'}{min ? '' : ' · 3 when possible'}</span>
        </button>

        <button className="stat" onClick={() => go('run')} style={{ border: 0, textAlign: 'left' }}>
          <span className="label">Runs</span>
          <span className="value">{s.runs.length}</span>
          <span className="detail">{s.easyRuns} easy · {s.hardRuns} hard{s.runs.length ? ` · ${s.runs.reduce((a, r) => a + r.distance, 0).toFixed(1)} mi` : ''}</span>
        </button>
      </div>

      <section className="card" onClick={() => go('habits')} style={{ cursor: 'pointer' }}>
        <h2>{min ? 'Minimum plan' : 'Habits'}</h2>
        {min ? (
          <div className="grid3">
            <div className="stat"><span className="label">Shake</span><span className="value">{s.shakeDays}<small>/{elapsed}</small></span></div>
            <div className="stat"><span className="label">Real lunch</span><span className="value">{s.lunchDays}<small>/{elapsed}</small></span></div>
            <div className="stat"><span className="label">Lifts</span><span className="value">{s.lifts.length}<small>/2</small></span></div>
          </div>
        ) : (
          <div className="grid2">
            <div className="stat"><span className="label">Minimum plan days</span><span className="value">{s.minPlanDays}<small>/{elapsed}</small></span><span className="detail">Shake + real lunch</span></div>
            <div className="stat"><span className="label">Light training days</span><span className="value">{s.lightTrainingDays.length}<small>/{s.trainingDays.length}</small></span><span className="detail">{s.lightTrainingDays.map(fmtDow).join(', ') || 'None logged'}</span></div>
          </div>
        )}
        <div className="muted small">
          {s.daysLogged} of {elapsed} day{elapsed === 1 ? '' : 's'} logged{isCurrent ? ' so far' : ''}
          {s.avgSteps ? ` · avg ${Math.round(s.avgSteps).toLocaleString()} steps` : ''}{s.treats ? ` · ${s.treats} planned treat${s.treats === 1 ? '' : 's'}` : ''}
        </div>
      </section>

      {isCurrent && noRecentEasyRun(data.runs, today()) && (
        <div className="note">No run at 9:30/mi or slower in the past 7 days.</div>
      )}

      <section className="card">
        <h2>Last 6 weeks</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Week</th><th>Waist</th><th>Weight</th><th>Lifts</th><th>Runs</th><th>Min plan</th></tr></thead>
            <tbody>
              {recent.map((w) => {
                const x = weekSummary(data, w);
                return (
                  <tr key={w} onClick={() => setStart(w)} style={{ cursor: 'pointer', color: w === start ? 'var(--text-primary)' : undefined }}>
                    <td>{w === start ? <strong>{fmtShort(w)}</strong> : fmtShort(w)}</td>
                    <td>{x.waist ? x.waist.value.toFixed(2) : '–'}</td>
                    <td>{x.weight.cur ? fmtLb(x.weight.cur.avg) : '–'}</td>
                    <td>{x.lifts.length}</td>
                    <td>{x.runs.length ? `${x.easyRuns}E ${x.hardRuns}H` : '0'}</td>
                    <td>{x.daysLogged ? `${x.minPlanDays}/7` : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
