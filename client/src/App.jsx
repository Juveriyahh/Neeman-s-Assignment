import React, { useCallback, useEffect, useRef, useState } from 'react';
import Dashboard from './Dashboard.jsx';

const DEFAULT_URL = 'https://neemans.com/products/curve-knit-slip-ons-for-men-ivory';

/**
 * The real steps, named. A progress bar that says "Processing..." tells the
 * reader nothing; these are the phases the browser is actually working through.
 */
const STEPS = [
  { at: 0, label: 'Opening a real browser' },
  { at: 6, label: 'Loading the page and waiting for the tags to settle' },
  { at: 22, label: 'Looking for a cookie banner to accept' },
  { at: 28, label: 'Scrolling the page the way a person would' },
  { at: 40, label: 'Picking a size, then clicking add to cart' },
  { at: 52, label: 'Waiting for the conversion beacons to fire' },
  { at: 60, label: 'Checking the telemetry against the rules' },
  { at: 66, label: 'Working out what it means for your budget' },
];

function useElapsed(running) {
  const [s, setS] = useState(0);
  const ref = useRef();
  useEffect(() => {
    if (!running) {
      setS(0);
      return;
    }
    ref.current = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(ref.current);
  }, [running]);
  return s;
}

export default function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [health, setHealth] = useState(null);

  const elapsed = useElapsed(running);
  const step = [...STEPS].reverse().find((s) => elapsed >= s.at) || STEPS[0];

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/audits?limit=15');
      if (r.ok) setHistory(await r.json());
    } catch {
      /* history is a nicety, not a requirement */
    }
  }, []);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
    loadHistory();
  }, [loadHistory]);

  async function run(e) {
    e && e.preventDefault();
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, interactions: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The audit failed.');
      setReport(data);
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  async function openRun(id) {
    try {
      const r = await fetch(`/api/audits/${id}`);
      const row = await r.json();
      if (row && row.report) setReport(row.report);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto max-w-[1180px] px-8 py-10">
        {/* ---------------------------------------------------------- header */}
        <header className="flex flex-wrap items-end justify-between gap-6 pb-6">
          <div>
            <div className="kicker">Pre-flight inspection</div>
            <h1 className="display mt-2 text-[32px] leading-none text-ink">
              Landing Page Pre-Flight Auditor
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">
              Is this page technically safe to put ad spend behind? A real browser visits it, watches
              every analytics and ad-tech request it makes, and checks the result against fixed rules.
            </p>
          </div>

          {health && (
            <dl className="font-mono text-[11px] leading-relaxed text-faint">
              <div className="flex gap-2">
                <dt>browser</dt>
                <dd className="text-muted">chromium</dd>
              </div>
              <div className="flex gap-2">
                <dt>gemini</dt>
                <dd className={health.integrations.gemini ? 'text-good' : 'text-warn'}>
                  {health.integrations.gemini ? 'configured' : 'not configured'}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt>supabase</dt>
                <dd className={health.integrations.supabase === 'configured' ? 'text-good' : 'text-warn'}>
                  {health.integrations.supabase}
                </dd>
              </div>
            </dl>
          )}
        </header>

        {/* ------------------------------------------------------------ form */}
        <form onSubmit={run} className="flex flex-wrap items-center gap-3 border-y border-line py-5">
          <label htmlFor="url" className="kicker shrink-0">
            Page to inspect
          </label>
          <input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={running}
            spellCheck={false}
            className="min-w-[320px] flex-1 rounded-pill border border-line bg-page px-5 py-2.5 font-mono text-[12.5px] text-ink outline-none transition-colors focus:border-ink2 disabled:text-faint"
          />
          <button
            type="submit"
            disabled={running}
            className="btn-primary shrink-0"
          >
            {running ? 'Inspecting…' : 'Run inspection'}
          </button>
        </form>

        {/* -------------------------------------------------------- progress */}
        {running && (
          <div className="border-b border-line py-8">
            <div className="display text-[20px] text-ink">{step.label}…</div>
            <div className="mt-2 font-mono text-[11px] text-faint">
              {elapsed}s elapsed · a full inspection usually takes 45–70s
            </div>
            <ol className="mt-5 space-y-1.5">
              {STEPS.map((s) => {
                const done = elapsed > s.at + 5;
                const now = s.label === step.label;
                return (
                  <li
                    key={s.label}
                    className={`font-mono text-[11px] ${
                      now ? 'text-ink' : done ? 'text-faint line-through' : 'text-line'
                    }`}
                  >
                    {now ? '▸ ' : done ? '✓ ' : '· '}
                    {s.label}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {error && (
          <div className="border-b border-line py-6">
            <div className="display text-[20px] text-danger">That didn’t work.</div>
            <p className="mt-1 font-mono text-[12px] text-muted">{error}</p>
          </div>
        )}

        {/* ---------------------------------------------------------- report */}
        {report && !running && <Dashboard report={report} />}

        {!report && !running && !error && (
          <div className="border-b border-line py-16 text-center">
            <p className="text-[15px] text-muted">
              Nothing inspected yet. Enter a page above and run it.
            </p>
          </div>
        )}

        {/* --------------------------------------------------------- history */}
        {history.length > 0 && (
          <section className="mt-12">
            <div className="kicker">Previous inspections</div>
            <table className="mt-3 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {['When', 'Page', 'Verdict', 'Score', 'Findings', 'Requests'].map((h) => (
                    <th key={h} className="kicker py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr
                    key={h.id}
                    onClick={() => openRun(h.id)}
                    className="cursor-pointer border-b border-line hover:bg-surface"
                  >
                    <td className="py-2 font-mono text-[11px] text-muted">
                      {new Date(h.started_at).toLocaleString()}
                    </td>
                    <td className="max-w-[340px] truncate py-2 font-mono text-[11px] text-muted">
                      {h.target_url}
                    </td>
                    <td className="py-2 text-[11px] font-medium">
                      <span
                        className={
                          h.verdict === 'NOT_READY'
                            ? 'text-danger'
                            : h.verdict === 'READY_WITH_FIXES'
                            ? 'text-warn'
                            : 'text-good'
                        }
                      >
                        {h.verdict === 'NOT_READY'
                          ? 'HOLD'
                          : h.verdict === 'READY_WITH_FIXES'
                          ? 'CONDITIONAL'
                          : 'CLEARED'}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-[11px] text-ink">{h.readiness_score}</td>
                    <td className="py-2 font-mono text-[11px] text-muted">
                      {h.high_count}/{h.medium_count}/{h.low_count}
                    </td>
                    <td className="py-2 font-mono text-[11px] text-muted">{h.total_tracking_requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-16 border-t border-line pt-4 font-mono text-[10px] leading-relaxed text-faint">
          Observation by Playwright/Chromium · checks are deterministic · interpretation by Gemini.
          Single-run sampling: this is evidence, not proof. See NOTE.md.
        </footer>
      </div>
    </div>
  );
}
