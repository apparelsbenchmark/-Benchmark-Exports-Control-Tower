'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardData, LineData } from '@/lib/types';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmt = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value) || 0);
const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
const clock = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fullDate = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

function hourTone(actual: number, target: number, hour: number, currentHour: number) {
  if (target <= 0 || hour > currentHour) return 'v4-hour-neutral';
  if (actual >= target) return 'v4-hour-good';
  if (actual >= target * 0.8) return 'v4-hour-watch';
  return 'v4-hour-bad';
}

function HourBox({ line, hour, currentHour }: { line: LineData; hour: number; currentHour: number }) {
  const actual = Number(line.hourlyActual?.[hour - 1] || 0);
  const target = Number(line.hourlyTargets?.[hour - 1] || 0);
  return (
    <td className="v4-hour-td">
      <div className={`v4-hour-box ${hourTone(actual, target, hour, currentHour)}`}
        title={`L${String(line.line).padStart(2, '0')} · H${hour} · Actual ${fmt(actual)} PCS · Target ${fmt(target)} PCS`}>
        <b>{fmt(actual)}</b>
      </div>
    </td>
  );
}

function productionStatus(line: LineData) {
  if (!line.active) return { label: 'INACTIVE', className: 'v4-status-warn' };
  if (line.dailyTarget <= 0) return { label: 'SET TARGET', className: 'v4-status-warn' };
  if (line.status === 'AHEAD') return { label: 'AHEAD', className: 'v4-status-good' };
  if (line.status === 'ON TRACK') return { label: 'ON TARGET', className: 'v4-status-good' };
  if (line.paceAchievement < 70) return { label: 'CRITICAL', className: 'v4-status-bad' };
  return { label: 'BELOW', className: 'v4-status-warn' };
}

function actualTone(achievement: number) {
  if (achievement >= 95) return 'v4-actual-green';
  if (achievement >= 75) return 'v4-actual-amber';
  return 'v4-actual-red';
}

function ProductionRow({ line, currentHour }: { line: LineData; currentHour: number }) {
  const status = productionStatus(line);
  const achvTone = line.achievement >= 95 ? 'v4-achv-good' : line.achievement >= 75 ? 'v4-achv-watch' : 'v4-achv-bad';
  const effTone = line.efficiency == null ? 'v4-muted-text'
    : line.efficiency >= line.efficiencyTarget ? 'v4-good-text'
    : line.efficiency >= line.efficiencyTarget * 0.9 ? 'v4-watch-text' : 'v4-bad-text';
  const style = line.styles?.length ? line.styles.join(' / ') : line.style || '—';
  const po = line.po || '—';
  return (
    <tr className={!line.active ? 'v4-row-inactive' : ''}>
      <td className="v4-line-cell"><span>L{String(line.line).padStart(2, '0')}</span></td>
      <td className="v4-style-cell"><b>{style}</b><small>{po}</small></td>
      <td className="v4-number-cell">{line.dailyTarget > 0 ? fmt(line.dailyTarget) : <em>SET</em>}</td>
      <td className={`v4-actual-cell ${actualTone(line.achievement)}`}>{fmt(line.actual)}</td>
      <td className={`v4-number-cell ${line.gap >= 0 ? 'v4-good-text' : 'v4-bad-text'}`}>{line.dailyTarget > 0 ? `${line.gap > 0 ? '+' : ''}${fmt(line.gap)}` : '—'}</td>
      <td><span className={`v4-percent-chip ${achvTone}`}>{pct(line.achievement)}</span></td>
      <td className={`v4-number-cell v4-eff-cell ${effTone}`}>{pct(line.efficiency)}</td>
      {Array.from({ length: 11 }, (_, i) => <HourBox key={i} line={line} hour={i + 1} currentHour={currentHour}/>) }
      <td><span className={`v4-status-chip ${status.className}`}>{status.label}</span></td>
    </tr>
  );
}

function Kpi({ label, value, note, tone, icon }: { label: string; value: string; note: string; tone: string; icon: string }) {
  return <div className={`v4-kpi ${tone}`}>
    <div className="v4-kpi-label"><span>{icon}</span>{label}</div>
    <div className="v4-kpi-value">{value}</div>
    <div className="v4-kpi-note">{note}</div>
  </div>;
}

export default function TvPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [date, setDate] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const busy = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (busy.current) return;
    busy.current = true;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/dashboard?date=${encodeURIComponent(date)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to load production data');
      setData(result.data as DashboardData);
      setError('');
      setLastSync(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Production data connection failed');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    // Resolve the local production date after hydration to keep server/client HTML identical.
    setDate(todayKey());
  }, []);

  useEffect(() => {
    if (!date) return;
    load();
    const timer = window.setInterval(() => load(true), 30000);
    return () => window.clearInterval(timer);
  }, [load, date]);
  useEffect(() => {
    // Set the clock only after hydration to keep server and browser HTML identical.
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setPage(current => current === 0 ? 1 : 0), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const lines = data?.lines || [];
  const pageLines = useMemo(() => [lines.slice(0, 7), lines.slice(7, 14)], [lines]);
  const visibleLines = pageLines[page] || [];
  const k = data?.kpis;
  const currentHour = k?.currentHour || 0;
  const pageLabel = page === 0 ? 'L01 — L07' : 'L08 — L14';
  const lastSyncAge = lastSync && now ? Math.max(0, Math.floor((now.getTime() - lastSync.getTime()) / 1000)) : null;

  const totals = useMemo(() => {
    const active = visibleLines.filter(line => line.active);
    const target = active.reduce((sum, line) => sum + line.dailyTarget, 0);
    const actual = active.reduce((sum, line) => sum + line.actual, 0);
    const earned = active.reduce((sum, line) => sum + line.earnedMinutes, 0);
    const available = active.reduce((sum, line) => sum + line.availableMinutes, 0);
    const hourly = Array.from({ length: 11 }, (_, i) => active.reduce((sum, line) => sum + (line.hourlyActual?.[i] || 0), 0));
    return { target, actual, gap: actual - target, achievement: target > 0 ? actual / target * 100 : 0,
      efficiency: available > 0 ? earned / available * 100 : null, hourly };
  }, [visibleLines]);

  const pageBest = useMemo(() => {
    const ranked = visibleLines.filter(line => line.active && line.dailyTarget > 0).slice().sort((a, b) => b.achievement - a.achievement);
    return { best: ranked[0] || null, lowest: ranked[ranked.length - 1] || null };
  }, [visibleLines]);

  const efficiencyTone = k?.efficiency == null ? 'v4-tone-amber' : k.efficiency >= k.efficiencyTarget ? 'v4-tone-green' : 'v4-tone-amber';
  const belowTone = k?.belowTargetLines ? 'v4-tone-red' : 'v4-tone-green';

  return (
    <main className="v4-tv-screen v4-production-only">
      <header className="v4-tv-header">
        <div className="v4-brand-lockup"><span className="v4-group-logo-frame"><img src="/benchmark-group-logo.png" alt="Benchmark Group — Quality is what we do" className="v4-group-logo" /></span><div className="v4-brand-wordmark"><strong>BENCHMARK <span>EXPORTS</span></strong><small>A BENCHMARK GROUP COMPANY</small></div></div>
        <div className="v4-tv-heading"><h1>PRODUCTION CONTROL TOWER</h1><p>LIVE PRODUCTION MONITORING</p></div>
        <div className="v4-tv-clock-area"><div className="v4-live-badge"><i/> LIVE</div><div className="v4-clock-stack"><strong>{now ? clock(now) : '--:--:--'}</strong><span>{now ? fullDate(now) : 'LOADING DATE'}</span></div><button className="v4-fullscreen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }} aria-label="Enter full screen">⛶</button></div>
      </header>

      {error && <div className="v4-error-banner"><b>DATA CONNECTION WARNING</b><span>{error}</span><button onClick={() => load()}>RETRY</button></div>}

      <section className="v4-kpi-grid">
        <Kpi label="DAILY TARGET" value={k ? fmt(k.dailyTarget) : '—'} note="PCS · TOTAL LINE TARGET" tone="v4-tone-cyan" icon="◎"/>
        <Kpi label="ACTUAL PCS" value={k ? fmt(k.actual) : '—'} note="CONFIRMED PRODUCTION" tone="v4-tone-green" icon="▥"/>
        <Kpi label="ACHIEVEMENT" value={k ? pct(k.achievement) : '—'} note="ACTUAL ÷ DAILY TARGET" tone={k && k.achievement >= 100 ? 'v4-tone-green' : 'v4-tone-green'} icon="▤"/>
        <Kpi label="EFFICIENCY" value={k ? pct(k.efficiency) : '—'} note="SMV BASED · EARNED / AVAILABLE MINUTES" tone={efficiencyTone} icon="◉"/>
        <Kpi label="ACTIVE LINES" value={k ? `${k.activeLines}/14` : '—'} note="PRODUCTION LINES ACTIVE" tone="v4-tone-green" icon="♟"/>
        <Kpi label="BELOW TARGET" value={k ? String(k.belowTargetLines).padStart(2, '0') : '—'} note="LINES NEEDING ATTENTION" tone={belowTone} icon="⚑"/>
      </section>

      <section className="v4-production-panel v4-production-matrix-panel">
        <div className="v4-production-table-wrap">
          <table className="v4-production-table">
            <colgroup>
              <col className="v4-col-line"/><col className="v4-col-style"/><col className="v4-col-target"/><col className="v4-col-actual"/><col className="v4-col-gap"/><col className="v4-col-achv"/><col className="v4-col-eff"/>
              {Array.from({ length: 11 }, (_, i) => <col key={i} className="v4-col-hour"/>)}<col className="v4-col-status"/>
            </colgroup>
            <thead><tr><th>LINE</th><th>STYLE / PO</th><th>TARGET</th><th>ACTUAL</th><th>GAP</th><th>ACHV %</th><th>EFF %</th>{Array.from({ length: 11 }, (_, i) => <th key={i}>H{i + 1}</th>)}<th>STATUS</th></tr></thead>
            <tbody>
              {visibleLines.map(line => <ProductionRow key={line.line} line={line} currentHour={currentHour}/>)}
              {!data && Array.from({ length: 7 }, (_, i) => <tr key={i} className="v4-loading-row"><td colSpan={19}>CONNECTING TO LIVE PRODUCTION DATA…</td></tr>)}
              {data && <tr className="v4-total-row"><td colSpan={2}>TOTAL ({page === 0 ? 'L01 – L07' : 'L08 – L14'})</td><td>{fmt(totals.target)}</td><td>{fmt(totals.actual)}</td><td className={totals.gap >= 0 ? 'v4-good-text' : 'v4-bad-text'}>{totals.gap > 0 ? '+' : ''}{fmt(totals.gap)}</td><td>{pct(totals.achievement)}</td><td>{pct(totals.efficiency)}</td>{totals.hourly.map((value, i) => <td key={i}>{fmt(value)}</td>)}<td className="v4-total-page">{page + 1} / 2</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="v4-production-summary">
          <div className="v4-summary-best"><span>🏆 BEST: </span><b>{pageBest.best ? `L${String(pageBest.best.line).padStart(2, '0')} (${pct(pageBest.best.achievement)})` : '—'}</b></div>
          <div className="v4-summary-lowest"><span>🔴 LOWEST: </span><b>{pageBest.lowest ? `L${String(pageBest.lowest.line).padStart(2, '0')} (${pct(pageBest.lowest.achievement)})` : '—'}</b></div>
          <div className="v4-summary-page">PAGE {page + 1} OF 2 · {pageLabel}<i className={page === 0 ? 'active' : ''}/><i className={page === 1 ? 'active' : ''}/></div>
        </div>
      </section>

      <footer className="v4-tv-footer v4-production-footer">
        <div><b>BENCHMARK EXPORTS</b><span> · PRODUCTION CONTROL TOWER</span></div>
        <div className="v4-sync-indicator"><i/>{loading ? 'SYNCHRONIZING' : 'AUTO UPDATE · EVERY 30 SECONDS'}<span>LAST SYNC {lastSync ? clock(lastSync) : 'WAITING'}{lastSyncAge == null ? '' : ` · ${lastSyncAge}s AGO`}</span><button type="button" className="text-action" onClick={() => void load()} disabled={loading}>{loading ? 'REFRESHING…' : '↻ REFRESH NOW'}</button></div>
        <div className="v4-footer-right"><label>PRODUCTION DATE</label><input type="date" value={date} onChange={event => setDate(event.target.value)}/><Link href="/quality">QUALITY DASHBOARD ↗</Link><span>DATA VERSION {data?.dataVersion || '—'}</span></div>
      </footer>
    </main>
  );
}
