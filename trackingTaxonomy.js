'use strict';

/**
 * trackingTaxonomy.js
 *
 * The deterministic vocabulary of the auditor.
 *
 * Everything in this file is a documented fact about a published ad-tech API,
 * not a judgement call. `facebook.com/tr?ev=Purchase` IS a Meta Pixel purchase
 * event. Routing that question through a language model would make a settled
 * fact probabilistic, and an auditor whose vendor list wobbles between runs
 * cannot be used to authorise ad spend. It is also ~400 classifications per
 * audit: a regex costs nothing, an API call does.
 *
 * The LLM never sees this layer's questions -- only its answers.
 */

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

/** @type {{id:string,label:string,family:string,match:(url:string)=>boolean}[]} */
const VENDORS = [
  {
    id: 'gtm',
    label: 'Google Tag Manager',
    family: 'tag_management',
    match: (u) =>
      /googletagmanager\.com\/(gtm\.js|gtag\/js|ns\.html)/.test(u) ||
      /googletagmanager\.com\/a\b/.test(u),
  },
  {
    id: 'ga4',
    label: 'Google Analytics 4',
    family: 'analytics',
    match: (u) =>
      /(google-analytics\.com|analytics\.google\.com|googletagmanager\.com)\/(g|mp)\/collect/.test(u),
  },
  {
    id: 'ua',
    label: 'Universal Analytics (deprecated)',
    family: 'analytics',
    // Legacy /collect, explicitly NOT the GA4 /g/collect endpoint.
    match: (u) =>
      /google-analytics\.com\/(r\/)?collect/.test(u) && !/\/(g|mp)\/collect/.test(u),
  },
  {
    id: 'google_ads',
    label: 'Google Ads',
    family: 'ad_platform',
    match: (u) =>
      /googleadservices\.com\/(pagead\/)?conversion/.test(u) ||
      /(www\.)?googleadservices\.com/.test(u) ||
      /doubleclick\.net/.test(u) ||
      // Google's own remarketing + conversion endpoints on google.<tld>.
      /google\.[a-z.]{2,6}\/(rmkt|pagead)\//.test(u),
  },
  {
    id: 'meta_pixel',
    label: 'Meta Pixel',
    family: 'ad_platform',
    match: (u) =>
      /facebook\.com\/tr\b/.test(u) ||
      /connect\.facebook\.net\/.*fbevents\.js/.test(u) ||
      /facebook\.com\/privacy_sandbox\/pixel/.test(u),
  },
  {
    id: 'tiktok',
    label: 'TikTok Pixel',
    family: 'ad_platform',
    match: (u) => /analytics\.tiktok\.com/.test(u) || /tiktokcdn\.com\/.*pixel/.test(u),
  },
  {
    id: 'pinterest',
    label: 'Pinterest Tag',
    family: 'ad_platform',
    match: (u) => /ct\.pinterest\.com/.test(u) || /pinimg\.com\/ct\//.test(u),
  },
  {
    id: 'snap',
    label: 'Snap Pixel',
    family: 'ad_platform',
    match: (u) => /tr(\d+)?\.snapchat\.com/.test(u) || /sc-static\.net\/scevent/.test(u),
  },
  {
    id: 'bing',
    label: 'Microsoft Advertising (UET)',
    family: 'ad_platform',
    match: (u) => /bat\.bing\.com/.test(u),
  },
  {
    id: 'criteo',
    label: 'Criteo',
    family: 'ad_platform',
    match: (u) => /criteo\.(com|net)/.test(u),
  },
  {
    id: 'klaviyo',
    label: 'Klaviyo',
    family: 'crm',
    match: (u) => /klaviyo\.com/.test(u) || /a\.klaviyo\.com\/api/.test(u),
  },
  {
    id: 'clarity',
    label: 'Microsoft Clarity',
    family: 'session_recording',
    match: (u) => /clarity\.ms/.test(u),
  },
  {
    id: 'hotjar',
    label: 'Hotjar',
    family: 'session_recording',
    match: (u) => /hotjar\.(com|io)/.test(u),
  },
  {
    id: 'shopify',
    label: 'Shopify Analytics',
    family: 'platform_analytics',
    match: (u) => /monorail-edge\.shopifysvc\.com/.test(u) || /shopify\.com\/.*\/events/.test(u),
  },
  {
    id: 'segment',
    label: 'Segment',
    family: 'cdp',
    match: (u) => /api\.segment\.io/.test(u) || /cdn\.segment\.com/.test(u),
  },
];

/**
 * The baseline for a pass. A landing page without GA4 and a Meta Pixel cannot
 * measure or retarget the traffic you are about to buy.
 */
const REQUIRED_VENDOR_IDS = ['ga4', 'meta_pixel'];

/** Ad platforms that should receive a conversion signal on add-to-cart. */
const AD_PLATFORM_IDS = [
  'meta_pixel',
  'google_ads',
  'tiktok',
  'pinterest',
  'snap',
  'bing',
  'criteo',
];

// ---------------------------------------------------------------------------
// Event vocabularies (published, versioned, documented)
// ---------------------------------------------------------------------------

/** Meta's standard event vocabulary. Anything else is a custom event. */
const META_STANDARD_EVENTS = new Set([
  'AddPaymentInfo',
  'AddToCart',
  'AddToWishlist',
  'CompleteRegistration',
  'Contact',
  'CustomizeProduct',
  'Donate',
  'FindLocation',
  'InitiateCheckout',
  'Lead',
  'PageView',
  'Purchase',
  'Schedule',
  'Search',
  'StartTrial',
  'SubmitApplication',
  'Subscribe',
  'ViewContent',
]);

/** GA4 recommended + automatically collected events. */
const GA4_STANDARD_EVENTS = new Set([
  'page_view',
  'session_start',
  'first_visit',
  'user_engagement',
  'scroll',
  'click',
  'view_search_results',
  'view_item',
  'view_item_list',
  'select_item',
  'view_promotion',
  'select_promotion',
  'add_to_cart',
  'remove_from_cart',
  'view_cart',
  'begin_checkout',
  'add_shipping_info',
  'add_payment_info',
  'purchase',
  'refund',
  'add_to_wishlist',
  'generate_lead',
  'sign_up',
  'login',
  'search',
]);

/** Regexes for commercial intent -- the events that actually cost or make money. */
const CONVERSION_EVENT_PATTERNS = [
  /^add[_\-\s]?to[_\-\s]?cart$/i,
  /^AddToCart$/,
  /add[_\-]?to[_\-]?bag/i,
  /\batc\b/i,
  /^begin[_\-]?checkout$/i,
  /^InitiateCheckout$/,
  /checkout/i,
  /^purchase$/i,
  /^Purchase$/,
  /\border[_\-]?complete/i,
  /^generate[_\-]?lead$/i,
  /^Lead$/,
  /^sign[_\-]?up$/i,
  /^CompleteRegistration$/,
  /^Subscribe$/i,
  /^subscribe/i,
  /^conversion$/i,
];

/**
 * Params that change on every single hit. They must be stripped before
 * fingerprinting, otherwise no two beacons ever look alike and the duplicate
 * check silently never fires.
 */
const VOLATILE_PARAMS = new Set([
  '_p', '_s', 'seq', 'sid', 'sct', '_et', 'ts', 'z', 'rnd', 'random',
  'cache', 'cb', 'eid', 'event_id', 'eventID', 'rl', 'if', 'ler', 'tfd',
  'dl', 'dr', '_z', 'v', 'jsonp', 'callback', '_fbp_ts',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} url
 * @returns {{id:string,label:string,family:string}|null}
 */
function classifyVendor(url) {
  if (!url) return null;
  for (const v of VENDORS) {
    let hit = false;
    try {
      hit = v.match(url);
    } catch {
      hit = false;
    }
    if (hit) return { id: v.id, label: v.label, family: v.family };
  }
  return null;
}

/** @param {string} name */
function isConversionEvent(name) {
  if (!name) return false;
  return CONVERSION_EVENT_PATTERNS.some((re) => re.test(name));
}

/**
 * Set membership against a published vocabulary.
 * Returns null (not false) where the vendor publishes no fixed vocabulary --
 * "not applicable" is a different answer from "no".
 *
 * @param {string} vendorId
 * @param {string} eventName
 * @returns {boolean|null}
 */
function isStandardEvent(vendorId, eventName) {
  if (!eventName) return null;
  if (vendorId === 'meta_pixel') return META_STANDARD_EVENTS.has(eventName);
  if (vendorId === 'ga4' || vendorId === 'ua') return GA4_STANDARD_EVENTS.has(eventName);
  return null;
}

/** @param {string} vendorId */
function vendorLabel(vendorId) {
  const v = VENDORS.find((x) => x.id === vendorId);
  return v ? v.label : vendorId;
}

module.exports = {
  VENDORS,
  REQUIRED_VENDOR_IDS,
  AD_PLATFORM_IDS,
  META_STANDARD_EVENTS,
  GA4_STANDARD_EVENTS,
  CONVERSION_EVENT_PATTERNS,
  VOLATILE_PARAMS,
  classifyVendor,
  isConversionEvent,
  isStandardEvent,
  vendorLabel,
};
