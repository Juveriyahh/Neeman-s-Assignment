#!/usr/bin/env node
'use strict';

/**
 * Runs a real audit and writes sample-report/audit-report.md + audit-raw.json.
 * A script, not a copy-paste, so the sample regenerates on demand.
 *
 *   node scripts/export-report.js [url]
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { performAudit, DEFAULT_TARGET_URL, abridgeUrl } = require('../server');

const OUT_DIR = path.join(__dirname, '..', 'sample-report');

const VERDICT_WORD = {
  NOT_READY: 'HOLD — do not spend yet',
  READY_WITH_FIXES: 'CONDITIONAL — spend, but fix these',
  READY: 'CLEARED — safe to spend',
};

const SEV_WORD = { high: 'serious', medium: 'middling', low: 'minor' };
const STATUS_MARK = { pass: 'PASS', fail: 'FAIL', not_applicable: 'NOT CHECKED' };

function md(report) {
  const L = [];
  const p = (s = '') => L.push(s);

  let sectionNo = 0;
  const section = (title) => {
    sectionNo++;
    p('');
    p('---');
    p('');
    p(`## ${String(sectionNo).padStart(2, '0')} · ${title}`);
    p('');
  };

  // Masthead
  p('# Landing Page Pre-Flight Audit');
  p('');
  p(`**${report.headline}**`);
  p('');
  p(`| | |`);
  p(`|---|---|`);
  p(`| Verdict | **${VERDICT_WORD[report.verdict]}** |`);
  p(`| Readiness | **${report.readinessScore} / 100** |`);
  p(`| Page | \`${report.targetUrl}\` |`);
  p(`| Run at | ${report.startedAt} |`);
  p(`| Took | ${(report.durationMs / 1000).toFixed(1)}s |`);
  p(
    `| Findings | ${report.counts.high} serious · ${report.counts.medium} middling · ${report.counts.low} minor |`
  );
  p(`| Interpretation | ${report.aiAvailable ? `AI analysis by ${report.aiModel}` : 'Measured findings only — AI interpretation unavailable'} |`);

  if (!report.aiAvailable) {
    p('');
    p(`> **AI interpretation was not available for this run.** ${report.aiError || ''}`);
    p('> Everything below is the deterministic layer, which stands on its own.');
  }

  // Executive summary
  section('What this means for your budget');
  if (report.executiveSummary) p(report.executiveSummary);
  else {
    p(
      `A real browser was pointed at this page. It loaded it, handled consent, scrolled it, and clicked add to cart, watching every analytics and ad-tech request the page made. It captured **${report.summary.totalTrackingRequests} tracking requests** from **${report.summary.vendorCount} vendors**, of which **${report.summary.parsedEvents}** carried a readable event name.`
    );
    p('');
    p(
      `${report.counts.high} serious problem(s) were found. ${
        report.verdict === 'NOT_READY'
          ? 'At least one of them will cost money or hide sales, so spend should wait until they are fixed.'
          : 'Nothing here blocks spend outright.'
      }`
    );
  }

  // Provenance
  section('Two kinds of finding');
  p('Every finding in this report is stamped with where it came from.');
  p('');
  p('- **MEASURED** — a fixed rule applied to what the browser actually observed. Same telemetry in, same finding out, every time. No model involved.');
  p('- **AI** — a language model reading facts the measured layer already established, and judging what they mean commercially. It never decides what fired.');

  // Checklist
  section('The checklist');
  p('| | Check | Result | Detail |');
  p('|---|---|---|---|');
  for (const c of report.checks) {
    p(`| ${STATUS_MARK[c.status]} | ${c.label} | ${c.status} | ${c.detail.replace(/\|/g, '\\|')} |`);
  }
  p('');
  p('<details><summary>How each check is decided</summary>');
  p('');
  for (const c of report.checks) {
    p(`**${c.label}** — *${c.question}*`);
    p('');
    p(`> ${c.method}`);
    p('');
  }
  p('</details>');

  // Next steps
  if (report.recommendedNextSteps && report.recommendedNextSteps.length) {
    section('What to do next');
    report.recommendedNextSteps.forEach((s, i) => p(`${i + 1}. ${s}`));
  }

  // Findings
  section('Findings');
  const all = [...report.issues, ...report.aiIssues];
  if (!all.length) p('No findings.');
  const order = { high: 0, medium: 1, low: 2 };
  all.sort((a, b) => order[a.severity] - order[b.severity]);
  for (const i of all) {
    p(`### ${i.source === 'ai' ? '[AI]' : '[MEASURED]'} ${i.title}`);
    p('');
    p(`*${SEV_WORD[i.severity] || i.severity}*${i.affectedMetric ? ` · affects **${i.affectedMetric}**` : ''}`);
    p('');
    p(i.businessRisk || i.detail);
    if (i.technicalEvidence) {
      p('');
      p(`**Evidence.** ${i.technicalEvidence}`);
    }
    if (i.recommendedFix) {
      p('');
      p(`**Fix.** ${i.recommendedFix}`);
    }
    if (i.evidence && i.evidence.length) {
      p('');
      for (const e of i.evidence) p(`- \`${e.label}\`: ${e.value}`);
    }
    p('');
    p(
      i.source === 'ai'
        ? '> How this was determined: a model judged severity and business impact from measured telemetry. It did not decide what fired.'
        : '> How this was determined: a fixed rule over observed network traffic.'
    );
    p('');
  }

  // Vendors
  section('Tags found on the page');
  p('| Vendor | Requests | Failed | Account IDs | Events seen |');
  p('|---|---|---|---|---|');
  for (const v of report.summary.vendorsDetected) {
    p(
      `| ${v.label} | ${v.requests} | ${v.failures} | \`${v.accountIds.join('`, `') || '—'}\` | ${
        v.events.slice(0, 6).join(', ') || '—'
      } |`
    );
  }

  // Event naming
  if (report.eventTaxonomy && report.eventTaxonomy.length) {
    section('What the event names mean');
    p('| Event | Vendor | Category | In plain English | Should be called |');
    p('|---|---|---|---|---|');
    for (const e of report.eventTaxonomy) {
      p(`| \`${e.event_name}\` | ${e.vendor} | ${e.category} | ${e.plain_english_meaning} | \`${e.suggested_name}\` |`);
    }
  }

  // Duplicates
  const dup = (report.checks.find((c) => c.id === 'no_duplicates') || {}).dupGroups || [];
  if (dup.length) {
    section('Things that fired more than once');
    p('| Vendor | Event | Times | Conversion? | Phases |');
    p('|---|---|---|---|---|');
    for (const d of dup) {
      p(`| ${d.vendorLabel} | \`${d.event}\` | ${d.count} | ${d.isConversion ? 'yes' : 'no'} | ${d.phases.join(', ')} |`);
    }
  }

  // Raw evidence
  section('Raw evidence');
  p('**Session phases**');
  p('');
  p('| Phase | From | To |');
  p('|---|---|---|');
  for (const ph of report.phaseTimeline) p(`| ${ph.phase} | ${ph.startedMs}ms | ${ph.endedMs}ms |`);
  p('');
  p('**Every event captured**');
  p('');
  p('| t (ms) | Phase | Vendor | Event | Status | Account | Conv. | Standard |');
  p('|---|---|---|---|---|---|---|---|');
  for (const e of report.networkLog.filter((x) => x.event)) {
    p(
      `| ${e.tMs} | ${e.phase} | ${e.vendor} | \`${e.event}\` | ${e.failure || e.status || '—'} | \`${
        e.accountId || '—'
      }\` | ${e.isConversion ? 'yes' : ''} | ${e.isStandardEvent === null ? '—' : e.isStandardEvent ? 'yes' : 'no'} |`
    );
  }

  const failed = report.networkLog.filter((e) => e.failure || (e.status && e.status >= 400));
  if (failed.length) {
    p('');
    p('**Requests that never arrived**');
    p('');
    for (const f of failed) p(`- \`${f.failure || f.status}\` — ${abridgeUrl(f.url)}`);
  }

  p('');
  p('---');
  p('');
  p(
    `*Generated by the Landing Page Pre-Flight Auditor. Observation by Playwright/Chromium; checks are deterministic; interpretation ${
      report.aiAvailable ? `by ${report.aiModel}` : 'unavailable for this run'
    }. Single-run sampling — this is evidence, not proof. See NOTE.md.*`
  );

  return L.join('\n');
}

(async () => {
  const url = process.argv[2] || DEFAULT_TARGET_URL;
  console.log(`Auditing ${url} ...`);

  const report = await performAudit(url, { interactions: true });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'audit-report.md'), md(report), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'audit-raw.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(`\n  verdict   ${report.verdict}  (${report.readinessScore}/100)`);
  console.log(`  findings  ${report.counts.high} high / ${report.counts.medium} medium / ${report.counts.low} low`);
  console.log(`  captured  ${report.summary.totalTrackingRequests} requests from ${report.summary.vendorCount} vendors`);
  console.log(`  ai        ${report.aiAvailable ? report.aiModel : 'unavailable — ' + report.aiError}`);
  console.log(`\nWrote sample-report/audit-report.md and sample-report/audit-raw.json`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
