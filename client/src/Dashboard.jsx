import React, { useState } from 'react';
import BusinessView from './BusinessView.jsx';
import TechnicalView from './TechnicalView.jsx';
import { SeverityBar } from './charts.jsx';

/* ===========================================================================
   The report shell: one masthead both audiences share, then a split.
   Business is the default, because the question ("can we spend?") is a
   business question. The technical view is one click away and complete.
   =========================================================================== */

const VERDICT = {
  NOT_READY: { stamp: 'HOLD', cls: 'bg-danger text-white' },
  READY_WITH_FIXES: { stamp: 'CONDITIONAL', cls: 'bg-warn text-white' },
  READY: { stamp: 'CLEARED', cls: 'bg-good text-white' },
};

export default function Dashboard({ report }) {
  const [tab, setTab] = useState('business');
  const v = VERDICT[report.verdict] || VERDICT.READY_WITH_FIXES;
  const { high, medium, low } = report.counts;

  return (
    <article className="pb-16">
      {/* -------------------------------------------------------- masthead */}
      <div className="border-b border-line py-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className={`rounded-pill px-4 py-1.5 text-[12px] font-medium uppercase tracking-[0.18em] ${v.cls}`}>
                {v.stamp}
              </span>
              <span className="kicker">Pre-flight inspection</span>
            </div>

            <h2 className="display mt-4 text-[34px] leading-none text-ink">{report.headline}</h2>

            <p className="mt-3 break-all font-mono text-[11px] text-muted">{report.targetUrl}</p>
            <p className="mt-1 font-mono text-[11px] text-faint">
              {new Date(report.startedAt).toLocaleString()} · took {(report.durationMs / 1000).toFixed(1)}s ·{' '}
              {report.summary.totalTrackingRequests} tracking requests from {report.summary.vendorCount} vendors
            </p>
          </div>
        </div>

        <div className="mt-7 max-w-[720px]">
          <SeverityBar high={high} medium={medium} low={low} />
          <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-2">
            {[
              ['serious', high, 'Wastes money or hides sales. Deal with this before launch.'],
              ['middling', medium, 'Distorts your numbers. Worth fixing soon.'],
              ['minor', low, 'Untidy. Fix it when you next touch the tags.'],
            ].map(([word, count, def]) => (
              <div key={word} className="max-w-[240px]">
                <dt className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink">
                  {count} {word}
                </dt>
                <dd className="mt-0.5 text-[12px] leading-snug text-muted">{def}</dd>
              </div>
            ))}
          </dl>
        </div>

        {!report.aiAvailable && (
          <div className="mt-6 max-w-[760px] rounded-2xl border border-warn/40 bg-warn/[0.07] px-5 py-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-warn">
              AI interpretation unavailable
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink2">
              The business-interpretation step did not run, so everything below is the measured layer only — which
              stands on its own. {report.aiError}
            </p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ tabs */}
      <div className="sticky top-0 z-10 -mx-2 bg-page/95 px-2 py-4 backdrop-blur">
        <div className="inline-flex gap-1 rounded-pill bg-surface p-1">
          {[
            ['business', 'For the business', 'The gist, in plain English'],
            ['technical', 'For the engineer', 'Rules, evidence, full log'],
          ].map(([k, label, hint]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              title={hint}
              className={`rounded-pill px-6 py-2.5 text-[12px] font-medium uppercase tracking-[0.12em] transition-colors ${
                tab === k ? 'bg-ink text-white shadow-sm2' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'business' ? (
        <BusinessView report={report} onSeeTechnical={() => setTab('technical')} />
      ) : (
        <TechnicalView report={report} />
      )}
    </article>
  );
}
