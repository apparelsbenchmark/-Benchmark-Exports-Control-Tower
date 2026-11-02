'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TargetLine } from '@/lib/types';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Mode = 'production' | 'quality';
type AuthConfig = { admin: boolean; supervisor: boolean; sharedFallback: boolean };

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
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function InputPage() {
  const [mode, setMode] = useState<Mode>('production');
  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinChecking, setPinChecking] = useState(false);
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);
  const [lines, setLines] = useState<TargetLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(true);
  const [linesError, setLinesError] = useState('');
  const [date, setDate] = useState('');
  const [line, setLine] = useState('1');
  const [hour, setHour] = useState('1');
  const [buyer, setBuyer] = useState('');
  const [style, setStyle] = useState('');
  const [po, setPo] = useState('');
  const [color, setColor] = useState('');
  const [pcs, setPcs] = useState('');
  const [remark, setRemark] = useState('');
  const [checked, setChecked] = useState('');
  const [pass, setPass] = useState('');
  const [defect, setDefect] = useState('');
  const [defectCode, setDefectCode] = useState('');
  const [defectDescription, setDefectDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadLines = useCallback(async () => {
    setLinesLoading(true);
    setLinesError('');
    try {
      const response = await fetch('/api/targets', { cache: 'no-store' });
      const result = await readJson(response);
      if (!response.ok || !result.ok || !Array.isArray(result.data?.lines)) {
        throw new Error(result.error || 'The line configuration could not be loaded.');
      }
      setLines(result.data.lines as TargetLine[]);
    } catch (err) {
      setLinesError(err instanceof Error ? err.message : 'Could not load line configuration.');
    } finally {
      setLinesLoading(false);
    }
  }, []);

  useEffect(() => {
    setDate(todayKey());
    loadLines();
    fetch('/api/auth', { cache: 'no-store' })
      .then(readJson)
      .then(result => setPinConfigured(Boolean(result.ok && result.configured?.supervisor)))
      .catch(() => setPinConfigured(null));
  }, [loadLines]);

  const selected = useMemo(
    () => lines.find(item => item.line === Number(line)),
    [lines, line]
  );

  useEffect(() => {
    if (!selected) return;
    setBuyer(selected.buyer || '');
    setStyle(selected.style || '');
    setPo(selected.po || '');
    setColor(selected.color || '');
  }, [selected]);

  async function verifyPin() {
    if (!pin.trim()) {
      setError('Enter your Supervisor PIN first.');
      return;
    }

    setPinChecking(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-control-pin': pin },
        body: JSON.stringify({ role: 'supervisor' }),
        cache: 'no-store'
      });
      const result = await readJson(response);
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Supervisor PIN verification failed.');
      }
      setPinVerified(true);
      setMessage('Supervisor access verified. Complete the form and save your entry.');
    } catch (err) {
      setPinVerified(false);
      setError(err instanceof Error ? err.message : 'PIN verification failed.');
    } finally {
      setPinChecking(false);
    }
  }

  function clearForm() {
    setPcs('');
    setRemark('');
    setChecked('');
    setPass('');
    setDefect('');
    setDefectCode('');
    setDefectDescription('');
    setMessage('');
    setError('');
  }

  const lineMasterReady = lines.length === 14;
  const canSubmit = lineMasterReady && (mode === 'production'
    ? Boolean(date && pcs.trim() !== '' && Number.isInteger(Number(pcs)) && Number(pcs) >= 0)
    : Boolean(
        date &&
        checked.trim() !== '' && pass.trim() !== '' && defect.trim() !== '' &&
        [checked, pass, defect].every(value => Number.isInteger(Number(value)) && Number(value) >= 0) &&
        Number(pass) <= Number(checked) &&
        Number(defect) <= Number(checked) &&
        Number(pass) + Number(defect) <= Number(checked)
      ));

  async function submit() {
    if (!pinVerified) {
      setError('Verify your Supervisor PIN before saving.');
      return;
    }
    if (!canSubmit) {
      setError(mode === 'production'
        ? 'Enter a valid whole-number production quantity and production date.'
        : 'Enter valid whole-number Checked, Pass and Defect PCS. Pass PCS cannot exceed Checked PCS.');
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const payload = mode === 'production'
        ? {
            date, line: Number(line), hour: Number(hour), buyer, style, po, color,
            pcs: Number(pcs), remark, requestId: makeRequestId()
          }
        : {
            date, line: Number(line), buyer, style, po,
            checked: Number(checked), pass: Number(pass), defect: Number(defect),
            defectCode, defectDescription, requestId: makeRequestId()
          };

      const response = await fetch(mode === 'production' ? '/api/production' : '/api/quality-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-control-pin': pin },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });
      const result = await readJson(response);
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'The record could not be saved.');
      }

      setMessage(result.data?.duplicate
        ? 'This submission was already received. No duplicate row was added.'
        : 'Saved successfully to Google Sheets. Dashboards will refresh automatically.');

      if (mode === 'production') {
        setPcs('');
        setRemark('');
      } else {
        setChecked('');
        setPass('');
        setDefect('');
        setDefectCode('');
        setDefectDescription('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="app-topbar">
        <Link href="/" className="mini-brand"><span>B</span> BENCHMARK <b>EXPORTS</b></Link>
        <nav><Link href="/tv">Production TV</Link><Link href="/quality">Quality</Link><Link href="/targets">Targets</Link></nav>
        <div className="top-live"><i/> INPUT TERMINAL</div>
      </header>

      <section className="admin-heading">
        <div>
          <div className="eyebrow">AUTHORISED SHOP-FLOOR ENTRY</div>
          <h1>Production <span>&amp; Quality Input</span></h1>
          <p>Submit line/hour data directly into the existing Google Sheets records.</p>
        </div>
        <div className="access-box">
          <label>SUPERVISOR ACCESS PIN</label>
          <div className="pin-entry-row">
            <input
              type="password"
              value={pin}
              onChange={event => { setPin(event.target.value); setPinVerified(false); setError(''); }}
              onKeyDown={event => { if (event.key === 'Enter') void verifyPin(); }}
              placeholder="Enter authorised PIN"
              autoComplete="off"
              aria-label="Supervisor access PIN"
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
            {pinVerified ? 'Supervisor access is verified.' :
              pinConfigured === false ? 'PIN is not configured. Check .env.local and restart.' :
              pinConfigured === null ? 'Checking PIN configuration…' :
              'Verify your PIN to enable the Save button.'}
          </small>
        </div>
      </section>

      <div className="mode-tabs">
        <button type="button" className={mode === 'production' ? 'active' : ''} onClick={() => { setMode('production'); setMessage(''); setError(''); }}>＋ PRODUCTION ENTRY</button>
        <button type="button" className={mode === 'quality' ? 'active' : ''} onClick={() => { setMode('quality'); setMessage(''); setError(''); }}>◈ QUALITY ENTRY</button>
      </div>

      <section className="form-panel">
        <div className="form-panel-title">
          <div>
            <div className="eyebrow">{mode === 'production' ? 'HOURLY OUTPUT RECORD' : 'INSPECTION RECORD'}</div>
            <h2>{mode === 'production' ? 'Record Line Production' : 'Record Quality Inspection'}</h2>
          </div>
          <span className="secure-pill">● {pinVerified ? 'ACCESS VERIFIED' : 'SECURE ENTRY'}</span>
        </div>

        <div className="form-grid">
          <div className="field"><label>PRODUCTION DATE</label><input type="date" value={date} onChange={event => setDate(event.target.value)} required/></div>
          <div className="field">
            <label>PRODUCTION LINE</label>
            <select value={line} onChange={event => setLine(event.target.value)}>
              {Array.from({ length: 14 }, (_, index) => {
                const n = index + 1;
                const config = lines.find(item => item.line === n);
                return <option key={n} value={n}>Line {String(n).padStart(2, '0')}{config && !config.active ? ' (inactive)' : ''}</option>;
              })}
            </select>
          </div>
          {mode === 'production' && <div className="field"><label>HOUR SLOT</label><select value={hour} onChange={event => setHour(event.target.value)}>{Array.from({ length: 11 }, (_, index) => <option key={index} value={index + 1}>H{index + 1}</option>)}</select></div>}
          <div className="field"><label>BUYER</label><input value={buyer} onChange={event => setBuyer(event.target.value)} placeholder="Buyer name"/></div>
          <div className="field"><label>STYLE</label><input value={style} onChange={event => setStyle(event.target.value)} placeholder="Style number"/></div>
          <div className="field"><label>PO</label><input value={po} onChange={event => setPo(event.target.value)} placeholder="PO number"/></div>

          {mode === 'production' ? <>
            <div className="field"><label>COLOR</label><input value={color} onChange={event => setColor(event.target.value)} placeholder="Color"/></div>
            <div className="field emphasis-field"><label>PRODUCTION PCS</label><input type="number" min="0" step="1" inputMode="numeric" value={pcs} onChange={event => setPcs(event.target.value)} placeholder="Enter produced quantity"/></div>
            <div className="field field-wide"><label>REMARK (OPTIONAL)</label><input value={remark} onChange={event => setRemark(event.target.value)} placeholder="Short production note"/></div>
          </> : <>
            <div className="field emphasis-field"><label>CHECKED PCS</label><input type="number" min="0" step="1" value={checked} onChange={event => setChecked(event.target.value)} placeholder="Inspected quantity"/></div>
            <div className="field"><label>PASS PCS</label><input type="number" min="0" step="1" value={pass} onChange={event => setPass(event.target.value)} placeholder="Passed quantity"/></div>
            <div className="field"><label>DEFECT PCS</label><input type="number" min="0" step="1" value={defect} onChange={event => setDefect(event.target.value)} placeholder="Defect quantity"/></div>
            <div className="field"><label>DEFECT CODE</label><input value={defectCode} onChange={event => setDefectCode(event.target.value)} placeholder="Optional code"/></div>
            <div className="field"><label>DEFECT DESCRIPTION</label><input value={defectDescription} onChange={event => setDefectDescription(event.target.value)} placeholder="Defect type / description"/></div>
          </>}
        </div>

        <div className="line-context">
          <span>LINE {String(Number(line)).padStart(2, '0')} CONFIGURATION</span>
          {linesLoading ? <b>LOADING…</b> : selected ? <>
            <b>SMV {selected.smv || 'Not set'}</b>
            <b>MANPOWER {selected.manpower || 'Not set'}</b>
            <b>TARGET {selected.dailyTarget ? selected.dailyTarget.toLocaleString() + ' PCS' : 'Not set'}</b>
          </> : <b>LINE MASTER NOT LOADED</b>}
          <button type="button" className="text-action" onClick={loadLines} disabled={linesLoading}>{linesLoading ? 'LOADING…' : '↻ RELOAD LINE DATA'}</button>
        </div>
        {linesError && <div className="notice error">Line configuration warning: {linesError}</div>}
        {message && <div className="notice success">✓ {message}</div>}
        {error && <div className="notice error">! {error}</div>}

        <div className="form-actions">
          <div className="form-action-help">
            <span>Entries are timestamped and appended to the original {mode === 'production' ? 'INPUT' : 'QUALITY INPUT'} sheet.</span>
            <small>{!pinVerified ? 'Verify Supervisor PIN to unlock saving.' : !lineMasterReady ? 'Wait for all 14 LINE MASTER records to load.' : !canSubmit ? 'Complete the required fields with valid whole numbers. Pass PCS + Defect PCS cannot exceed Checked PCS.' : 'Ready to submit.'}</small>
          </div>
          <div className="form-action-buttons">
            <button type="button" className="secondary-button" onClick={clearForm} disabled={busy}>CLEAR FORM</button>
            <button type="button" className="primary-button" disabled={busy || !pinVerified || !canSubmit} onClick={submit}>
              {busy ? 'SAVING…' : mode === 'production' ? 'SAVE PRODUCTION ENTRY →' : 'SAVE QUALITY ENTRY →'}
            </button>
          </div>
        </div>
      </section>

      <div className="helper-note"><b>Live workflow:</b> Save → Google Sheets write → data version increments → Production TV and Quality Dashboard refresh automatically.</div>
      <footer className="app-footer"><span>BENCHMARK EXPORTS · INPUT TERMINAL</span><span>ACCESS CONTROL ENABLED</span></footer>
    </main>
  );
}
