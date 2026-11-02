'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TargetLine } from '@/lib/types';

type EditableLine = Omit<TargetLine, 'hourlyTargets' | 'dailyTarget' | 'smv' | 'manpower' | 'efficiencyTarget' | 'dhuTarget' | 'workingMinutes'> & {
  dailyTarget: number | string;
  smv: number | string;
  manpower: number | string;
  efficiencyTarget: number | string;
  dhuTarget: number | string;
  workingMinutes: number | string;
  hourlyTargets: string[];
};

const blankLine = (line: number): EditableLine => ({
  line,
  active: true,
  dailyTarget: '',
  smv: '',
  manpower: '',
  efficiencyTarget: 55,
  dhuTarget: '',
  workingMinutes: 660,
  buyer: '',
  style: '',
  po: '',
  color: '',
  hourlyTargets: Array(11).fill('')
});

const asEditable = (item: TargetLine): EditableLine => ({
  ...item,
  hourlyTargets: (item.hourlyTargets || Array(11).fill(null)).map(value => value == null ? '' : String(value))
});

async function readJson(response: Response) {
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== 'object') {
    throw new Error(`The server returned an unreadable response (HTTP ${response.status}).`);
  }
  return result as Record<string, any>;
}

function makeRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `targets-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function TargetsPage() {
  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinChecking, setPinChecking] = useState(false);
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);
  const [lines, setLines] = useState<EditableLine[]>(Array.from({ length: 14 }, (_, index) => blankLine(index + 1)));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);

  const loadLines = useCallback(async () => {
    setLoading(true);
    setLoaded(false);
    setError('');
    try {
      const response = await fetch('/api/targets', { cache: 'no-store' });
      const result = await readJson(response);
      if (!response.ok || !result.ok || !Array.isArray(result.data?.lines) || result.data.lines.length !== 14) {
        throw new Error(result.error || 'LINE MASTER must return all 14 production lines.');
      }
      const sorted = [...result.data.lines].sort((a: TargetLine, b: TargetLine) => a.line - b.line);
      setLines(sorted.map(asEditable));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load line configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLines();
    fetch('/api/auth', { cache: 'no-store' })
      .then(readJson)
      .then(result => setPinConfigured(Boolean(result.ok && result.configured?.admin)))
      .catch(() => setPinConfigured(null));
  }, [loadLines]);

  function update(line: number, key: keyof EditableLine, value: unknown) {
    setLines(old => old.map(item => item.line === line ? { ...item, [key]: value } as EditableLine : item));
    setMessage('');
  }

  function updateHour(line: number, hour: number, value: string) {
    setLines(old => old.map(item => item.line === line
      ? { ...item, hourlyTargets: item.hourlyTargets.map((current, index) => index === hour ? value : current) }
      : item));
    setMessage('');
  }

  function distributeHours(line: number) {
    const item = lines.find(current => current.line === line);
    const daily = Math.round(Number(item?.dailyTarget) || 0);
    if (!item || daily <= 0) {
      setError(`Enter a daily target for Line ${String(line).padStart(2, '0')} before distributing it.`);
      return;
    }
    const base = Math.floor(daily / 11);
    const remainder = daily - base * 11;
    const hours = Array.from({ length: 11 }, (_, index) => String(base + (index < remainder ? 1 : 0)));
    setLines(old => old.map(current => current.line === line ? { ...current, hourlyTargets: hours } : current));
    setError('');
    setMessage(`Line ${String(line).padStart(2, '0')}: daily target distributed across H1–H11.`);
  }

  function clearHourlyOverride(line: number) {
    setLines(old => old.map(current => current.line === line
      ? { ...current, hourlyTargets: Array(11).fill('') }
      : current));
    setError('');
    setMessage(`Line ${String(line).padStart(2, '0')} returned to automatic hourly distribution.`);
  }

  async function verifyPin() {
    if (!pin.trim()) {
      setError('Enter your Admin PIN first.');
      return;
    }
    setPinChecking(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-control-pin': pin },
        body: JSON.stringify({ role: 'admin' }),
        cache: 'no-store'
      });
      const result = await readJson(response);
      if (!response.ok || !result.ok) throw new Error(result.error || 'Admin PIN verification failed.');
      setPinVerified(true);
      setMessage('Admin access verified. You can now save line configuration.');
    } catch (err) {
      setPinVerified(false);
      setError(err instanceof Error ? err.message : 'PIN verification failed.');
    } finally {
      setPinChecking(false);
    }
  }

  const validation = useMemo(() => {
    for (const item of lines) {
      const numeric = [
        ['Daily target', item.dailyTarget],
        ['SMV', item.smv],
        ['Manpower', item.manpower],
        ['Efficiency target', item.efficiencyTarget],
        ['DHU target', item.dhuTarget],
        ['Working minutes', item.workingMinutes]
      ] as const;

      for (const [label, raw] of numeric) {
        if (raw === '' || raw == null) continue;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          return `Line ${String(item.line).padStart(2, '0')}: ${label} must be a non-negative number.`;
        }
      }

      if (item.dailyTarget !== '' && !Number.isInteger(Number(item.dailyTarget))) {
        return `Line ${String(item.line).padStart(2, '0')}: daily target must be a whole number of pieces.`;
      }
      if (item.manpower !== '' && !Number.isInteger(Number(item.manpower))) {
        return `Line ${String(item.line).padStart(2, '0')}: manpower must be a whole number.`;
      }
      if (Number(item.workingMinutes) < 1 || Number(item.workingMinutes) > 1440 || !Number.isInteger(Number(item.workingMinutes))) {
        return `Line ${String(item.line).padStart(2, '0')}: working minutes must be a whole number between 1 and 1440.`;
      }
      if (Number(item.efficiencyTarget) > 200 || Number(item.dhuTarget) > 100) {
        return `Line ${String(item.line).padStart(2, '0')}: efficiency target cannot exceed 200% and DHU target cannot exceed 100%.`;
      }

      const custom = item.hourlyTargets.filter(value => value.trim() !== '');
      if (custom.some(value => !Number.isInteger(Number(value)) || Number(value) < 0)) {
        return `Line ${String(item.line).padStart(2, '0')}: hourly targets must be whole non-negative numbers.`;
      }
      if (custom.length > 0 && Number(item.dailyTarget) > 0) {
        const sum = custom.reduce((total, value) => total + Number(value), 0);
        if (Math.abs(sum - Number(item.dailyTarget)) > 0.001) {
          return `Line ${String(item.line).padStart(2, '0')}: H1–H11 total (${sum}) must equal the daily target (${item.dailyTarget}). Use AUTO DISTRIBUTE or adjust the hourly values.`;
        }
      }
    }
    return '';
  }, [lines]);

  async function save() {
    if (!pinVerified) {
      setError('Verify your Admin PIN before saving.');
      return;
    }
    if (!loaded) {
      setError('Wait until LINE MASTER has loaded before saving.');
      return;
    }
    if (validation) {
      setError(validation);
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        lines: lines.map(item => ({
          ...item,
          dailyTarget: Number(item.dailyTarget) || 0,
          smv: Number(item.smv) || 0,
          manpower: Number(item.manpower) || 0,
          efficiencyTarget: Number(item.efficiencyTarget) || 0,
          dhuTarget: Number(item.dhuTarget) || 0,
          workingMinutes: Number(item.workingMinutes) || 660,
          hourlyTargets: item.hourlyTargets.map(value => value.trim() === '' ? '' : Number(value))
        })),
        requestId: makeRequestId()
      };

      const response = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-control-pin': pin },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });
      const result = await readJson(response);
      if (!response.ok || !result.ok) throw new Error(result.error || 'Target configuration could not be saved.');

      setMessage(`Successfully saved ${result.data?.lines || 14} line configurations to Google Sheets.`);
      await loadLines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save targets. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="app-topbar">
        <Link href="/" className="mini-brand"><span>B</span> BENCHMARK <b>EXPORTS</b></Link>
        <nav><Link href="/tv">Production TV</Link><Link href="/quality">Quality</Link><Link href="/input">Input</Link></nav>
        <div className="top-live"><i/> LINE CONFIGURATION</div>
      </header>

      <section className="admin-heading">
        <div>
          <div className="eyebrow">LINE MASTER &amp; PRODUCTION STANDARDS</div>
          <h1>Line Target <span>Configuration</span></h1>
          <p>Set a separate daily target, SMV and manpower for every active production line.</p>
        </div>
        <div className="access-box">
          <label>ADMIN ACCESS PIN</label>
          <div className="pin-entry-row">
            <input
              type="password"
              value={pin}
              onChange={event => { setPin(event.target.value); setPinVerified(false); setError(''); }}
              onKeyDown={event => { if (event.key === 'Enter') void verifyPin(); }}
              placeholder="Enter authorised PIN"
              autoComplete="off"
              aria-label="Admin access PIN"
            />
            <button
              type="button"
              className={`verify-pin-button${pinVerified ? ' verified' : ''}`}
              onClick={verifyPin}
              disabled={pinChecking || !pin.trim()}
            >
              {pinChecking ? 'VERIFYING…' : pinVerified ? '✓ VERIFIED' : 'VERIFY PIN'}
            </button>
          </div>
          <small className={pinVerified ? 'pin-state success' : 'pin-state'}>
            {pinVerified ? 'Admin access is verified.' :
              pinConfigured === false ? 'PIN is not configured. Check .env.local and restart.' :
              pinConfigured === null ? 'Checking PIN configuration…' :
              'Verify your PIN to enable Save All Line Targets.'}
          </small>
        </div>
      </section>

      <div className="target-explain">
        <div><b>RED</b><span>Actual below target</span></div>
        <div><b>GREEN</b><span>Target achieved or exceeded</span></div>
        <div><b>SMV EFFICIENCY</b><span>Produced PCS × SMV ÷ manpower minutes</span></div>
        <div><b>HOURLY PLAN</b><span>Leave H1–H11 blank to distribute daily target evenly</span></div>
      </div>

      <section className="target-panel">
        <div className="panel-heading">
          <div><div className="eyebrow">14-LINE MASTER</div><h2>Daily target &amp; efficiency standards</h2></div>
          <div className="panel-tools">
            <span className="small-note">{loading ? 'LOADING CONFIGURATION…' : loaded ? 'CONFIGURATION LOADED' : 'CONFIGURATION NOT LOADED'}</span>
            <button type="button" className="text-action" onClick={loadLines} disabled={loading || busy}>{loading ? 'LOADING…' : '↻ RELOAD FROM SHEETS'}</button>
          </div>
        </div>

        <div className="target-table-wrap">
          <table className="target-table">
            <thead><tr><th>LINE</th><th>ACTIVE</th><th>DAILY TARGET<br/>PCS</th><th>SMV<br/>MIN/PC</th><th>MANPOWER<br/>PERSONS</th><th>EFF. TARGET<br/>%</th><th>DHU TARGET<br/>%</th><th>WORK MIN<br/>/ DAY</th></tr></thead>
            <tbody>
              {lines.map(item => (
                <tr key={item.line}>
                  <td><b className="target-line-no">{String(item.line).padStart(2, '0')}</b></td>
                  <td><input className="active-toggle" type="checkbox" checked={item.active} onChange={event => update(item.line, 'active', event.target.checked)} aria-label={`Activate line ${item.line}`}/></td>
                  <td><input className="table-input target-number" type="number" min="0" step="1" value={item.dailyTarget} onChange={event => update(item.line, 'dailyTarget', event.target.value)} aria-label={`Line ${item.line} daily target`}/></td>
                  <td><input className="table-input" type="number" min="0" step="0.01" value={item.smv} onChange={event => update(item.line, 'smv', event.target.value)} aria-label={`Line ${item.line} SMV`}/></td>
                  <td><input className="table-input" type="number" min="0" step="1" value={item.manpower} onChange={event => update(item.line, 'manpower', event.target.value)} aria-label={`Line ${item.line} manpower`}/></td>
                  <td><input className="table-input" type="number" min="0" max="200" step="0.1" value={item.efficiencyTarget} onChange={event => update(item.line, 'efficiencyTarget', event.target.value)} aria-label={`Line ${item.line} efficiency target`}/></td>
                  <td><input className="table-input" type="number" min="0" max="100" step="0.1" value={item.dhuTarget} onChange={event => update(item.line, 'dhuTarget', event.target.value)} aria-label={`Line ${item.line} DHU target`}/></td>
                  <td><input className="table-input" type="number" min="1" max="1440" step="1" value={item.workingMinutes} onChange={event => update(item.line, 'workingMinutes', event.target.value)} aria-label={`Line ${item.line} working minutes`}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="hour-targets">
          <div className="eyebrow">OPTIONAL HOURLY TARGET OVERRIDE</div>
          <p>Use this when a line has different production targets across H1–H11. Leave every hour blank to distribute the daily target equally.</p>
          <div className="hour-target-grid">
            {lines.map(item => (
              <details className="hour-target-card" key={item.line}>
                <summary>
                  LINE {String(item.line).padStart(2, '0')}
                  <span>{item.hourlyTargets.some(value => value !== '') ? 'CUSTOM PLAN · OPEN' : 'AUTO DISTRIBUTION · OPEN'}</span>
                </summary>
                <div className="hour-plan-actions">
                  <button type="button" className="text-action" onClick={() => distributeHours(item.line)}>＋ AUTO DISTRIBUTE DAILY TARGET</button>
                  <button type="button" className="text-action muted" onClick={() => clearHourlyOverride(item.line)}>CLEAR OVERRIDE</button>
                </div>
                <div className="hour-target-fields">
                  {item.hourlyTargets.map((value, index) => (
                    <label key={index}>H{index + 1}<input type="number" min="0" step="1" value={value} onChange={event => updateHour(item.line, index, event.target.value)} placeholder="Auto"/></label>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>

        {message && <div className="notice success">✓ {message}</div>}
        {error && <div className="notice error">! {error}</div>}

        <div className="target-actions">
          <div className="target-action-help">
            <span>Changes are saved to the LINE MASTER sheet. Existing production records are not changed.</span>
            <small>{!pinVerified ? 'Verify Admin PIN to unlock saving.' : !loaded ? 'Wait for line configuration to load.' : validation || 'Ready to save all 14 lines.'}</small>
          </div>
          <button type="button" className="primary-button" disabled={busy || !pinVerified || !loaded || Boolean(validation)} onClick={save}>
            {busy ? 'SAVING CONFIGURATION…' : 'SAVE ALL LINE TARGETS →'}
          </button>
        </div>
      </section>

      <footer className="app-footer"><span>BENCHMARK EXPORTS · LINE MASTER</span><span>SMV &amp; MANPOWER-BASED EFFICIENCY</span></footer>
    </main>
  );
}
