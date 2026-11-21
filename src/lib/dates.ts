import type { ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function today(): ISODate {
  return toISO(new Date());
}
export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
/** Whole days from a to b (b - a). DST-safe because it uses UTC of local Y/M/D. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
/** Weeks run Monday–Sunday. Returns the Monday. */
export function weekStart(s: ISODate): ISODate {
  const dow = parseISO(s).getDay(); // 0 Sun
  return addDays(s, -((dow + 6) % 7));
}
export function weekDays(start: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function inWeek(date: ISODate, start: ISODate): boolean {
  const d = daysBetween(start, date);
  return d >= 0 && d < 7;
}
export function dow(s: ISODate): number {
  return parseISO(s).getDay();
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function fmtShort(s: ISODate): string {
  const d = parseISO(s);
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}
export function fmtDow(s: ISODate): string {
  return DOW[dow(s)];
}
export function fmtWeek(start: ISODate): string {
  return `${fmtShort(start)} – ${fmtShort(addDays(start, 6))}`;
}

export function fmtPace(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '–';
  const r = Math.round(sec);
  return `${Math.floor(r / 60)}:${pad(r % 60)}`;
}
export function fmtDuration(sec: number): string {
  const r = Math.round(sec);
  const h = Math.floor(r / 3600);
  const m = Math.floor((r % 3600) / 60);
  const s = r % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
/** Parses 'm:ss' or 'h:mm:ss' (or bare minutes) into seconds. NaN if invalid. */
export function parseClock(s: string): number {
  const t = s.trim();
  if (!t) return NaN;
  const parts = t.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || isNaN(Number(p)))) return NaN;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0] * 60;
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return NaN;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
