// End-to-end smoke test: drives the production build in a phone-sized Chromium.
// Usage: npm run build && (npx vite preview --port 4173 &) && npm run e2e
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const URL = process.env.APP_URL ?? 'http://localhost:4173/';
const SHOTS = 'e2e-shots';
mkdirSync(SHOTS, { recursive: true });
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());
const tab = (name) => page.locator('nav.tabs button', { hasText: name }).click();
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const text = () => page.locator('main').innerText();
// Poll until the main view's text satisfies pred (saves are async), then return it.
const textUntil = async (pred, ms = 3000) => {
  const end = Date.now() + ms; let t = '';
  while (Date.now() < end) { t = await text(); if (pred(t)) return t; await page.waitForTimeout(100); }
  return t;
};

await page.goto(URL);
await page.waitForSelector('nav.tabs');
await tab('Week');
let t = await text();
ok(t.includes('37.00'), 'Week: seeded official waist 37.00 shown');
ok(t.includes('206.0'), 'Week: seeded weekly avg weight 206.0 shown');
ok(t.includes('No run at 9:30/mi'), 'Week: easy-run note shown (no easy run in 7 days)');
await shot('01-week');

// Waist
await tab('Waist');
t = await text();
ok(t.includes('−0.31 in/week'), 'Waist: pace −0.31 in/week from last 4 readings');
ok(t.includes('Reached Nov 19'), 'Waist: 37" milestone reached Nov 19');
const dotsBefore = await page.locator('.chart circle').count();
await page.getByLabel('Reading 1 (in)').fill('36.9');
await page.getByLabel('Reading 2 (in)').fill('37.1');
ok((await text()).includes('already has an official reading'), 'Waist: second reading in same week forced unofficial');
await page.getByRole('button', { name: 'Save reading' }).click();
ok((await textUntil((x) => x.includes('Saved 37.00" as unofficial'))).includes('Saved 37.00" as unofficial'), 'Waist: average of two readings saved as unofficial');
ok((await page.locator('.chart circle').count()) === dotsBefore, 'Waist: unofficial reading not charted');
await shot('02-waist');

// Weight
await tab('Weight');
t = await text();
ok(t.includes('+0.5') && t.includes('206.0'), 'Weight: 206.0 avg, +0.5 vs last week');
ok(t.includes('Creatine'), 'Weight: creatine note present');
await page.getByLabel('Weight (lb)').fill('205');
await page.getByRole('button', { name: 'Save weigh-in' }).click();
t = await textUntil((x) => x.includes('2 weigh-ins'));
ok(t.includes('205.5') && t.includes('2 weigh-ins'), 'Weight: new weigh-in updates weekly avg to 205.5');
await shot('03-weight');

// Lifting
await tab('Lift');
ok((await text()).includes('Workout A'), 'Lift: next workout is A with no history');
await page.getByRole('button', { name: 'Log Workout A' }).click();
const sheet = page.getByRole('dialog');
ok((await sheet.innerText()).includes('Starting weight'), 'Lift: form prefilled with starting weights');
// Bench is the 4th exercise; miss one rep on set 3
const benchCard = sheet.locator('.card', { hasText: 'Bench Press' });
await benchCard.getByLabel('Set 3 reps').fill('4');
await shot('04-lift-form');
await sheet.getByRole('button', { name: 'Save session' }).click();
await sheet.waitFor({ state: 'detached' });
t = await textUntil((x) => x.includes('Workout B'));
ok(t.includes('Workout B'), 'Lift: rotation moved to Workout B');
ok(/1\s*\/ 2/.test(t), 'Lift: 1 session this week shown against target 2');
ok(t.includes('Repeat 135'), 'Lift: bench repeats 135 after a missed rep');
ok(t.includes('235'), 'Lift: squat suggests 235 after clean 3×5');
ok(t.includes('205') && t.includes('Starting weight'), 'Lift: deadlift still at starting 205');
await shot('05-lift');

// Runs
await tab('Run');
t = await text();
ok((t.match(/faster than avg/g) || []).length === 3, 'Run: mile-1 flag on 3 of 4 seeded runs');
await page.getByRole('button', { name: 'Log run' }).click();
const rs = page.getByRole('dialog');
await rs.getByLabel('Distance (mi)').fill('5.3');
await rs.getByLabel('Total time').fill('51:00');
for (const [i, v] of ['9:30', '9:35', '9:40', '9:40', '9:42', '9:30'].entries()) await rs.getByLabel(new RegExp(`^Mile ${i + 1}`)).fill(v);
const rt = await rs.innerText();
ok(rt.includes('9:37'), 'Run: avg pace computed 9:37/mi');
ok((await rs.getByRole('button', { name: 'Easy' }).getAttribute('aria-pressed')) === 'true', 'Run: auto-tagged Easy at ≥9:30');
ok(!rt.includes('faster than the average'), 'Run: no mile-1 flag when mile 1 is within 15s');
await rs.getByLabel('Avg HR').fill('150');
await rs.getByText('Pre-run carb snack').click();
await shot('06-run-form');
await rs.getByRole('button', { name: 'Save run' }).click();
await rs.waitFor({ state: 'detached' });
t = await textUntil((x) => !x.includes('No run at 9:30/mi'));
ok(!t.includes('No run at 9:30/mi'), 'Run: easy-run note cleared');
ok(t.includes('Snack\t1') || /Snack\s+1/.test(t), 'Run: carb snack comparison counts the run');
await page.locator('.list-item', { hasText: '5.30 mi · 9:37' }).click();
ok((await text()).includes('0.30 (partial)'), 'Run: splits table shows partial mile');
await shot('07-run');

// Habits
await tab('Habits');
await page.getByText('Real lunch', { exact: true }).click();
await page.getByLabel('Steps').fill('12000');
await page.getByLabel('Steps').blur();
t = await text();
ok(t.includes('Light — no breakfast, carbs with meals'), 'Habits: training day with only lunch flagged light');
await page.getByText('Ate breakfast', { exact: true }).click();
t = await textUntil((x) => !x.includes('Light — no'));
ok(!t.includes('Light — no'), 'Habits: adding breakfast clears the light flag');
await page.getByText('Protein shake', { exact: true }).click();
ok((await textUntil((x) => x.includes('minimum plan hit'))).includes('minimum plan hit'), 'Habits: shake + lunch = minimum plan hit');
await shot('08-habits');

// Weekly summary + minimum plan mode
await tab('Week');
t = await text();
ok(/Lift sessions\s*1\s*\/ 2/i.test(t), 'Week: 1/2 lift sessions');
ok(t.includes('1 easy · 1 hard'), 'Week: runs 1 easy · 1 hard');
ok(/Minimum plan days\s*1\s*\//i.test(t), 'Week: 1 minimum-plan day');
ok(t.includes('205.5'), 'Week: avg weight updated');
await page.getByRole('switch', { name: 'Minimum Plan mode' }).check({ force: true });
t = await text();
ok(t.includes('Goal this week: hold steady'), 'Week: Minimum Plan mode switches goal to holding steady');
await shot('09-week-minimum');

// Backup export/import
await page.getByLabel('Settings and backup').click();
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export JSON backup' }).click()]);
const path = `${SHOTS}/backup.json`;
await dl.saveAs(path);
const backup = JSON.parse(await (await import('node:fs/promises')).readFile(path, 'utf8'));
ok(backup.format === 'dfwme-backup' && backup.runs.length === 5 && backup.lifts.length === 1, 'Backup: export contains all data');
await page.locator('input[type=file]').setInputFiles(path);
await page.waitForSelector('text=Imported:');
ok(true, 'Backup: import accepted');
await page.getByLabel('Close').click();

// Persistence
await page.reload();
await page.waitForSelector('nav.tabs');
await tab('Run');
ok((await text()).includes('9:37'), 'Persistence: data survives reload (IndexedDB)');
await tab('Habits');
const checked = async (l) => page.locator('label.check', { hasText: l }).locator('input').isChecked();
ok((await checked('Ate breakfast')) && (await checked('Real lunch')) && (await checked('Protein shake')), 'Persistence: habit checkboxes survive reload');
// Rapid taps with no waiting must not overwrite each other.
await page.getByText('Pre-workout snack', { exact: true }).click();
await page.getByText('Planned treat meal', { exact: true }).click();
await page.getByText('Protein shake', { exact: true }).click();
await page.waitForTimeout(300);
await page.reload(); await page.waitForSelector('nav.tabs');
ok((await checked('Pre-workout snack')) && (await checked('Planned treat meal')) && !(await checked('Protein shake')) && (await checked('Real lunch')), 'Habits: rapid taps all persist correctly');
ok(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), 'PWA: service worker registered');
const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
ok(manifest.display === 'standalone', 'PWA: manifest display standalone');

ok(errors.length === 0, `No page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
