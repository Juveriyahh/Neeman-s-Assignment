import React from 'react';
import { ScoreDial, DeliveryDonut, BarList, SignalMatrix, Stat, C } from './charts.jsx';

/* ===========================================================================
   THE BUSINESS READ
   For whoever controls the budget. No vendor IDs, no status codes, no
   selectors, no fingerprints. Every number is framed as a consequence.
   Anything a person would need an engineer to interpret belongs in the
   technical view instead.
   =========================================================================== */

const AD_PLATFORMS = ['meta_pixel', 'google_ads', 'tiktok', 'pinterest', 'snap', 'bing', 'criteo'];

/**
 * Business-facing names. "Meta Pixel" and "Snap Pixel" are the engineering
 * names for the tag; the budget holder thinks in terms of the channel they
 * buy. The technical view keeps the precise vendor names.
 */
const FRIENDLY = {
  meta_pixel: 'Facebook & Instagram',
  google_ads: 'Google Ads',
  snap: 'Snapchat',
  criteo: 'Criteo',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  bing: 'Microsoft Ads',
  ga4: 'Google Analytics',
  gtm: 'Google Tag Manager',
  clarity: 'Microsoft Clarity',
  hotjar: 'Hotjar',
  shopify: 'Shopify',
  klaviyo: 'Klaviyo',
  segment: 'Segment',
  ua: 'Google Analytics (old)',
};
const friendly = (v) => FRIENDLY[v.id] || v.label;

/** Plain-English gloss for platforms a marketer actually buys on. */
const PLATFORM_NOTE = {
  meta_pixel: ['Facebook & Instagram ads can optimise and retarget.', 'Facebook & Instagram can’t retarget people who add to cart.'],
  google_ads: ['Google Ads can optimise towards cart adds.', 'Google Ads is bidding without knowing who adds to cart.'],
  snap: ['Snapchat ads can optimise towards cart adds.', 'Snapchat is bidding blind on cart adds.'],
  criteo: ['Criteo can retarget cart abandoners.', 'Criteo can’t retarget people who add to cart.'],
  tiktok: ['TikTok ads can optimise towards cart adds.', 'TikTok is bidding blind on cart adds.'],
  pinterest: ['Pinterest ads can optimise towards cart adds.', 'Pinterest is bidding blind on cart adds.'],
  bing: ['Microsoft Ads can optimise towards cart adds.', 'Microsoft Ads is bidding blind on cart adds.'],
};

function Block({ title, lede, children }) {
  return (
    <section className="mb-12">
      <h3 className="display text-[19px] text-ink">{title}</h3>
      {lede && <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-muted">{lede}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function BusinessView({ report, onSeeTechnical }) {
  const { summary, counts } = report;
  const high = counts.high;

  // --- derived, all from facts the deterministic layer already established ---
  const vendorIds = summary.vendorsDetected.map((v) => v.id);
  const installedAd = summary.vendorsDetected.filter((v) => AD_PLATFORMS.includes(v.id));

  const atcCheck = report.checks.find((c) => c.id === 'atc_tracked') || {};
  const conversionByVendor = new Set(
    report.networkLog
      .filter((e) => e.isConversion && (e.phase === 'add_to_cart' || e.phase === 'settle'))
      .map((e) => e.vendor)
  );

  const matrixRows = installedAd.map((v) => {
    const sees = conversionByVendor.has(v.id);
    const note = PLATFORM_NOTE[v.id] || ['Receives cart-add signal.', 'Receives no cart-add signal.'];
    return { label: friendly(v), seesPage: true, seesConversion: sees, note: sees ? note[0] : note[1] };
  });

  const dupGroups = (report.checks.find((c) => c.id === 'no_duplicates') || {}).dupGroups || [];
  const inflatedConversions = dupGroups.filter((d) => d.isConversion);
  const splitPlatforms = summary.vendorsDetected
    .filter((v) => v.accountIds.length > 1 && v.id !== 'gtm')
    .map((v) => ({ ...v, friendlyLabel: friendly(v) }));

  const blindPlatforms = matrixRows.filter((r) => !r.seesConversion);

  // Findings, business-risk text only. No evidence, no selectors, no IDs.
  const topFindings = [...report.issues, ...report.aiIssues]
    .filter((i) => i.severity === 'high' || i.severity === 'medium')
    .slice(0, 6);

  const steps =
    report.recommendedNextSteps && report.recommendedNextSteps.length
      ? report.recommendedNextSteps
      : buildFallbackSteps({ blindPlatforms, inflatedConversions, splitPlatforms, summary });

  return (
    <div className="pt-8">
      {/* ------------------------------------------------ the one-line answer */}
      <section className="mb-12 grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <span className="kicker">The short version</span>
          <p className="mt-3 max-w-[60ch] text-[22px] font-light leading-snug text-ink">
            {report.executiveSummary || plainSummary(report, blindPlatforms)}
          </p>
        </div>
        <div className="justify-self-center md:justify-self-end">
          <ScoreDial score={report.readinessScore} verdict={report.verdict} />
        </div>
      </section>

      {/* -------------------------------------------------------- headline stats */}
      <section className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          value={blindPlatforms.length}
          tone={blindPlatforms.length ? 'danger' : 'good'}
          label="Ad platforms flying blind"
          caption={
            blindPlatforms.length
              ? `${blindPlatforms.map((b) => b.label).join(', ')} never learn when someone adds to cart.`
              : 'Every platform you advertise on sees cart adds.'
          }
        />
        <Stat
          value={inflatedConversions.length}
          tone={inflatedConversions.length ? 'danger' : 'good'}
          label="Sales signals counted twice"
          caption={
            inflatedConversions.length
              ? 'Your reported conversions are higher than the real number.'
              : 'Nothing is being double-counted.'
          }
        />
        <Stat
          value={splitPlatforms.length}
          tone={splitPlatforms.length ? 'warn' : 'good'}
          label="Platforms split across accounts"
          caption={
            splitPlatforms.length
              ? 'No single report shows the whole picture for these.'
              : 'Each platform reports into one place.'
          }
        />
        <Stat
          value={summary.failedRequests}
          tone={summary.failedRequests ? 'warn' : 'good'}
          label="Messages that never arrived"
          caption={
            summary.failedRequests
              ? 'Data the page tried to send but that never reached the platform.'
              : 'Everything the page sent was received.'
          }
        />
      </section>

      {/* --------------------------------------------- can they see a sale? */}
      <Block
        title="Can the platforms you pay actually see a sale?"
        lede="Every platform below is live on this page, which means you can advertise on it. The second column is the one that costs money: if a platform never hears about an add to cart, it cannot optimise towards buyers or retarget the people who nearly bought."
      >
        {matrixRows.length ? (
          <SignalMatrix rows={matrixRows} />
        ) : (
          <p className="text-[14px] italic text-muted">No ad platforms were detected on this page.</p>
        )}

        {atcCheck.status === 'not_applicable' && (
          <p className="mt-4 rounded-2xl bg-beige px-5 py-4 text-[13.5px] leading-relaxed text-ink2">
            <strong className="font-medium">Worth knowing:</strong> {atcCheck.detail} Treat the column above as
            unverified rather than as a clean result.
          </p>
        )}
      </Block>

      {/* ------------------------------------------------ is the data arriving */}
      <div className="mb-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h3 className="display text-[19px] text-ink">Is your data arriving?</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            The page sent {summary.totalTrackingRequests} messages to tracking and ad platforms while we watched it.
          </p>
          <div className="mt-5">
            <DeliveryDonut total={summary.totalTrackingRequests} failed={summary.failedRequests} />
          </div>
        </section>

        <section>
          <h3 className="display text-[19px] text-ink">Who is watching this page?</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            How much each tool is being told. A tool with very little traffic may be installed but not working properly.
          </p>
          <div className="mt-5">
            <BarList
              items={summary.vendorsDetected.slice(0, 7).map((v) => ({
                label: friendly(v),
                value: v.requests,
                colour: v.failures ? C.danger : AD_PLATFORMS.includes(v.id) ? C.gold : C.ink,
              }))}
            />
            <p className="mt-3 text-[12px] text-faint">
              Gold = a platform you can buy ads on. Red = some of its messages failed to arrive.
            </p>
          </div>
        </section>
      </div>

      {/* --------------------------------------------------- what's wrong */}
      <Block
        title="What’s actually wrong"
        lede="In plain English, worst first. The engineering detail behind each of these lives in the technical report."
      >
        {topFindings.length === 0 ? (
          <p className="text-[14px] italic text-muted">Nothing serious enough to list here.</p>
        ) : (
          <ol className="space-y-4">
            {topFindings.map((i, n) => (
              <li key={i.id} className="card flex gap-4 p-5">
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-[12px] font-medium text-white"
                  style={{ background: i.severity === 'high' ? C.danger : C.warn }}
                >
                  {n + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium leading-snug text-ink">
                    {toPlainTitle(i)}
                  </p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                    {i.businessRisk || i.detail}
                  </p>
                  {i.affectedMetric && (
                    <p className="mt-2 text-[12px] text-ink2">
                      <span className="kicker">Distorts</span> <span className="ml-1">{i.affectedMetric}</span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Block>

      {/* ------------------------------------------------------- next steps */}
      <Block title="What to do next" lede="In order. The first item is the one that costs you money today.">
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="display mt-[2px] w-6 shrink-0 text-[15px] text-gold">{String(i + 1).padStart(2, '0')}</span>
              <span className="max-w-[72ch] text-[14.5px] leading-relaxed text-ink2">{s}</span>
            </li>
          ))}
        </ol>
      </Block>

      {/* ----------------------------------------------------------- handoff */}
      <section className="rounded-2xl border border-line bg-surface px-6 py-5">
        <h3 className="display text-[16px] text-ink">Passing this to an engineer?</h3>
        <p className="mt-2 max-w-[68ch] text-[13.5px] leading-relaxed text-muted">
          The technical report has the exact rule behind every check, the evidence for each finding, the full list of
          tags and account IDs, and the complete second-by-second network log.
        </p>
        <button onClick={onSeeTechnical} className="btn-ghost mt-4">
          Open the technical report
        </button>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

/** Strip engineering vocabulary out of a finding title for the business read. */
function toPlainTitle(issue) {
  return issue.title
    .replace(/\s*\(first at [^)]+\)/, '')
    .replace(/\s*\(net::[^)]+\)/, '')
    .replace(/Meta Pixel/g, 'Facebook & Instagram')
    .replace(/Google Analytics 4/g, 'Google Analytics')
    .replace(/Snap Pixel/g, 'Snapchat')
    .replace(/request\(s\)/g, 'messages');
}

function plainSummary(report, blind) {
  const bits = [];
  if (report.verdict === 'NOT_READY') {
    bits.push('This page is not ready for ad spend yet.');
  } else if (report.verdict === 'READY_WITH_FIXES') {
    bits.push('You can spend on this page, but fix the items below first.');
  } else {
    bits.push('This page is safe to put ad spend behind.');
  }
  if (blind.length) {
    bits.push(
      `${blind.map((b) => b.label).join(' and ')} cannot see when someone adds to cart, so any budget you give them is being spent without a sales signal to aim at.`
    );
  }
  if (report.counts.high && !blind.length) {
    bits.push(`${report.counts.high} serious problems were found that will distort what you are reporting.`);
  }
  return bits.join(' ');
}

/** Used when the AI layer is unavailable, so the business view is never empty. */
function buildFallbackSteps({ blindPlatforms, inflatedConversions, splitPlatforms, summary }) {
  const steps = [];
  if (blindPlatforms.length)
    steps.push(
      `Get the add-to-cart event firing into ${blindPlatforms
        .map((b) => b.label)
        .join(' and ')}. Until that happens, spend on those platforms is being optimised without a sales signal.`
    );
  if (inflatedConversions.length)
    steps.push(
      `Stop the duplicate conversion events. Your reported sales numbers are currently higher than the real ones, which makes the campaign look better than it is.`
    );
  if (splitPlatforms.length)
    steps.push(
      `Consolidate ${splitPlatforms
        .map((s) => s.friendlyLabel || s.label)
        .join(', ')} onto a single account each, or agree which account is the source of truth before anyone reports on this campaign.`
    );
  if (summary.failedRequests)
    steps.push(
      `Investigate the ${summary.failedRequests} tracking message(s) that never reached their destination — that data is simply lost.`
    );
  steps.push('Re-run this inspection after the fixes, and run it more than once — results vary between visits.');
  return steps;
}
