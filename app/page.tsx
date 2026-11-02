import Link from 'next/link';

export default function Home() {
  return <main className="portal-shell">
    <header className="portal-top"><div className="brand-mark">B</div><div><div className="eyebrow">BENCHMARK EXPORTS</div><div className="portal-title">Operations Control Tower</div></div><span className="system-pill"><i/> SYSTEM READY</span></header>
    <section className="portal-hero"><div className="eyebrow">SMART FACTORY OPERATIONS</div><h1>One factory.<br/><span>Complete visibility.</span></h1><p>Live production on the factory TV. Quality intelligence on a dedicated page. Fast, controlled data entry from any authorised device.</p></section>
    <section className="portal-grid">
      <Link href="/tv" className="portal-card featured"><div className="portal-icon">▥</div><div className="eyebrow">FACTORY DISPLAY</div><h2>Live Production TV</h2><p>Daily target, actual output, line achievement, hourly production and SMV efficiency.</p><b>OPEN TV DISPLAY <span>↗</span></b></Link>
      <Link href="/quality" className="portal-card"><div className="portal-icon purple">◈</div><div className="eyebrow">QUALITY INTELLIGENCE</div><h2>Quality Control</h2><p>Line-wise checking, pass rate, DHU, top defects and quality alerts.</p><b>OPEN QUALITY PAGE <span>↗</span></b></Link>
      <Link href="/input" className="portal-card"><div className="portal-icon green">＋</div><div className="eyebrow">DATA ENTRY</div><h2>Production & Quality Input</h2><p>Enter hourly production and quality results from a phone, tablet or PC.</p><b>OPEN INPUT PANEL <span>↗</span></b></Link>
      <Link href="/targets" className="portal-card"><div className="portal-icon amber">⌁</div><div className="eyebrow">ADMINISTRATION</div><h2>Line Target Setup</h2><p>Configure each line's daily target, SMV, manpower and optional hourly plan.</p><b>CONFIGURE LINES <span>↗</span></b></Link>
    </section>
    <footer className="portal-footer">BENCHMARK EXPORTS · PRODUCTION & QUALITY CONTROL TOWER <span>DATA SOURCE: GOOGLE SHEETS</span></footer>
  </main>;
}
