'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { TargetLine } from '@/lib/types';
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
type Mode = 'production' | 'quality';
export default function InputPage() {
  const [mode, setMode] = useState<Mode>('production');
  const [pin, setPin] = useState('');
  const [lines, setLines] = useState<TargetLine[]>([]);
  const [date, setDate] = useState('');
  const [line, setLine] = useState('1');
  const [hour, setHour] = useState('1');
  const [buyer, setBuyer] = useState(''); const [style, setStyle] = useState(''); const [po, setPo] = useState(''); const [color, setColor] = useState('');
  const [pcs, setPcs] = useState(''); const [remark, setRemark] = useState('');
  const [checked, setChecked] = useState(''); const [pass, setPass] = useState(''); const [defect, setDefect] = useState(''); const [defectCode, setDefectCode] = useState(''); const [defectDescription, setDefectDescription] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    setDate(todayKey());
    fetch('/api/targets', {cache:'no-store'}).then(r=>r.json()).then(j=>{if(j.ok)setLines(j.data.lines);}).catch(()=>{});
  }, []);
  const selected = useMemo(() => lines.find(x => x.line === Number(line)), [lines, line]);
  useEffect(() => { if (selected) { setBuyer(selected.buyer || ''); setStyle(selected.style || ''); setPo(selected.po || ''); setColor(selected.color || ''); } }, [selected]);
  async function submit() {
    setBusy(true); setMessage(''); setError('');
    try {
      const payload = mode === 'production'
        ? { date, line: Number(line), hour: Number(hour), buyer, style, po, color, pcs: Number(pcs), remark, requestId: crypto.randomUUID() }
        : { date, line: Number(line), buyer, style, po, checked: Number(checked), pass: Number(pass), defect: Number(defect), defectCode, defectDescription, requestId: crypto.randomUUID() };
      const r = await fetch(mode === 'production' ? '/api/production' : '/api/quality-input', { method:'POST', headers:{'Content-Type':'application/json','x-control-pin':pin}, body:JSON.stringify(payload) });
      const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.error || 'Unable to save record.');
      setMessage(j.data.duplicate ? 'This submission was already received. No duplicate row was added.' : 'Saved successfully. The production TV will synchronize within a few seconds.');
      if (mode === 'production') { setPcs(''); setRemark(''); } else { setChecked(''); setPass(''); setDefect(''); setDefectCode(''); setDefectDescription(''); }
    } catch(e) { setError(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setBusy(false); }
  }
  return <main className="admin-shell"><header className="app-topbar"><Link href="/" className="mini-brand"><span>B</span> BENCHMARK <b>EXPORTS</b></Link><nav><Link href="/tv">Production TV</Link><Link href="/quality">Quality</Link><Link href="/targets">Targets</Link></nav><div className="top-live"><i/> INPUT TERMINAL</div></header>
    <section className="admin-heading"><div><div className="eyebrow">AUTHORISED SHOP-FLOOR ENTRY</div><h1>Production <span>& Quality Input</span></h1><p>Submit line/hour data directly into the existing Google Sheets records.</p></div><div className="access-box"><label>SUPERVISOR ACCESS PIN</label><input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Enter authorised PIN"/></div></section>
    <div className="mode-tabs"><button className={mode==='production'?'active':''} onClick={()=>setMode('production')}>＋ PRODUCTION ENTRY</button><button className={mode==='quality'?'active':''} onClick={()=>setMode('quality')}>◈ QUALITY ENTRY</button></div>
    <section className="form-panel"><div className="form-panel-title"><div><div className="eyebrow">{mode==='production'?'HOURLY OUTPUT RECORD':'INSPECTION RECORD'}</div><h2>{mode==='production'?'Record Line Production':'Record Quality Inspection'}</h2></div><span className="secure-pill">● SECURE ENTRY</span></div>
      <div className="form-grid">
        <div className="field"><label>PRODUCTION DATE</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="field"><label>PRODUCTION LINE</label><select value={line} onChange={e=>setLine(e.target.value)}>{Array.from({length:14},(_,i)=><option key={i} value={i+1}>Line {String(i+1).padStart(2,'0')}</option>)}</select></div>
        {mode==='production' && <div className="field"><label>HOUR SLOT</label><select value={hour} onChange={e=>setHour(e.target.value)}>{Array.from({length:11},(_,i)=><option key={i} value={i+1}>H{i+1}</option>)}</select></div>}
        <div className="field"><label>BUYER</label><input value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Buyer name"/></div>
        <div className="field"><label>STYLE</label><input value={style} onChange={e=>setStyle(e.target.value)} placeholder="Style number"/></div>
        <div className="field"><label>PO</label><input value={po} onChange={e=>setPo(e.target.value)} placeholder="PO number"/></div>
        {mode==='production' && <div className="field"><label>COLOR</label><input value={color} onChange={e=>setColor(e.target.value)} placeholder="Color"/></div>}
        {mode==='production' ? <div className="field emphasis-field"><label>PRODUCTION PCS</label><input type="number" min="0" step="1" inputMode="numeric" value={pcs} onChange={e=>setPcs(e.target.value)} placeholder="Enter produced quantity"/></div> : <>
          <div className="field emphasis-field"><label>CHECKED PCS</label><input type="number" min="0" value={checked} onChange={e=>setChecked(e.target.value)} placeholder="Inspected quantity"/></div>
          <div className="field"><label>PASS PCS</label><input type="number" min="0" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Passed quantity"/></div>
          <div className="field"><label>DEFECT PCS</label><input type="number" min="0" value={defect} onChange={e=>setDefect(e.target.value)} placeholder="Defect quantity"/></div>
          <div className="field"><label>DEFECT CODE</label><input value={defectCode} onChange={e=>setDefectCode(e.target.value)} placeholder="Optional code"/></div>
          <div className="field"><label>DEFECT DESCRIPTION</label><input value={defectDescription} onChange={e=>setDefectDescription(e.target.value)} placeholder="Defect type / description"/></div>
        </>}
        {mode==='production' && <div className="field field-wide"><label>REMARK (OPTIONAL)</label><input value={remark} onChange={e=>setRemark(e.target.value)} placeholder="Short production note"/></div>}
      </div>
      {selected && <div className="line-context"><span>LINE {String(selected.line).padStart(2,'0')} CONFIGURATION</span><b>SMV {selected.smv || 'Not set'}</b><b>MANPOWER {selected.manpower || 'Not set'}</b><b>TARGET {selected.dailyTarget ? selected.dailyTarget.toLocaleString()+' PCS' : 'Not set'}</b></div>}
      {message && <div className="notice success">✓ {message}</div>}{error && <div className="notice error">! {error}</div>}
      <div className="form-actions"><span>Entries are timestamped and appended to the original {mode==='production'?'INPUT':'QUALITY INPUT'} sheet.</span><button className="primary-button" disabled={busy || !pin || (mode==='production' ? pcs==='' : checked==='' || pass==='' || defect==='')} onClick={submit}>{busy?'SAVING…':mode==='production'?'SAVE PRODUCTION ENTRY →':'SAVE QUALITY ENTRY →'}</button></div>
    </section>
    <div className="helper-note"><b>Live workflow:</b> Save → Google Sheets write → dashboard data version increments → TV refreshes within approximately 5 seconds. A five-minute scheduled refresh remains active as a backup.</div>
    <footer className="app-footer"><span>BENCHMARK EXPORTS · INPUT TERMINAL</span><span>ACCESS CONTROL ENABLED</span></footer>
  </main>;
}
