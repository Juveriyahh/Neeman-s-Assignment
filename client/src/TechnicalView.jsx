import React, { useMemo, useState } from 'react';

/* ===========================================================================
   THE TECHNICAL READ
   Everything an engineer needs to verify or reproduce a finding: the exact
   rule behind each check, the evidence, the account IDs, and the full log.
   Sections are numbered at render time, because several are conditional --
   hard-coded numbers leave gaps when a section is hidden.
   =========================================================================== */

const SEV = {
  high: { word: 'serious', colour: '#E32C2B', text: 'text-danger' },
  medium: { word: 'middling', colour: '#C4973A', text: 'text-warn' },
  low: { word: 'minor', colour: '#175615', text: 'text-good' },
};

const STATUS = {
  pass: { mark: '✓', label: 'Fine', cls: 'text-good' },
  fail: { mark: '✕', label: 'Problem', cls: 'text-danger' },
  not_applicable: { mark: '–', label: 'Not checked', cls: 'text-faint' },
};

function Section({ n, title, sub, children }) {
  return (
    <section className="border-t border-line py-8">
      <div className="flex items-baseline gap-4">
        <span className="display text-[15px] text-gold">{String(n).padStart(2, '0')}</span>
        <h2 className="display text-[19px] text-ink">{title}</h2>
      </div>
      {sub && <p className="mt-2 pl-[2.4rem] text-[13.5px] leading-relaxed text-muted">{sub}</p>}
      <div className="mt-5 pl-[2.4rem]">{children}</div>
    </section>
  );
}

/** Solid dark = measured. Solid violet = AI. Filled, never outlined. */
export function ProvenanceBadge({ source }) {
  const ai = source === 'ai';
  return (
    <span
      className={`inline-block rounded-pill px-2.5 py-[3px] text-[9px] font-medium uppercase tracking-[0.16em] text-white ${
        ai ? 'bg-ai' : 'bg-ink'
      }`}
    >
      {ai ? 'AI' : 'Measured'}
    </span>
  );
}

/**
 * Provenance is differentiated four ways at once: badge colour, rail style
 * (solid vs dashed), title weight (semibold vs italic), and background tint.
 */
function Finding({ issue, defaultOpen }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const ai = issue.source === 'ai';
  const sev = SEV[issue.severity] || SEV.medium;

  return (
    <div className={`mb-3 flex overflow-hidden rounded-2xl border border-line ${ai ? 'bg-ai/[0.04]' : 'bg-page'}`}>
      <div
        className="w-[4px] shrink-0"
        style={
          ai
            ? { backgroundImage: `repeating-linear-gradient(to bottom, ${sev.colour} 0 5px, transparent 5px 10px)` }
            : { backgroundColor: sev.colour }
        }
      />
      <div className="min-w-0 flex-1 px-5 py-4">
        <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 text-left">
          <ProvenanceBadge source={issue.source} />
          <span className={`min-w-0 flex-1 text-[15px] leading-snug text-ink ${ai ? 'italic' : 'font-medium'}`}>
            {issue.title}
          </span>
          <span className={`shrink-0 text-[10px] uppercase tracking-[0.14em] ${sev.text}`}>{sev.word}</span>
          <span className="shrink-0 font-mono text-[12px] text-faint">{open ? '−' : '+'}</span>
        </button>

        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{issue.businessRisk || issue.detail}</p>

        {open && (
          <div className="mt-4 space-y-4">
            {issue.technicalEvidence && <Block label="What was seen">{issue.technicalEvidence}</Block>}
            {issue.recommendedFix && <Block label="How to fix it">{issue.recommendedFix}</Block>}
            {issue.affectedMetric && <Block label="The number this breaks">{issue.affectedMetric}</Block>}

            {issue.evidence && issue.evidence.length > 0 && (
              <div>
                <div className="kicker">Evidence</div>
                <dl className="mt-2 space-y-1">
                  {issue.evidence.map((e, i) => (
                    <div key={i} className="flex gap-3 font-mono text-[11px]">
                      <dt className="w-[140px] shrink-0 text-faint">{e.label}</dt>
                      <dd className="min-w-0 break-all text-ink2">{e.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className={`rounded-xl px-4 py-3 ${ai ? 'bg-ai/[0.07]' : 'bg-surface'}`}>
              <div className="kicker">How this was determined</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">
                {ai
                  ? 'A language model judged the severity and business impact of telemetry that was measured by code. It did not decide what fired, whether an event counts as a conversion, or whether a name is standard — all of that arrived already settled.'
                  : 'A fixed rule applied to what the browser observed on the wire. No model was involved, and the same telemetry always produces this same finding.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ label, children }) {
  return (
    <div>
      <div className="kicker">{label}</div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink2">{children}</p>
    </div>
  );
}

export default function TechnicalView({ report }) {
  const [filter, setFilter] = useState('both');
  const [showRaw, setShowRaw] = useState(false);

  const allIssues = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 };
    return [...report.issues, ...report.aiIssues].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [report]);

  const shown = allIssues.filter((i) => filter === 'both' || i.source === filter);
  const dupGroups = (report.checks.find((c) => c.id === 'no_duplicates') || {}).dupGroups || [];
  const namedEvents = report.networkLog.filter((e) => e.event);

  let n = 0;
  const next = () => ++n;

  return (
    <div className="pt-2">
      {/* ------------------------------------------------------- provenance */}
      <Section n={next()} title="Two kinds of finding" sub="Where each finding came from, and why the difference matters.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex overflow-hidden rounded-2xl border border-line">
            <div className="w-[4px] shrink-0" style={{ backgroundColor: SEV.high.colour }} />
            <div className="px-5 py-4">
              <ProvenanceBadge source="measured" />
              <p className="mt-2.5 text-[15px] font-medium text-ink">Measured findings look like this</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Solid rail, upright title, plain background. A fixed rule over what the browser observed. Run it twice
                on the same telemetry and you get the same answer.
              </p>
            </div>
          </div>

          <div className="flex overflow-hidden rounded-2xl border border-line bg-ai/[0.04]">
            <div
              className="w-[4px] shrink-0"
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, ${SEV.high.colour} 0 5px, transparent 5px 10px)`,
              }}
            />
            <div className="px-5 py-4">
              <ProvenanceBadge source="ai" />
              <p className="mt-2.5 text-[15px] italic text-ink">AI findings look like this</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Dashed rail, italic title, faint violet tint. A model interpreting facts the measured layer already
                established. It judges what they mean commercially — it never decides what fired.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------------- checklist */}
      <Section
        n={next()}
        title="The checklist"
        sub="Every check that ran, including the ones that were fine — so you can tell “checked and fine” from “never checked”. Expand any row for the exact rule."
      >
        <div className="overflow-hidden rounded-2xl border border-line">
          {report.checks.map((c, i) => {
            const s = STATUS[c.status] || STATUS.not_applicable;
            return (
              <details key={c.id} className={`group ${i ? 'border-t border-line' : ''}`}>
                <summary className="flex cursor-pointer list-none items-baseline gap-4 px-5 py-4 hover:bg-surface">
                  <span className={`w-4 shrink-0 text-[15px] ${s.cls}`}>{s.mark}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[15px] font-medium text-ink">{c.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{c.detail}</span>
                  </span>
                  <span className={`shrink-0 text-[10px] uppercase tracking-[0.14em] ${s.cls}`}>{s.label}</span>
                </summary>
                <div className="bg-surface px-5 py-4 pl-[2.9rem]">
                  <div className="kicker">What a marketer is really asking</div>
                  <p className="mt-1.5 text-[14px] italic text-ink">{c.question}</p>
                  <div className="kicker mt-4">The exact rule</div>
                  <p className="mt-1.5 max-w-[74ch] text-[13px] leading-relaxed text-ink2">{c.method}</p>
                </div>
              </details>
            );
          })}
        </div>
      </Section>

      {/* --------------------------------------------------------- findings */}
      <Section n={next()} title="Findings">
        <div className="mb-5 inline-flex gap-1 rounded-pill bg-surface p-1">
          {[
            ['both', `All ${allIssues.length}`],
            ['measured', `Measured ${report.issues.length}`],
            ['ai', `AI ${report.aiIssues.length}`],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-pill px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
                filter === k ? (k === 'ai' ? 'bg-ai text-white' : 'bg-ink text-white') : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="text-[14px] italic text-muted">Nothing in this category.</p>
        ) : (
          shown.map((i, idx) => <Finding key={i.id} issue={i} defaultOpen={idx === 0} />)
        )}
      </Section>

      {/* ------------------------------------------------------------- tags */}
      <Section n={next()} title="Tags found on the page">
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface">
                {['Vendor', 'Requests', 'Failed', 'Account IDs', 'Events seen'].map((h) => (
                  <th key={h} className="kicker px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.summary.vendorsDetected.map((vd, i) => (
                <tr key={vd.id} className={`align-top ${i ? 'border-t border-line' : ''}`}>
                  <td className="px-4 py-3 text-[14px] font-medium text-ink">{vd.label}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-muted">{vd.requests}</td>
                  <td className={`px-4 py-3 font-mono text-[12px] ${vd.failures ? 'text-danger' : 'text-faint'}`}>
                    {vd.failures || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink2">
                    {vd.accountIds.length ? (
                      vd.accountIds.map((a) => (
                        <div key={a} className={vd.accountIds.length > 1 ? 'text-warn' : ''}>
                          {a}
                        </div>
                      ))
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink2">
                    {vd.events.slice(0, 6).join(', ') || <span className="text-faint">—</span>}
                    {vd.events.length > 6 && <span className="text-faint"> +{vd.events.length - 6}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ------------------------------------------------------ event names */}
      {report.eventTaxonomy && report.eventTaxonomy.length > 0 && (
        <Section
          n={next()}
          title="What the event names mean"
          sub="Plain-English readings of the names the page is sending, and what they ought to be called."
        >
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface">
                  {['Event', 'Vendor', 'Category', 'In plain English', 'Should be'].map((h) => (
                    <th key={h} className="kicker px-4 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.eventTaxonomy.map((e, i) => (
                  <tr key={i} className={`align-top ${i ? 'border-t border-line' : ''}`}>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-ink">{e.event_name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-faint">{e.vendor}</td>
                    <td className="px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-muted">
                      {String(e.category).replace(/_/g, ' ')}
                    </td>
                    <td className="max-w-[300px] px-4 py-3 text-[13px] leading-snug text-ink2">
                      {e.plain_english_meaning}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-ink2">{e.suggested_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------- duplicates */}
      {dupGroups.length > 0 && (
        <Section
          n={next()}
          title="Things that fired more than once"
          sub="Identical beacons, after stripping every parameter that changes on each hit."
        >
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface">
                  {['Vendor', 'Event', 'Times', 'Conversion?', 'When (ms)'].map((h) => (
                    <th key={h} className="kicker px-4 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dupGroups.map((d, i) => (
                  <tr key={i} className={i ? 'border-t border-line' : ''}>
                    <td className="px-4 py-3 text-[14px] text-ink">{d.vendorLabel}</td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-ink2">{d.event}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-danger">×{d.count}</td>
                    <td className="px-4 py-3 text-[12px] text-muted">{d.isConversion ? 'yes' : 'no'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-faint">{d.timesMs.slice(0, 6).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ----------------------------------------------------- raw evidence */}
      <Section n={next()} title="Raw evidence" sub="Everything the browser saw, unedited.">
        <div className="mb-5">
          <div className="kicker mb-2">Session timeline</div>
          <div className="flex w-full overflow-hidden rounded-xl border border-line">
            {report.phaseTimeline.map((ph, i) => {
              const totalMs = report.phaseTimeline[report.phaseTimeline.length - 1].endedMs || 1;
              const w = ((ph.endedMs - ph.startedMs) / totalMs) * 100;
              return (
                <div
                  key={i}
                  style={{ width: `${w}%` }}
                  className={`border-r border-line px-2 py-2 last:border-r-0 ${i % 2 ? 'bg-surface' : ''}`}
                  title={`${ph.phase}: ${ph.startedMs}–${ph.endedMs}ms`}
                >
                  <div className="truncate font-mono text-[10px] text-ink">{ph.phase}</div>
                  <div className="truncate font-mono text-[9px] text-faint">
                    {Math.round((ph.endedMs - ph.startedMs) / 100) / 10}s
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={() => setShowRaw(!showRaw)} className="btn-ghost">
          {showRaw ? 'Hide' : 'Show'} all {namedEvents.length} events
        </button>

        {showRaw && (
          <div className="mt-4 max-h-[460px] overflow-auto rounded-2xl border border-line">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-surface">
                <tr>
                  {['t (ms)', 'Phase', 'Vendor', 'Event', 'Status', 'Account', 'Conv.', 'Std.'].map((h) => (
                    <th key={h} className="kicker px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {namedEvents.map((e, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-1.5 font-mono text-[10.5px] text-faint">{e.tMs}</td>
                    <td className="px-3 py-1.5 font-mono text-[10.5px] text-muted">{e.phase}</td>
                    <td className="px-3 py-1.5 font-mono text-[10.5px] text-muted">{e.vendor}</td>
                    <td className="px-3 py-1.5 font-mono text-[10.5px] text-ink">{e.event}</td>
                    <td
                      className={`px-3 py-1.5 font-mono text-[10.5px] ${
                        e.failure || (e.status && e.status >= 400) ? 'text-danger' : 'text-faint'
                      }`}
                    >
                      {e.failure || e.status || '—'}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[10.5px] text-muted">{e.accountId || '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-[10.5px] text-muted">{e.isConversion ? '●' : ''}</td>
                    <td className="px-3 py-1.5 font-mono text-[10.5px] text-muted">
                      {e.isStandardEvent === null ? '—' : e.isStandardEvent ? 'yes' : 'no'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="border-t border-line pt-4 font-mono text-[10px] leading-relaxed text-faint">
        <div>
          Observation: Playwright/Chromium, 1366×900, en-IN · Checks: 8 deterministic rules · Interpretation:{' '}
          {report.aiAvailable ? report.aiModel : 'unavailable for this run'}
        </div>
        <div className="mt-1">
          Run {report.id || '—'} · {report.startedAt} → {report.finishedAt} · Single-run sampling: this is evidence,
          not proof.
        </div>
      </div>
    </div>
  );
}
