'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { chromium } = require('playwright-core');

const {
  classifyVendor,
  isConversionEvent,
  isStandardEvent,
  vendorLabel,
  REQUIRED_VENDOR_IDS,
  AD_PLATFORM_IDS,
  VOLATILE_PARAMS,
} = require('./trackingTaxonomy');

const { analyzeTelemetry } = require('./geminiService');
const { logAuditRun, listAuditRuns, getAuditRun, supabaseStatus } = require('./supabaseClient');

const DEFAULT_TARGET_URL =
  process.env.DEFAULT_TARGET_URL ||
  'https://neemans.com/products/curve-knit-slip-ons-for-men-ivory';

// ===========================================================================
// STAGE 1 -- OBSERVATION
// A real Chromium session. We watch what the page actually does on the wire.
// No HTML parsing, no guessing from script tags: a <script> present in the
// DOM proves nothing about whether a beacon left the machine.
// ===========================================================================

const MAX_ROWS_PER_REQUEST = 20; // some beacons carry hundreds of params

/**
 * Keys that identify WHAT an event is. They survive the row cap unconditionally.
 * Without this, a GA4 beacon's ~18 query params fill the cap and the `en` in
 * its POST body is never read -- every GA4 event comes back unnamed.
 */
const PRIORITY_PARAMS = new Set([
  'en', 'ev', 'event', 'event_name', 't', 'tid', 'id', 'label', 'event_type',
  'pid', 'ti', 'ea', 'sdkid', 'a', 'account', 'schema_id', 'type',
]);

/** Flatten nested JSON bodies into dotted key/value pairs. */
function flattenJson(obj, prefix = '', out = {}, depth = 0) {
  if (depth > 4 || out.__count > 200) return out;
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    obj.slice(0, 10).forEach((v, i) => flattenJson(v, `${prefix}[${i}]`, out, depth + 1));
    return out;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      flattenJson(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
    }
    return out;
  }
  out[prefix] = String(obj);
  return out;
}

/**
 * Extract key/value rows from a tracking request.
 * GA4 batches arrive as newline-delimited urlencoded blocks in the POST body;
 * Segment / Shopify / TikTok send JSON. Both need handling.
 */
function extractParams(url, postData, contentType) {
  const all = {};
  const put = (k, v) => {
    if (!(k in all)) all[k] = v;
  };

  try {
    const u = new URL(url);
    for (const [k, v] of u.searchParams.entries()) put(k, v);
  } catch {
    /* malformed URL -- ignore */
  }

  if (postData) {
    const ct = (contentType || '').toLowerCase();
    if (ct.includes('json') || /^\s*[[{]/.test(postData)) {
      try {
        for (const [k, v] of Object.entries(flattenJson(JSON.parse(postData)))) put(k, v);
      } catch {
        /* not JSON after all */
      }
    } else {
      // GA4 sends newline-delimited urlencoded batches.
      for (const line of postData.split('\n')) {
        if (!line.trim()) continue;
        try {
          for (const [k, v] of new URLSearchParams(line).entries()) put(k, v);
        } catch {
          /* ignore */
        }
      }
    }
  }

  // Apply the cap, but never at the expense of the keys that say what the
  // event actually is.
  const rows = {};
  for (const k of Object.keys(all)) if (PRIORITY_PARAMS.has(k)) rows[k] = all[k];
  for (const k of Object.keys(all)) {
    if (Object.keys(rows).length >= MAX_ROWS_PER_REQUEST) break;
    if (!(k in rows)) rows[k] = all[k];
  }
  return rows;
}

/** Vendor-specific event-name extraction. */
function extractEventName(vendorId, params) {
  const p = params || {};
  switch (vendorId) {
    case 'ga4':
    case 'ua':
      return p.en || p.t || null;
    case 'meta_pixel':
      return p.ev || null;
    case 'tiktok':
      return p.event || p['context.event'] || p['event_name'] || null;
    case 'google_ads':
      // `en` is the readable gtag event name; `label` is an opaque conversion
      // label and makes a useless finding title.
      return p.en || p.label || p.value || null;
    case 'snap':
      return p.event_type || p.ev || null;
    case 'pinterest':
      return p.event || null;
    case 'bing':
      return p.ea || p.evt || null;
    case 'criteo':
      return p.ev || p.event || null;
    case 'klaviyo':
      return p.event || null;
    case 'segment':
      return p.event || p.type || null;
    case 'shopify':
      return p['events[0].schema_id'] || p.schema_id || null;
    case 'gtm':
      return 'container_load';
    default:
      return p.event || p.en || p.ev || null;
  }
}

/** Vendor-specific account/property id extraction. */
function extractAccountId(vendorId, params, url) {
  const p = params || {};
  switch (vendorId) {
    case 'ga4':
    case 'ua':
      return p.tid || null;
    case 'meta_pixel':
      return p.id || null;
    case 'tiktok':
      return p['context.pixel.code'] || p.sdkid || null;
    case 'google_ads': {
      const m = url.match(/\/(?:pagead\/)?(?:conversion|viewthroughconversion)\/(\d+)/);
      return m ? m[1] : p.tid || null;
    }
    case 'snap':
      return p.pid || null;
    case 'pinterest':
      return p.tid || null;
    case 'bing':
      return p.ti || null;
    case 'criteo':
      return p.a || p.account || null;
    case 'clarity': {
      const m = url.match(/clarity\.ms\/tag\/([a-z0-9]+)/i);
      return m ? m[1] : null;
    }
    case 'hotjar': {
      const m = url.match(/hotjar-(\d+)\.js/) || url.match(/[?&]site[_-]?id=(\d+)/i);
      return m ? m[1] : null;
    }
    case 'gtm': {
      const m = url.match(/[?&]id=(GTM-[A-Z0-9]+|G-[A-Z0-9]+)/);
      return m ? m[1] : null;
    }
    default:
      return p.id || p.tid || null;
  }
}

/**
 * Stable fingerprint for duplicate detection.
 * Volatile params are stripped first -- without that step every beacon looks
 * unique and the check silently never fires.
 */
function fingerprint(vendorId, eventName, params) {
  const stable = Object.entries(params || {})
    .filter(([k]) => !VOLATILE_PARAMS.has(k))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return crypto
    .createHash('sha1')
    .update(`${vendorId}|${eventName || ''}|${stable}`)
    .digest('hex');
}

/** Shorten a tracking URL for human display without losing diagnostic value. */
function abridgeUrl(url) {
  try {
    const u = new URL(url);
    const keep = ['tid', 'en', 'ev', 'id'];
    const kept = [];
    let dropped = 0;
    for (const [k, v] of u.searchParams.entries()) {
      if (keep.includes(k) && kept.length < 4) kept.push(`${k}=${v}`);
      else dropped++;
    }
    const q = kept.length ? `?${kept.join('&')}` : '';
    const suffix = dropped ? ` (+${dropped} params)` : '';
    return `${u.origin}${u.pathname}${q}${suffix}`;
  } catch {
    return String(url).slice(0, 200);
  }
}

/**
 * Drive a real browser at the page and record every ad-tech request it makes.
 */
// On Vercel (and any other AWS Lambda-style runtime) there is no Chrome on the
// box, so we boot the @sparticuz/chromium build that ships inside the bundle.
// Locally that binary is usually absent or the wrong platform, so we fall back
// to whatever Chrome/Chromium playwright-core can find itself.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function browserLaunchOptions() {
  const base = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (!IS_SERVERLESS) {
    if (process.env.CHROME_EXECUTABLE_PATH) base.executablePath = process.env.CHROME_EXECUTABLE_PATH;
    return base;
  }
  // @sparticuz/chromium is ESM-only, so it cannot be require()'d from this
  // CommonJS file -- a top-level require crashes the whole function before a
  // single route runs. Import it lazily, and only on the runtime that needs it.
  const mod = await import('@sparticuz/chromium');
  const serverlessChromium = mod.default || mod;
  return {
    ...base,
    args: [...serverlessChromium.args, ...base.args],
    executablePath: await serverlessChromium.executablePath(),
  };
}

async function runBrowserSession(targetUrl, opts = {}) {
  const doInteractions = opts.interactions !== false;

  const networkLog = [];
  const consoleErrors = [];
  const byUrl = new Map(); // url -> entries awaiting a response status
  const phaseTimeline = [];

  let currentPhase = 'load';
  let phaseStartedAt = Date.now();
  const t0 = Date.now();

  const setPhase = (p) => {
    phaseTimeline.push({ phase: currentPhase, startedMs: phaseStartedAt - t0, endedMs: Date.now() - t0 });
    currentPhase = p;
    phaseStartedAt = Date.now();
  };

  let browser;
  let navStatus = null;
  let finalUrl = null;
  let navError = null;
  let ctaFound = false;
  let ctaStrategy = null;
  let cartConfirmed = null;
  let cartDetail = null;
  let consentHandled = false;

  try {
    browser = await chromium.launch(await browserLaunchOptions());

    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      // An India-local session sees the same currency and regional scripts a
      // real Neeman's shopper triggers. Locale changes which tags fire.
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });

    const page = await context.newPage();

    // --- listener 1: outbound requests ------------------------------------
    page.on('request', (req) => {
      const url = req.url();
      const vendor = classifyVendor(url);
      if (!vendor) return; // not ad-tech; drop immediately, this is the hot path

      let postData = null;
      try {
        postData = req.postData();
      } catch {
        /* some request types cannot expose a body */
      }

      const headers = req.headers();
      const params = extractParams(url, postData, headers['content-type']);
      const eventName = extractEventName(vendor.id, params);

      const entry = {
        tMs: Date.now() - t0,
        phase: currentPhase,
        vendor: vendor.id,
        vendorLabel: vendor.label,
        family: vendor.family,
        method: req.method(),
        resourceType: req.resourceType(),
        url,
        urlAbridged: abridgeUrl(url),
        event: eventName,
        accountId: extractAccountId(vendor.id, params, url),
        isConversion: isConversionEvent(eventName),
        isStandardEvent: isStandardEvent(vendor.id, eventName),
        params,
        fingerprint: fingerprint(vendor.id, eventName, params),
        status: null,
        failure: null,
      };

      networkLog.push(entry);
      if (!byUrl.has(url)) byUrl.set(url, []);
      byUrl.get(url).push(entry);
    });

    // --- listener 2: responses -------------------------------------------
    page.on('response', (res) => {
      const list = byUrl.get(res.url());
      if (!list) return;
      for (const e of list) {
        if (e.status === null) {
          e.status = res.status();
          break;
        }
      }
    });

    // --- listener 3: transport failures ----------------------------------
    // NOT optional. A request that dies at the transport layer
    // (ERR_CONNECTION_TIMED_OUT, ERR_ABORTED) never produces a `response`
    // event at all. On a real Neeman's page these are consistently the
    // highest-severity findings; a response listener alone misses them.
    page.on('requestfailed', (req) => {
      const list = byUrl.get(req.url());
      if (!list) return;
      const failure = (req.failure() && req.failure().errorText) || 'unknown_failure';
      for (const e of list) {
        if (e.status === null && e.failure === null) {
          e.failure = failure;
          break;
        }
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error' && consoleErrors.length < 50) {
        consoleErrors.push({ tMs: Date.now() - t0, phase: currentPhase, text: msg.text().slice(0, 400) });
      }
    });
    page.on('pageerror', (err) => {
      if (consoleErrors.length < 50) {
        consoleErrors.push({
          tMs: Date.now() - t0,
          phase: currentPhase,
          text: `pageerror: ${String(err.message).slice(0, 400)}`,
        });
      }
    });

    // --- phase: load ------------------------------------------------------
    try {
      // domcontentloaded, not load: ad-tech routinely hangs the load event.
      const resp = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      navStatus = resp ? resp.status() : null;
      finalUrl = page.url();
    } catch (err) {
      navError = String(err.message).split('\n')[0];
      finalUrl = page.url();
    }

    if (!navError) {
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
    }

    if (doInteractions && !navError) {
      // --- phase: consent -------------------------------------------------
      // Most tags fire nothing until consent is granted. Skipping this step
      // falsely reports missing pixels.
      setPhase('consent');
      const consentSelectors = [
        '#onetrust-accept-btn-handler',
        'button:has-text("Accept all")',
        'button:has-text("Accept All")',
        'button:has-text("I Agree")',
        'button:has-text("Got it")',
        '[aria-label="Accept cookies"]',
      ];
      for (const sel of consentSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 900 })) {
            await el.click({ timeout: 2000 });
            consentHandled = true;
            break;
          }
        } catch {
          /* selector absent -- try the next */
        }
      }
      await page.waitForTimeout(1200);

      // --- phase: scroll --------------------------------------------------
      // Real stepping, not a jump: lazy-loaded and scroll-depth tags only
      // trigger on genuine intermediate scroll positions.
      setPhase('scroll');
      try {
        const height = await page.evaluate(() => document.body.scrollHeight);
        const step = Math.floor(900 * 0.8);
        for (let y = 0; y < Math.min(height, 12000); y += step) {
          await page.evaluate((yy) => window.scrollTo(0, yy), y);
          await page.waitForTimeout(350);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(800);
      } catch {
        /* scroll is best-effort */
      }

      // --- phase: add_to_cart ---------------------------------------------
      setPhase('add_to_cart');

      // Many PDPs disable the CTA until a variant is chosen.
      const variantSelectors = [
        'input[name="Size"]:not(:disabled)',
        'label[for*="Size"]',
        '[data-variant-option]:not([disabled])',
        '.swatch-element:not(.soldout) label',
        'select[name="id"]',
      ];
      for (const sel of variantSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 700 })) {
            await el.click({ timeout: 1500 }).catch(() => {});
            await page.waitForTimeout(700);
            break;
          }
        } catch {
          /* ignore */
        }
      }

      const ctaSelectors = [
        'button[name="add"]',
        'form[action*="/cart/add"] button[type="submit"]',
        '[data-add-to-cart]',
        '.product-form__submit',
        '#AddToCart',
        'button:has-text("Add to Cart")',
        'button:has-text("Add to cart")',
        'button:has-text("ADD TO BAG")',
        'button:has-text("Add to Bag")',
      ];

      // Cart line count before the click, so we can tell a real add from a
      // click that merely landed on something.
      const cartCount = async () => {
        try {
          const r = await page.evaluate(async () => {
            const res = await fetch('/cart.js', { headers: { accept: 'application/json' } });
            return res.ok ? (await res.json()).item_count : null;
          });
          return typeof r === 'number' ? r : null;
        } catch {
          return null;
        }
      };
      const cartBefore = await cartCount();

      // Product carousels ("you may also like", upsells) contain their own
      // add-to-cart buttons. Clicking one of those adds a DIFFERENT product and
      // tells you nothing about this page's tracking.
      const CAROUSEL = '[class*="recommend"],[class*="carousel"],[class*="slider"],[class*="ymal"],[class*="upsell"],[class*="related"]';

      for (const sel of ctaSelectors) {
        if (ctaFound) break;
        try {
          const all = page.locator(sel);
          const n = Math.min(await all.count(), 8);
          let el = null;
          for (let i = 0; i < n; i++) {
            const cand = all.nth(i);
            if (!(await cand.isVisible({ timeout: 600 }).catch(() => false))) continue;
            const inCarousel = await cand
              .evaluate((node, s) => Boolean(node.closest(s)), CAROUSEL)
              .catch(() => false);
            if (inCarousel) continue;
            el = cand;
            break;
          }
          if (!el) continue;
          await el.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
          try {
            await el.click({ timeout: 2500 });
            ctaFound = true;
            ctaStrategy = `${sel} (normal click)`;
          } catch {
            // A sticky header intercepts the pointer on Neeman's; the forced
            // click is what actually makes this work.
            await el.click({ timeout: 2500, force: true });
            ctaFound = true;
            ctaStrategy = `${sel} (forced click)`;
          }
        } catch {
          /* try next selector */
        }
      }

      if (ctaFound) {
        await page.waitForTimeout(2000);

        // Many PDPs answer the first click with a size/variant chooser rather
        // than adding anything. If one appeared, pick an option and confirm --
        // otherwise we would record a click that never became an add-to-cart.
        const optionSelectors = [
          '.nms-size-popup__size-box:visible',
          '[class*="size-popup"] [class*="size-box"]:visible',
          '[role="dialog"] [class*="swatch"]:visible',
          '[role="dialog"] [data-value]:visible',
        ];
        for (const sel of optionSelectors) {
          try {
            const opts = page.locator(sel);
            const n = await opts.count();
            if (!n) continue;
            // Middle option: least likely to be an out-of-stock edge size.
            await opts.nth(Math.floor(n / 2)).click({ timeout: 3000 });
            await page.waitForTimeout(1200);
            const confirm = page
              .locator('button:visible')
              .filter({ hasText: /add to cart|add to bag/i })
              .last();
            if (await confirm.count()) {
              await confirm.click({ timeout: 3000 }).catch(() => {});
              ctaStrategy += ' + variant chooser';
            }
            break;
          } catch {
            /* try next */
          }
        }

        await page.waitForTimeout(3000);
        const cartAfter = await cartCount();
        // Distinguishes "the click added an item" from "the click did nothing".
        // Without this the add-to-cart check can pass on a dead button.
        cartConfirmed =
          cartBefore !== null && cartAfter !== null ? cartAfter > cartBefore : null;
        cartDetail = `cart item count ${cartBefore} -> ${cartAfter}`;
      }

      // Conversion beacons fire after the click, not during it.
      await page.waitForTimeout(4000);

      // --- phase: settle --------------------------------------------------
      setPhase('settle');
      await page.waitForTimeout(1500);
    }

    setPhase('done');
    await context.close().catch(() => {});
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return {
    networkLog,
    consoleErrors,
    phaseTimeline: phaseTimeline.filter((p) => p.phase !== 'done'),
    navigation: { status: navStatus, finalUrl, error: navError },
    interaction: { ctaFound, ctaStrategy, consentHandled, cartConfirmed, cartDetail, attempted: doInteractions },
    durationMs: Date.now() - t0,
  };
}

// ===========================================================================
// STAGE 2 -- DETERMINISTIC CHECKS
// Fixed rules over observed facts. No model involved, no variance between
// runs given the same telemetry. `method` ships in the API payload and is
// rendered in the UI so a reader can audit the auditor.
// ===========================================================================

const CHECK_DEFINITIONS = [
  {
    id: 'page_loads',
    label: 'The page actually loads',
    question: 'Will someone who clicks the ad reach the page at all?',
    method:
      'The navigation response is an HTTP 2xx, and the URL the browser ended on has the same hostname as the one requested (ignoring a leading "www.").',
  },
  {
    id: 'tags_present',
    label: 'Your tags are installed and firing',
    question: 'Are Google Analytics and the Meta Pixel actually on this page?',
    method:
      'Google Analytics 4 and Meta Pixel must each have sent at least one network request during the session.',
  },
  {
    id: 'no_duplicates',
    label: 'Nothing fires twice',
    question: 'Is the page counting the same thing more than once?',
    method:
      'A SHA-1 fingerprint of vendor + event name + payload, with every param that changes on every hit removed first. Two requests sharing a fingerprint are the same beacon sent twice, not two legitimate events.',
  },
  {
    id: 'delivery_ok',
    label: 'The data actually arrives',
    question: 'Does the data reach the platforms, or does it die on the way?',
    method:
      'Any tracking request answered with a 4xx or 5xx, plus any request that failed at the transport layer and never got a response at all. Grouped by vendor and status.',
  },
  {
    id: 'one_account',
    label: 'One account per platform',
    question: 'Is the data all landing in the same account, or split across several?',
    method:
      'For each vendor, count the distinct account / property / pixel IDs seen. More than one means the traffic is being split.',
  },
  {
    id: 'atc_tracked',
    label: 'Add to cart gets tracked',
    question: 'When someone adds to cart, do the ad platforms find out?',
    method:
      'During the add-to-cart phase specifically, each installed ad platform must have received at least one event matching a commercial-intent pattern. If no add-to-cart button could be found, this is recorded as not applicable rather than pass or fail.',
  },
  {
    id: 'event_names',
    label: 'Event names make sense to the platforms',
    question: 'Will the ad platforms understand the events they are being sent?',
    method:
      'Each Meta and GA4 event name is checked for membership in that platform\'s published standard event vocabulary. Names outside it are custom and cannot drive built-in optimisation.',
  },
  {
    id: 'no_legacy',
    label: 'Nothing dead is still running',
    question: 'Is the page still sending data to a system that was switched off?',
    method:
      'Any hit to the Universal Analytics /collect endpoint. Universal Analytics stopped processing data in July 2024; these requests go nowhere.',
  },
];

let issueSeq = 0;
function makeIssue(severity, title, detail, evidence) {
  return {
    id: `det-${++issueSeq}`,
    source: 'measured',
    severity, // 'high' | 'medium' | 'low'
    title,
    detail,
    evidence: evidence || [],
  };
}

function runDeterministicChecks(session, targetUrl) {
  issueSeq = 0;
  const log = session.networkLog;
  const issues = [];
  const checks = [];

  const record = (id, status, detail, issueIds = [], extra = {}) => {
    const def = CHECK_DEFINITIONS.find((d) => d.id === id);
    checks.push({ ...def, status, detail, issueIds, ...extra });
  };

  const vendorsSeen = [...new Set(log.map((e) => e.vendor))];

  // --- 1. page loads -------------------------------------------------------
  const host = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  };
  const nav = session.navigation;
  const sameHost = nav.finalUrl && host(nav.finalUrl) === host(targetUrl);
  const ok2xx = nav.status !== null && nav.status >= 200 && nav.status < 300;
  if (nav.error) {
    const i = makeIssue('high', 'The page never finished loading', `The browser could not load the page: ${nav.error}`, [
      { label: 'navigation error', value: nav.error },
    ]);
    issues.push(i);
    record('page_loads', 'fail', `Navigation failed: ${nav.error}`, [i.id]);
  } else if (!ok2xx) {
    const i = makeIssue('high', `The page answered with HTTP ${nav.status}`, `Ad traffic sent here would land on an error page.`, [
      { label: 'status', value: String(nav.status) },
    ]);
    issues.push(i);
    record('page_loads', 'fail', `Responded HTTP ${nav.status}.`, [i.id]);
  } else if (!sameHost) {
    const i = makeIssue('medium', 'The page redirected to a different site', `Requested ${host(targetUrl)}, ended on ${host(nav.finalUrl)}.`, [
      { label: 'final URL', value: nav.finalUrl },
    ]);
    issues.push(i);
    record('page_loads', 'fail', `Redirected off-host to ${host(nav.finalUrl)}.`, [i.id]);
  } else {
    record('page_loads', 'pass', `Responded HTTP ${nav.status} and stayed on ${host(nav.finalUrl)}.`);
  }

  // --- 2. required tags present -------------------------------------------
  const missing = REQUIRED_VENDOR_IDS.filter((v) => !vendorsSeen.includes(v));
  if (missing.length) {
    const ids = missing.map((m) => {
      const i = makeIssue(
        'high',
        `${vendorLabel(m)} never fired`,
        `No ${vendorLabel(m)} request was observed at any point in the session, including after consent was handled.`,
        [{ label: 'vendors that did fire', value: vendorsSeen.join(', ') || 'none' }]
      );
      issues.push(i);
      return i.id;
    });
    record('tags_present', 'fail', `Missing: ${missing.map(vendorLabel).join(', ')}.`, ids);
  } else {
    record(
      'tags_present',
      'pass',
      `Both required tags fired. ${REQUIRED_VENDOR_IDS.map(
        (v) => `${vendorLabel(v)}: ${log.filter((e) => e.vendor === v).length} requests`
      ).join('; ')}.`
    );
  }

  // --- 3. duplicates -------------------------------------------------------
  const fpGroups = new Map();
  for (const e of log) {
    if (!e.event) continue; // only meaningful for identified events
    if (!fpGroups.has(e.fingerprint)) fpGroups.set(e.fingerprint, []);
    fpGroups.get(e.fingerprint).push(e);
  }
  const dupGroups = [...fpGroups.entries()]
    .filter(([, g]) => g.length > 1)
    .map(([fp, g]) => ({
      fingerprint: fp.slice(0, 12),
      vendor: g[0].vendor,
      vendorLabel: g[0].vendorLabel,
      event: g[0].event,
      count: g.length,
      isConversion: g[0].isConversion,
      phases: [...new Set(g.map((x) => x.phase))],
      timesMs: g.map((x) => x.tMs),
    }))
    .sort((a, b) => b.count - a.count);

  if (dupGroups.length) {
    const ids = dupGroups.slice(0, 6).map((d) => {
      const sev = d.isConversion ? 'high' : 'medium';
      // A page can fire several *different* beacons that share an event name
      // (Google Ads sends one per conversion label). Without the timestamp
      // these findings arrive with identical titles and cannot be told apart.
      const at = `${(d.timesMs[0] / 1000).toFixed(1)}s`;
      const i = makeIssue(
        sev,
        `${d.vendorLabel} sent "${d.event}" ${d.count} times (first at ${at}, during ${d.phases[0]})`,
        d.isConversion
          ? `This is a conversion event. Counting it ${d.count} times inflates reported sales and teaches the ad platform to bid on the wrong signal.`
          : `The identical beacon was sent ${d.count} times, so this event is over-counted by roughly ${Math.round((1 - 1 / d.count) * 100)}%.`,
        [
          { label: 'event', value: `${d.vendorLabel} / ${d.event}` },
          { label: 'fired at (ms)', value: d.timesMs.slice(0, 8).join(', ') },
          { label: 'phases', value: d.phases.join(', ') },
        ]
      );
      issues.push(i);
      return i.id;
    });
    record('no_duplicates', 'fail', `${dupGroups.length} event(s) fired more than once.`, ids, { dupGroups });
  } else {
    record('no_duplicates', 'pass', 'No two beacons shared a fingerprint. Nothing is being double-counted.', [], {
      dupGroups: [],
    });
  }

  // --- 4. delivery ---------------------------------------------------------
  const failed = log.filter((e) => e.failure || (e.status !== null && e.status >= 400));
  const failGroups = new Map();
  for (const e of failed) {
    const key = `${e.vendor}|${e.failure || e.status}`;
    if (!failGroups.has(key)) {
      failGroups.set(key, { vendor: e.vendor, vendorLabel: e.vendorLabel, status: e.failure || e.status, count: 0, samples: [] });
    }
    const g = failGroups.get(key);
    g.count++;
    if (g.samples.length < 3) g.samples.push(e.urlAbridged);
  }
  const failList = [...failGroups.values()].sort((a, b) => b.count - a.count);

  if (failList.length) {
    const ids = failList.slice(0, 6).map((g) => {
      const transport = typeof g.status === 'string';
      const i = makeIssue(
        g.count > 5 || transport ? 'high' : 'medium',
        `${g.count} ${g.vendorLabel} request(s) never arrived (${g.status})`,
        transport
          ? `These requests died before reaching ${g.vendorLabel} at all — no server ever answered them. The data in them is simply gone.`
          : `${g.vendorLabel} rejected these requests with HTTP ${g.status}. The page thinks it sent the data; the platform never accepted it.`,
        [
          { label: 'failure', value: String(g.status) },
          { label: 'count', value: String(g.count) },
          ...g.samples.map((s, n) => ({ label: `sample ${n + 1}`, value: s })),
        ]
      );
      issues.push(i);
      return i.id;
    });
    record('delivery_ok', 'fail', `${failed.length} of ${log.length} tracking requests failed to arrive.`, ids, {
      failGroups: failList,
    });
  } else {
    record('delivery_ok', 'pass', `All ${log.length} tracking requests were accepted.`, [], { failGroups: [] });
  }

  // --- 5. one account per platform ----------------------------------------
  const accounts = new Map();
  for (const e of log) {
    if (!e.accountId) continue;
    if (!accounts.has(e.vendor)) accounts.set(e.vendor, new Set());
    accounts.get(e.vendor).add(e.accountId);
  }
  const accountInventory = [...accounts.entries()].map(([vendor, set]) => ({
    vendor,
    vendorLabel: vendorLabel(vendor),
    accountIds: [...set],
  }));
  const split = accountInventory.filter((a) => a.accountIds.length > 1 && a.vendor !== 'gtm');

  if (split.length) {
    const ids = split.map((s) => {
      const i = makeIssue(
        'medium',
        `${s.vendorLabel} is reporting into ${s.accountIds.length} separate accounts`,
        `Traffic is being split across ${s.accountIds.join(', ')}. No single account sees the whole picture, so every report built on one of them undercounts.`,
        s.accountIds.map((id, n) => ({ label: `account ${n + 1}`, value: id }))
      );
      issues.push(i);
      return i.id;
    });
    record('one_account', 'fail', `${split.length} platform(s) split across multiple accounts.`, ids, { accountInventory });
  } else if (!accountInventory.length) {
    record('one_account', 'not_applicable', 'No account identifiers were observed, so there is nothing to compare.', [], {
      accountInventory,
    });
  } else {
    record('one_account', 'pass', `Each platform resolved to exactly one account.`, [], { accountInventory });
  }

  // --- 6. add to cart tracked ---------------------------------------------
  const installedAdPlatforms = AD_PLATFORM_IDS.filter((v) => vendorsSeen.includes(v));
  if (!session.interaction.attempted) {
    record('atc_tracked', 'not_applicable', 'Interactions were disabled for this run, so add-to-cart was never triggered.');
  } else if (!session.interaction.ctaFound) {
    // An honest third state. Marking this pass or fail would both be lies.
    record(
      'atc_tracked',
      'not_applicable',
      'No add-to-cart button could be located on the page, so this could not be tested. This is not a pass and not a failure — it was not checked.'
    );
  } else if (session.interaction.cartConfirmed === false) {
    // The button was clicked but the cart never changed. The add-to-cart never
    // actually happened, so we cannot judge whether it would be tracked.
    record(
      'atc_tracked',
      'not_applicable',
      `A button was clicked (${session.interaction.ctaStrategy}) but the cart did not change (${session.interaction.cartDetail}). The add-to-cart never happened, so tracking for it could not be tested.`
    );
  } else if (!installedAdPlatforms.length) {
    record('atc_tracked', 'not_applicable', 'No ad platforms are installed, so there is nothing to receive the event.');
  } else {
    const atcPhase = log.filter((e) => e.phase === 'add_to_cart' || e.phase === 'settle');
    const heard = installedAdPlatforms.filter((v) =>
      atcPhase.some((e) => e.vendor === v && e.isConversion)
    );
    const deaf = installedAdPlatforms.filter((v) => !heard.includes(v));
    if (deaf.length) {
      const ids = deaf.map((v) => {
        const i = makeIssue(
          'high',
          `The add-to-cart click produced no conversion event for ${vendorLabel(v)}`,
          `The button was clicked (${session.interaction.ctaStrategy}) and ${vendorLabel(v)} was live on the page, but no commercial-intent event reached it in the ${
            atcPhase.length
          } requests that followed. This platform cannot optimise towards or retarget people who add to cart.`,
          [
            { label: 'click strategy', value: session.interaction.ctaStrategy },
            {
              label: `${vendorLabel(v)} events after the click`,
              value:
                atcPhase
                  .filter((e) => e.vendor === v && e.event)
                  .map((e) => e.event)
                  .slice(0, 8)
                  .join(', ') || 'none',
            },
          ]
        );
        issues.push(i);
        return i.id;
      });
      record('atc_tracked', 'fail', `${deaf.map(vendorLabel).join(', ')} received no conversion event after the click.`, ids);
    } else {
      record('atc_tracked', 'pass', `All ${heard.length} installed ad platform(s) received a conversion event after the click.`);
    }
  }

  // --- 7. event naming -----------------------------------------------------
  const named = log.filter((e) => e.event && e.isStandardEvent !== null);
  const nonStandard = [...new Set(named.filter((e) => e.isStandardEvent === false).map((e) => `${e.vendor}|${e.event}`))].map(
    (k) => {
      const [vendor, event] = k.split('|');
      return { vendor, vendorLabel: vendorLabel(vendor), event, count: log.filter((e) => e.vendor === vendor && e.event === event).length };
    }
  );
  if (!named.length) {
    record('event_names', 'not_applicable', 'No Meta or GA4 events with resolvable names were captured.', [], { nonStandard: [] });
  } else if (nonStandard.length) {
    const i = makeIssue(
      'low',
      `${nonStandard.length} event name(s) are not recognised by the platforms`,
      `Names like ${nonStandard.slice(0, 3).map((n) => `"${n.event}"`).join(', ')} are custom. They still record, but they cannot drive the platforms' built-in conversion optimisation or standard reporting.`,
      nonStandard.slice(0, 8).map((n) => ({ label: n.vendorLabel, value: `${n.event} (${n.count}x)` }))
    );
    issues.push(i);
    record('event_names', 'fail', `${nonStandard.length} of ${new Set(named.map((e) => e.event)).size} named events are non-standard.`, [i.id], {
      nonStandard,
    });
  } else {
    record('event_names', 'pass', 'Every Meta and GA4 event name is in the platform\'s standard vocabulary.', [], { nonStandard: [] });
  }

  // --- 8. legacy ----------------------------------------------------------
  const uaHits = log.filter((e) => e.vendor === 'ua');
  if (uaHits.length) {
    const i = makeIssue(
      'medium',
      `Universal Analytics is still running (${uaHits.length} hits)`,
      'Universal Analytics stopped processing data in July 2024. These requests leave the browser and go nowhere. Anyone still reading a UA report is reading a dead dashboard.',
      uaHits.slice(0, 3).map((e, n) => ({ label: `hit ${n + 1}`, value: e.urlAbridged }))
    );
    issues.push(i);
    record('no_legacy', 'fail', `${uaHits.length} Universal Analytics hits observed.`, [i.id]);
  } else {
    record('no_legacy', 'pass', 'No traffic to deprecated Universal Analytics endpoints.');
  }

  return { checks, issues, dupGroups, failList, accountInventory, nonStandard };
}

// ===========================================================================
// Scoring
// ===========================================================================

function score(issues) {
  const high = issues.filter((i) => i.severity === 'high').length;
  const medium = issues.filter((i) => i.severity === 'medium').length;
  const low = issues.filter((i) => i.severity === 'low').length;

  let s = 100 - high * 25 - medium * 10 - low * 3;
  s = Math.max(0, Math.min(100, s));

  let verdict;
  if (high > 0) verdict = 'NOT_READY';
  else if (s < 80) verdict = 'READY_WITH_FIXES';
  else verdict = 'READY';

  return { readinessScore: s, verdict, counts: { high, medium, low } };
}

function buildSummary(session, det) {
  const log = session.networkLog;
  const vendorsDetected = [...new Set(log.map((e) => e.vendor))].map((id) => ({
    id,
    label: vendorLabel(id),
    family: (log.find((e) => e.vendor === id) || {}).family,
    requests: log.filter((e) => e.vendor === id).length,
    events: [...new Set(log.filter((e) => e.vendor === id && e.event).map((e) => e.event))],
    accountIds: [...new Set(log.filter((e) => e.vendor === id && e.accountId).map((e) => e.accountId))],
    failures: log.filter((e) => e.vendor === id && (e.failure || (e.status !== null && e.status >= 400))).length,
  })).sort((a, b) => b.requests - a.requests);

  return {
    totalTrackingRequests: log.length,
    parsedEvents: log.filter((e) => e.event).length,
    distinctEventNames: new Set(log.filter((e) => e.event).map((e) => e.event)).size,
    conversionEvents: log.filter((e) => e.isConversion).length,
    failedRequests: log.filter((e) => e.failure || (e.status !== null && e.status >= 400)).length,
    duplicateGroups: det.dupGroups.length,
    vendorCount: vendorsDetected.length,
    consoleErrors: session.consoleErrors.length,
    vendorsDetected,
  };
}

// ===========================================================================
// Orchestration: observation -> fact -> judgement -> decision
// Each stage consumes only the stage before it.
// ===========================================================================

async function performAudit(targetUrl, options = {}) {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  // STAGE 1: observation
  const session = await runBrowserSession(targetUrl, options);

  // STAGE 2: fact
  const det = runDeterministicChecks(session, targetUrl);
  const summary = buildSummary(session, det);
  const scored = score(det.issues);

  // STAGE 3: judgement. The model receives facts already established above.
  // It never decides what fired.
  const ai = await analyzeTelemetry({
    targetUrl,
    navigation: session.navigation,
    interaction: session.interaction,
    summary,
    networkLog: session.networkLog,
    dupGroups: det.dupGroups,
    failList: det.failList,
    nonStandard: det.nonStandard,
    deterministicIssueTitles: det.issues.map((i) => i.title),
  });

  const aiIssues = (ai.issues || []).map((i, n) => ({
    id: `ai-${n + 1}`,
    source: 'ai',
    severity: (i.severity || 'medium').toLowerCase(),
    title: i.title,
    detail: i.business_risk,
    category: i.category,
    businessRisk: i.business_risk,
    technicalEvidence: i.technical_evidence,
    recommendedFix: i.recommended_fix,
    affectedMetric: i.affected_metric,
  }));

  const finishedAt = new Date().toISOString();

  const report = {
    targetUrl,
    startedAt,
    finishedAt,
    durationMs: Date.now() - t0,
    verdict: scored.verdict,
    readinessScore: scored.readinessScore,
    counts: scored.counts,
    navigation: session.navigation,
    interaction: session.interaction,
    phaseTimeline: session.phaseTimeline,
    summary,
    checks: det.checks,
    checkDefinitions: CHECK_DEFINITIONS,
    issues: det.issues,
    aiIssues,
    aiAvailable: ai.aiAvailable,
    aiError: ai.error || null,
    aiModel: ai.model || null,
    headline: ai.headline || defaultHeadline(scored),
    executiveSummary: ai.executive_summary || null,
    eventTaxonomy: ai.event_taxonomy || [],
    recommendedNextSteps: ai.recommended_next_steps || [],
    consoleErrors: session.consoleErrors,
    networkLog: session.networkLog.map((e) => ({ ...e, params: undefined })),
  };

  // STAGE 4: decision -- persisted.
  const saved = await logAuditRun(report);
  report.id = saved.id;

  return report;
}

function defaultHeadline(scored) {
  if (scored.verdict === 'NOT_READY') return "Don't spend yet.";
  if (scored.verdict === 'READY_WITH_FIXES') return 'Spend, but fix these first.';
  return 'Good to go.';
}

// ===========================================================================
// API
// ===========================================================================

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    defaultTargetUrl: DEFAULT_TARGET_URL,
    integrations: {
      playwright: true,
      gemini: Boolean(process.env.GEMINI_API_KEY),
      supabase: supabaseStatus(),
    },
  });
});

app.post('/api/audit', async (req, res) => {
  const url = (req.body && req.body.url) || DEFAULT_TARGET_URL;
  const interactions = req.body && req.body.interactions !== undefined ? req.body.interactions : true;

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }

  try {
    const report = await performAudit(url, { interactions });
    res.json(report);
  } catch (err) {
    console.error('[audit] failed:', err);
    res.status(500).json({ error: String(err.message) });
  }
});

app.get('/api/audits', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  try {
    res.json(await listAuditRuns(limit));
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

app.get('/api/audits/:id', async (req, res) => {
  try {
    const run = await getAuditRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Not found.' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Pre-flight auditor API on http://localhost:${PORT}`);
    console.log(`Default target: ${DEFAULT_TARGET_URL}`);
  });
}

module.exports = app;

Object.assign(module.exports, {
  app,
  performAudit,
  runBrowserSession,
  runDeterministicChecks,
  score,
  CHECK_DEFINITIONS,
  abridgeUrl,
  DEFAULT_TARGET_URL,
});
