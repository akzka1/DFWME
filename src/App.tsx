import { useEffect, useState } from 'react';
import { Icon } from './components/ui';
import { HabitsView } from './views/HabitsView';
import { LiftView } from './views/LiftView';
import { RunView } from './views/RunView';
import { SettingsSheet } from './views/SettingsSheet';
import { WaistView } from './views/WaistView';
import { WeekView } from './views/WeekView';
import { WeightView } from './views/WeightView';

const TABS = [
  { id: 'week', label: 'Week', title: 'Weekly summary' },
  { id: 'waist', label: 'Waist', title: 'Waist' },
  { id: 'weight', label: 'Weight', title: 'Weight' },
  { id: 'lift', label: 'Lift', title: 'Lifting' },
  { id: 'run', label: 'Run', title: 'Runs' },
  { id: 'habits', label: 'Habits', title: 'Daily habits' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    try { return (localStorage.getItem('tab') as Tab) || 'week'; } catch { return 'week'; }
  });
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    try { localStorage.setItem('tab', tab); } catch { /* ignore */ }
    window.scrollTo(0, 0);
  }, [tab]);
  const t = TABS.find((x) => x.id === tab)!;

  return (
    <div className="app">
      <header className="topbar">
        <h1>{t.title}</h1>
        <button className="icon-btn" aria-label="Settings and backup" onClick={() => setSettings(true)}><Icon name="gear" /></button>
      </header>
      <main>
        {tab === 'week' && <WeekView go={(x) => setTab(x as Tab)} />}
        {tab === 'waist' && <WaistView />}
        {tab === 'weight' && <WeightView />}
        {tab === 'lift' && <LiftView />}
        {tab === 'run' && <RunView />}
        {tab === 'habits' && <HabitsView />}
      </main>
      <nav className="tabs">
        {TABS.map((x) => (
          <button key={x.id} aria-current={x.id === tab ? 'page' : undefined} onClick={() => setTab(x.id)}>
            <Icon name={x.id} />
            {x.label}
          </button>
        ))}
      </nav>
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
    </div>
  );
}
