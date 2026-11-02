'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QualityData, QualityLine } from '@/lib/types';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmt = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value) || 0);
const percent = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
const clock = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function getLineStatus(line: QualityLine) {
  if (line.checked <= 0) return 'NO DATA';
  if (line.dhuTarget <= 0) return 'NO TARGET';
  if (line.dhu > line.dhuTarget) return 'ACTION';
  if (line.dhu > line.dhuTarget * 0.8) return 'WATCH';
  return 'GOOD';
}

function QualityLineRow({ line }: { line: QualityLine }) {
  const status = getLineStatus(line);
  const statusClass = status === 'GOOD' ? 'v4-q-good' : status === 'WATCH' ? 'v4-q-watch' : status === 'ACTION' ? 'v4-q-action' : 'v4-q-none';
  const dhuClass = status === 'GOOD' ? 'v4-good-text' : status === 'WATCH' ? 'v4-watch-text' : status === 'ACTION' ? 'v4-bad-text' : 'v4-muted-text';
  return (
    <tr>
      <td className="v4-q-line">L{String(line.line).padStart(2, '0')}</td>
      <td>{fmt(line.checked)}</td>
      <td className="v4-good-text">{fmt(line.pass)}</td>
      <td className="v4-bad-text">{fmt(line.defect)}</td>
      <td>{percent(line.passRate)}</td>
      <td className={`v4-q-dhu ${dhuClass}`}>{percent(line.dhu)}</td>
      <td>{line.dhuTarget > 0 ? percent(line.dhuTarget) : '—'}</td>
      <td><span className={`v4-q-status ${statusClass}`}>{status}</span></td>
    </tr>
  );
}

function QualityKpi({ label, value, note, tone, symbol }: { label: string; value: string; note: string; tone: string; symbol: string }) {
  return <div className={`v4-q-kpi ${tone}`}><div className="v4-q-kpi-label"><span>{symbol}</span>{label}</div><strong>{value}</strong><small>{note}</small></div>;
}

export default function QualityPage() {
  const [data, setData] = useState<QualityData | null>(null);
  const [date, setDate] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const requestBusy = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (requestBusy.current) return;
    requestBusy.current = true;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/quality?date=${encodeURIComponent(date)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to load quality data');
      setData(result.data as QualityData);
      setError('');
      setLastSync(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quality data connection failed');
    } finally {
      requestBusy.current = false;
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    // Resolve the local report date after hydration to keep server/client HTML identical.
    setDate(todayKey());
  }, []);

  useEffect(() => {
    if (!date) return;
    load();
    const timer = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(timer);
  }, [load, date]);

  useEffect(() => {
    // Set the clock only after hydration to keep server and browser HTML identical.
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const k = data?.kpis;
  const lineStats = useMemo(() => {
    const lines = data?.lines || [];
    const good = lines.filter(line => getLineStatus(line) === 'GOOD').length;
    const watch = lines.filter(line => getLineStatus(line) === 'WATCH').length;
    const action = lines.filter(line => getLineStatus(line) === 'ACTION').length;
    const noData = lines.filter(line => getLineStatus(line) === 'NO DATA').length;
    const noTarget = lines.filter(line => getLineStatus(line) === 'NO TARGET').length;
    const inspected = lines.filter(line => line.checked > 0);
    const best = inspected.length ? [...inspected].sort((a, b) => a.dhu - b.dhu)[0] : null;
    const worst = inspected.length ? [...inspected].sort((a, b) => b.dhu - a.dhu)[0] : null;
    return { good, watch, action, noData, noTarget, best, worst };
  }, [data]);

  const defectParts = useMemo(() => {
    if (!data || !data.kpis.defect) return [] as { name: string; pcs: number }[];
    const top = data.topDefects.slice(0, 4).map(item => ({ name: item.name, pcs: item.pcs }));
    const topTotal = top.reduce((sum, item) => sum + item.pcs, 0);
    const other = Math.max(0, data.kpis.defect - topTotal);
    if (other > 0) top.push({ name: 'Others', pcs: other });
    return top;
  }, [data]);

  const donutStyle = useMemo(() => {
    const total = defectParts.reduce((sum, item) => sum + item.pcs, 0);
    if (!total) return { background: '#1b3045' } as CSSProperties;
    const colors = ['#159cf4', '#ff9c31', '#23c878', '#b05ae7', '#8293a5'];
    let cursor = 0;
    const segments = defectParts.map((item, index) => {
      const start = cursor;
      cursor += item.pcs / total * 100;
      return `${colors[index % colors.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    return { background: `conic-gradient(${segments.join(', ')})` } as CSSProperties;
  }, [defectParts]);

  const defectTotal = defectParts.reduce((sum, item) => sum + item.pcs, 0);
  const lastSyncAge = lastSync && now ? Math.max(0, Math.floor((now.getTime() - lastSync.getTime()) / 1000)) : null;

  return (
    <main className="v4-quality-screen">
      <header className="v4-quality-header">
        <div className="v4-brand-lockup">
          <span className="v4-group-logo-frame"><img src="/benchmark-group-logo.png" alt="Benchmark Group — Quality is what we do" className="v4-group-logo" /></span>
          <div className="v4-brand-wordmark"><strong>BENCHMARK <span>EXPORTS</span></strong><small>A BENCHMARK GROUP COMPANY</small></div>
        </div>
        <div className="v4-tv-heading"><h1>QUALITY CONTROL DASHBOARD</h1><p>LINE QUALITY, DHU & DEFECT ANALYSIS</p></div>
        <div className="v4-tv-clock-area">
          <div className="v4-live-badge"><i/> LIVE</div>
          <div className="v4-clock-stack"><strong>{now ? clock(now) : '--:--:--'}</strong><span>{now ? now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'LOADING DATE'}</span></div>
          <button className="v4-fullscreen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }} aria-label="Enter full screen">⛶</button>
        </div>
      </header>

      {error && <div className="v4-error-banner"><b>QUALITY DATA CONNECTION WARNING</b><span>{error}</span><button onClick={() => load()}>RETRY</button></div>}

      <section className="v4-quality-kpis">
        <QualityKpi label="CHECKED PCS" value={k ? fmt(k.checked) : '—'} note="TOTAL INSPECTED" tone="v4-q-cyan" symbol="▤"/>
        <QualityKpi label="PASS PCS" value={k ? fmt(k.pass) : '—'} note="ACCEPTED QUANTITY" tone="v4-q-green" symbol="✓"/>
        <QualityKpi label="DEFECT PCS" value={k ? fmt(k.defect) : '—'} note="RECORDED DEFECTS" tone="v4-q-red" symbol="✕"/>
        <QualityKpi label="PASS RATE" value={k ? percent(k.passRate) : '—'} note="PASS ÷ CHECKED" tone="v4-q-green" symbol="◉"/>
        <QualityKpi label="FACTORY DHU" value={k ? percent(k.dhu) : '—'} note="DEFECT PCS ÷ CHECKED PCS" tone="v4-q-red" symbol="!"/>
        <div className="v4-q-status-summary">
          <div className="v4-q-status-title">LINE STATUS <span>VS DHU TARGET</span></div>
          <div className="v4-q-status-counts">
            <div className="good"><strong>{lineStats.good}</strong><small>GOOD</small></div>
            <div className="watch"><strong>{lineStats.watch}</strong><small>WATCH</small></div>
            <div className="action"><strong>{lineStats.action}</strong><small>ACTION</small></div>
          </div>
          <small className="v4-q-no-data">{lineStats.noData} NO DATA · {lineStats.noTarget} NO DHU TARGET</small>
        </div>
      </section>

      <section className="v4-quality-grid">
        <div className="v4-quality-panel v4-quality-matrix">
          <div className="v4-quality-panel-head"><div><small>LINE-WISE QUALITY PERFORMANCE</small><h2>QUALITY INSPECTION MATRIX</h2></div><span>14 PRODUCTION LINES</span></div>
          <div className="v4-quality-table-wrap">
            <table className="v4-quality-table">
              <thead><tr><th>LINE</th><th>CHECKED</th><th>PASS</th><th>DEFECT</th><th>PASS %</th><th>DHU %</th><th>DHU TARGET</th><th>STATUS</th></tr></thead>
              <tbody>
                {data?.lines.map(line => <QualityLineRow key={line.line} line={line}/>)}
                {!data && <tr><td colSpan={8} className="v4-q-loading">CONNECTING TO QUALITY DATA…</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="v4-quality-matrix-foot"><span>GREEN = WITHIN DHU LIMIT</span><span>RED = ABOVE DHU TARGET</span><span>GREY = NO INSPECTION DATA</span></div>
        </div>

        <div className="v4-quality-panel v4-defect-panel">
          <div className="v4-quality-panel-head"><div><small>DEFECT ANALYSIS</small><h2>TOP DEFECT TYPES</h2></div><span>PCS</span></div>
          {defectParts.length ? <div className="v4-defect-bars">
            {defectParts.map((item, index) => {
              const max = Math.max(1, defectParts[0]?.pcs || 1);
              return <div className="v4-defect-bar-row" key={`${item.name}-${index}`}><div className="v4-defect-bar-label"><span>{item.name}</span><b>{fmt(item.pcs)}</b></div><div className="v4-defect-bar-track"><i style={{ width: `${item.pcs / max * 100}%` }}/></div></div>;
            })}
          </div> : <div className="v4-q-empty">NO DEFECT RECORDS YET</div>}
        </div>

        <div className="v4-quality-panel v4-defect-share-panel">
          <div className="v4-quality-panel-head"><div><small>DEFECT DISTRIBUTION</small><h2>DEFECT SHARE</h2></div><span>{fmt(defectTotal)} PCS</span></div>
          {defectParts.length ? <>
            <div className="v4-donut-layout">
              <div className="v4-donut" style={donutStyle}><div><strong>{fmt(k?.defect || 0)}</strong><span>DEFECTS</span></div></div>
              <div className="v4-donut-legend">
                {defectParts.map((item, index) => {
                  const colors = ['#159cf4', '#ff9c31', '#23c878', '#b05ae7', '#8293a5'];
                  const share = defectTotal ? item.pcs / defectTotal * 100 : 0;
                  return <div key={`${item.name}-${index}`}><i style={{ background: colors[index % colors.length] }}/><span>{item.name}</span><b>{percent(share)}</b></div>;
                })}
              </div>
            </div>
          </> : <div className="v4-q-empty">NO DEFECT DATA FOR SELECTED DATE</div>}
          <div className="v4-quality-highlights">
            <span>BEST DHU<strong>{lineStats.best ? `L${String(lineStats.best.line).padStart(2, '0')} · ${percent(lineStats.best.dhu)}` : '—'}</strong></span>
            <span>HIGHEST DHU<strong>{lineStats.worst ? `L${String(lineStats.worst.line).padStart(2, '0')} · ${percent(lineStats.worst.dhu)}` : '—'}</strong></span>
          </div>
        </div>
      </section>

      <footer className="v4-quality-footer">
        <div><b>BENCHMARK EXPORTS</b><span> · QUALITY CONTROL & DHU MONITORING</span></div>
        <div className="v4-sync-indicator"><i/>{loading ? 'SYNCHRONIZING' : 'AUTO UPDATE · EVERY 5 SECONDS'}<span>LAST SYNC {lastSync ? clock(lastSync) : 'WAITING'}{lastSyncAge == null ? '' : ` · ${lastSyncAge}s AGO`}</span><button type="button" className="text-action" onClick={() => void load()} disabled={loading}>{loading ? 'REFRESHING…' : '↻ REFRESH NOW'}</button></div>
        <div className="v4-quality-footer-right"><label>REPORT DATE</label><input type="date" value={date} onChange={event => setDate(event.target.value)}/><Link href="/tv">← PRODUCTION TV</Link><Link href="/input">INPUT TERMINAL ↗</Link><span>DATA VERSION {data?.dataVersion || '—'}</span></div>
      </footer>
    </main>
  );
}
