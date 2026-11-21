import type { ReactNode } from 'react';
import { addDays, fmtWeek, today, weekStart } from '../lib/dates';
import type { ISODate } from '../lib/types';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Check({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={checked ? 'check on' : 'check'}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Switch({ label, sub, checked, onChange }: { label: ReactNode; sub?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <div><div>{label}</div>{sub && <div className="muted small">{sub}</div>}</div>
      <label className="switch"><input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={typeof label === 'string' ? label : undefined} /><span /></label>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function WeekNav({ start, onChange }: { start: ISODate; onChange: (s: ISODate) => void }) {
  const cur = weekStart(today());
  return (
    <div className="week-nav">
      <button className="icon-btn" aria-label="Previous week" onClick={() => onChange(addDays(start, -7))}><Icon name="left" /></button>
      <div className="label">
        <div>{start === cur ? 'This week' : start === addDays(cur, -7) ? 'Last week' : 'Week of'}</div>
        <div className="muted small">{fmtWeek(start)}</div>
      </div>
      <button className="icon-btn" aria-label="Next week" disabled={start >= cur} onClick={() => onChange(addDays(start, 7))} style={{ opacity: start >= cur ? 0.3 : 1 }}><Icon name="right" /></button>
    </div>
  );
}

export function num(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

const PATHS: Record<string, ReactNode> = {
  week: <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 2v4M16 2v4M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2" /></>,
  waist: <><path d="M3 12c0-3 4-5 9-5s9 2 9 5-4 5-9 5-9-2-9-5Z" /><path d="M7 11v2M11 11.5v2M15 11v2" /></>,
  weight: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 9a5 5 0 0 1 8 0l-3 3" /></>,
  lift: <><path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12" /></>,
  run: <><circle cx="14" cy="4.5" r="1.8" /><path d="m7 21 3-6 3 2v4M10 15l1-5 4 2 3 1M11 10 8 11l-2 3" /></>,
  habits: <><path d="M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  left: <path d="m15 5-7 7 7 7" />,
  right: <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4Z" />,
};
export function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export const fmtLb = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
export const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`;
