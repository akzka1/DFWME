import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, daysBetween, fmtShort } from '../lib/dates';
import type { ISODate } from '../lib/types';

export interface Series {
  id: string;
  label: string;
  color: string; // css color / var
  points: { x: ISODate; y: number }[];
  mode: 'line' | 'dots' | 'both';
  dashed?: boolean;
  dotR?: number;
  hideInTooltip?: boolean;
}

interface Props {
  series: Series[];
  refLines?: { y: number; label: string; done?: boolean }[];
  annotations?: { x: ISODate; label: string }[];
  height?: number;
  yFmt?: (n: number) => string;
  invertY?: boolean; // e.g. pace: faster (smaller) shown higher
  minYSpan?: number;
  yStep?: number; // force a tick step (e.g. 30 s for pace)
  ariaLabel: string;
}

const PAD = { l: 40, r: 12, t: 14, b: 26 };

export function LineChart({ series, refLines = [], annotations = [], height = 200, yFmt = (n) => n.toFixed(1), invertY, minYSpan = 1, yStep, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  const [hover, setHover] = useState<ISODate | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.points);
  const geo = useMemo(() => {
    if (!all.length) return null;
    const xs = [...all.map((p) => p.x), ...annotations.map((a) => a.x)].sort();
    let x0 = xs[0];
    let x1 = xs[xs.length - 1];
    if (x0 === x1) { x0 = addDays(x0, -3); x1 = addDays(x1, 3); }
    const span = daysBetween(x0, x1);
    let y0 = Math.min(...all.map((p) => p.y));
    let y1 = Math.max(...all.map((p) => p.y));
    for (const r of refLines) {
      // include nearby milestones so the next target is visible
      if (r.y >= y0 - minYSpan && r.y <= y1 + minYSpan) { y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y); }
    }
    if (y1 - y0 < minYSpan) { const m = (y0 + y1) / 2; y0 = m - minYSpan / 2; y1 = m + minYSpan / 2; }
    const pad = (y1 - y0) * 0.12;
    y0 -= pad; y1 += pad;
    const iw = w - PAD.l - PAD.r;
    const ih = height - PAD.t - PAD.b;
    const sx = (x: ISODate) => PAD.l + (daysBetween(x0, x) / span) * iw;
    const sy = (y: number) => {
      const f = (y - y0) / (y1 - y0);
      return PAD.t + (invertY ? f : 1 - f) * ih;
    };
    const step = yStep ?? niceStep((y1 - y0) / 4);
    const ticks: number[] = [];
    for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) ticks.push(v);
    const xt = [x0, addDays(x0, Math.round(span / 2)), x1];
    return { x0, x1, span, sx, sy, ticks, xt, iw };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(series), JSON.stringify(refLines), JSON.stringify(annotations), w, height, invertY, minYSpan, yStep]);

  if (!geo) return <div ref={ref} className="chart-empty">No data yet</div>;
  const { sx, sy, ticks, xt, x0, span, iw } = geo;

  const xsAll = [...new Set(series.filter((s) => !s.hideInTooltip).flatMap((s) => s.points.map((p) => p.x)))].sort();
  const pick = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    const day = ((px - PAD.l) / iw) * span;
    let best: ISODate | null = null;
    let bd = Infinity;
    for (const x of xsAll) {
      const d = Math.abs(daysBetween(x0, x) - day);
      if (d < bd) { bd = d; best = x; }
    }
    setHover(best);
  };

  const rows = hover
    ? series.filter((s) => !s.hideInTooltip).map((s) => ({ s, p: s.points.find((p) => p.x === hover) })).filter((r) => r.p)
    : [];
  const hx = hover ? sx(hover) : 0;

  return (
    <div ref={ref} className="chart" onPointerDown={(e) => pick(e.clientX)} onPointerMove={(e) => e.buttons || e.pointerType === 'mouse' ? pick(e.clientX) : undefined} onPointerLeave={() => setHover(null)}>
      <svg width={w} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={PAD.l - 6} y={sy(t) + 4} textAnchor="end" className="axis">{yFmt(t)}</text>
          </g>
        ))}
        {xt.map((x, i) => (
          <text key={x + i} x={sx(x)} y={height - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="axis">{fmtShort(x)}</text>
        ))}
        {refLines.map((r) => (
          <g key={r.y}>
            <line x1={PAD.l} x2={w - PAD.r} y1={sy(r.y)} y2={sy(r.y)} className={r.done ? 'ref ref-done' : 'ref'} />
            <text x={PAD.l + 4} y={sy(r.y) - 4} className="ref-label">{r.label}</text>
          </g>
        ))}
        {annotations.map((a) => (
          <g key={a.x}>
            <line x1={sx(a.x)} x2={sx(a.x)} y1={PAD.t} y2={height - PAD.b} className="annot" />
            <text x={sx(a.x) + 4} y={PAD.t + 10} className="annot-label">{a.label}</text>
          </g>
        ))}
        {series.map((s) => {
          const pts = [...s.points].sort((a, b) => (a.x < b.x ? -1 : 1));
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
          return (
            <g key={s.id}>
              {s.mode !== 'dots' && pts.length > 1 && (
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 5' : undefined} />
              )}
              {s.mode !== 'line' &&
                pts.map((p) => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={s.dotR ?? 4} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />)}
            </g>
          );
        })}
        {hover && <line x1={hx} x2={hx} y1={PAD.t} y2={height - PAD.b} className="crosshair" />}
      </svg>
      {hover && rows.length > 0 && (
        <div className="tooltip" style={{ left: Math.min(Math.max(hx - 70, 0), w - 150) }}>
          <div className="tt-date">{fmtShort(hover)}</div>
          {rows.map(({ s, p }) => (
            <div key={s.id} className="tt-row">
              <span className="tt-key" style={{ background: s.color }} />
              <strong>{yFmt(p!.y)}</strong> <span className="muted">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean; dot?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label}>
          {i.dot ? <span className="lg-dot" style={{ background: i.color }} /> : <span className={i.dashed ? 'lg-line dashed' : 'lg-line'} style={{ borderColor: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  );
}

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}
