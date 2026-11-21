import { useRef, useState } from 'react';
import { Sheet, Switch } from '../components/ui';
import { today } from '../lib/dates';
import { toExport, validateImport } from '../lib/db';
import { useStore } from '../store';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { data, setSettings, replaceAll } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const exportJson = async () => {
    const json = JSON.stringify(toExport(data), null, 2);
    const name = `dfwme-backup-${today()}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    // On iPhone, the share sheet is the reliable way to save to Files / AirDrop.
    const f = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title: name }); setMsg('Backup shared.'); return; } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg(`Downloaded ${name}.`);
  };

  const importJson = async (f: File) => {
    try {
      const parsed = validateImport(JSON.parse(await f.text()));
      const counts = `${parsed.waist.length} waist, ${parsed.weight.length} weight, ${parsed.lifts.length} lifts, ${parsed.runs.length} runs, ${parsed.habits.length} habit days`;
      if (!confirm(`Replace all data on this device with this backup?\n\n${counts}`)) return;
      await replaceAll(parsed);
      setMsg(`Imported: ${counts}.`);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <Sheet title="Settings & backup" onClose={onClose}>
      <Switch label="Minimum Plan mode" sub="Goal becomes holding steady: shake daily, real lunch daily, 2 lifts/week" checked={data.settings.minimumPlan} onChange={(v) => setSettings({ ...data.settings, minimumPlan: v })} />
      <div className="card" style={{ padding: 14 }}>
        <h2>Backup</h2>
        <div className="muted small">Everything is stored only on this device. Export regularly — deleting the home-screen app or clearing Safari website data erases it.</div>
        <button className="btn primary block" onClick={exportJson}>Export JSON backup</button>
        <button className="btn block" onClick={() => file.current?.click()}>Import JSON backup…</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
        {msg && <div className="small" role="status">{msg}</div>}
      </div>
      <div className="muted small">
        {data.waist.length} waist · {data.weight.length} weigh-ins · {data.lifts.length} lift sessions · {data.runs.length} runs · {data.habits.length} habit days
      </div>
    </Sheet>
  );
}
