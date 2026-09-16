# Design note

## What this is

A tool that answers one question: **is this landing page technically safe to put ad spend behind?**

Not a metrics dashboard. A go/no-go decision, with the evidence attached.

The distinction matters because it sets the bar for everything else. A dashboard can afford to be approximately right — you look at it, you form an impression. A pre-flight check authorises money. If it says "fine" and it is wrong, someone spends a budget into a page that cannot measure the spend. That asymmetry is why the architecture below looks the way it does.

## Architecture

```
Playwright session  →  deterministic checks  →  LLM interpretation  →  report
   (observation)          (fact)                  (judgement)          (decision)
```

Each stage consumes only the stage before it.

**Observation** is a real Chromium session, not an HTML parse. This is the whole point. A `<script>` tag in the DOM proves a tag was *installed*; it proves nothing about whether a beacon actually left the machine, what was in it, or whether anything answered. Only a browser driving the real page under real timing tells you that. The session handles consent, scrolls in viewport-sized steps, selects a size, clicks add to cart, and stamps every intercepted request with the interaction phase it fired during.

**Fact** is eight fixed rules over the captured telemetry. Same telemetry in, same findings out, every time.

**Judgement** is Gemini, handed facts that are already settled, asked only to translate them into money.

**Decision** is the report, with every finding stamped with which layer produced it.

### Why the split is enforced rather than merely intended

The model is never asked a question that has a documented answer. `facebook.com/tr?ev=Purchase` is a Meta Pixel purchase event — that is a fact about a published API. Routing it through a model would make a settled fact probabilistic, and an auditor whose vendor list wobbles between runs cannot authorise spend.

So `isConversion` and `isStandardEvent` arrive at the prompt as **pre-computed booleans**. The model gets the answer to classification, never the question. It cannot decide that something fired, because it never sees the raw network log — only an 8-field projection of events the deterministic layer already identified and classified.

It is also cheap. Classification runs ~400 times per audit. A regex is free; an API call is not.

### What the LLM genuinely adds

Three things code cannot do:

1. **Translating a fact into a consequence.** "GA4 returned a transport error on 1 of 161 requests" is a fact. "Your page-view count is quietly under-reporting, so every cost-per-visitor number you'd judge this campaign by is slightly too high" is the thing the budget holder needs. That translation is genuinely linguistic and genuinely not rule-shaped.
2. **Reading custom event names.** The page fires `kp_atc`, `checkout_gokwik`, `Neemans_Opti_Tracking`, `scroll_depth`. A rule can tell you these are not standard. Only a model can guess that `kp_atc` is probably a Klaviyo/GoKwik add-to-cart and say so in English.
3. **Cross-event reasoning.** Ordering, timing relative to interaction, patterns spanning several vendors — things that would need a new hand-written rule each time.

The prompt explicitly instructs it to *prefer* adding findings the deterministic layer could not reach over restating ones it already made, and it receives the deterministic issues **title-only** — enough to avoid duplication, not enough for our phrasing to anchor its analysis.

## Assumptions

- The audited page is a Shopify-style e-commerce PDP. The add-to-cart step and the `/cart.js` verification are Shopify-shaped. The rest of the tool is platform-agnostic.
- A session from India (`en-IN`, `Asia/Kolkata`) is representative, because it is what a real Neeman's shopper triggers. A US session would see different currency and possibly different regional tags.
- Headless Chromium is treated as representative of a real browser. Some vendors behave differently under headless detection; this is not accounted for.
- GA4 and Meta Pixel are the baseline for a pass. A page missing either cannot measure or retarget bought traffic.

## Trade-offs

**Hardcoded vendor taxonomy vs. model-identified vendors.** Hardcoded. Determinism and cost, as above. The cost is the blind spot described below.

**Single fingerprint rule for duplicates vs. per-vendor rules.** One rule: SHA-1 over vendor + event + payload with volatile params stripped. Simpler and defensible, but it depends entirely on `VOLATILE_PARAMS` being right. Miss a rotating param and no two beacons ever match, and the check silently reports "no duplicates" forever — a false pass, the worst failure mode a tool like this has. This is why the list is explicit and exported rather than inlined.

**Reporting passes, not just failures.** A checklist that shows only problems cannot distinguish "checked and fine" from "never checked". When the output authorises spend, that difference matters more than the brevity does.

**An honest third state.** When no add-to-cart button can be found, or when the button is clicked but the cart never changes, the check is recorded `not_applicable` — never `pass` or `fail`. Both binaries would be lies. This came directly out of testing: the first working version clicked a button in a "you may also like" carousel, reported a clean click, and the cart never moved. The check would have happily marked add-to-cart tracking as failed when in truth it was never exercised. The tool now verifies the cart line count actually changed before it will judge the tracking at all.

**Failing loudly on the LLM, not silently.** If Gemini is unavailable after four retries, the report is produced deterministic-only with `aiAvailable: false` and a visible banner. A tracking auditor must not become unusable because a third-party API had a bad minute.

## Limitations

Stated plainly, because this is the most valuable part of the document.

### 1. Single-run sampling is the weakest point in the whole design

Across repeated runs of the same URL during development, results moved:

- Add-to-cart tracking both **passed and failed** on different runs.
- Meta Pixel resolved to **1 account ID on one run and 2 on another**.
- Captured request volume ranged from ~105 to ~161.

This is real variance in the site under different timing and consent conditions, not auditor flakiness — the deterministic layer is deterministic *given telemetry*, but the telemetry itself is a sample.

**So a single audit is evidence, not proof.** Three runs, with findings marked "consistent" vs. "intermittent", would be materially more trustworthy and is the single highest-value next change.

And intermittent conversion tracking is arguably *worse* than a consistent failure: a consistent failure shows up as a zero and someone investigates. An intermittent one shows up as a plausible-looking smaller number, and is invisible in aggregate reporting.

### 2. A vendor not in the table is invisible

The taxonomy covers ~15 vendors. Anything else — a regional ad network, a newer CDP, a bespoke first-party endpoint — is silently dropped in `page.on('request')` and never appears anywhere in the report. The report does not currently distinguish "no other vendors" from "other vendors not recognised", which is exactly the "checked and fine vs. never checked" problem the checklist design elsewhere tries hard to avoid.

**Mitigation worth naming:** collect unrecognised third-party beacon hosts and pass them to the LLM, asking it to identify likely ad-tech. Deterministic where the answer is known; model-based where it genuinely isn't. That is the right division of labour, and it is the natural place for the model to earn its keep.

### 3. Selector heuristics are the least portable part

The consent, variant and add-to-cart selector lists are the only place the tool uses heuristics rather than fixed rules, and they are the only part tuned to a specific site. Neeman's needed a two-stage flow — click add to cart, then choose a size in the popup that appears, then confirm — plus a carousel exclusion so the click doesn't add a *different* product. Another theme will need another list. Everything downstream of the click is portable; the click itself is not.

### 4. Pseudonymous identifiers reach the prompt

Failed-request handling passes vendor, failure code and count. Earlier iterations passed full failed-request URLs, which carried `cid` and `first_party_id` pseudonymous identifiers and accounted for roughly half a ~37KB payload. That is harmless for a synthetic session against a public page, but it would need stripping before this were pointed at anything reflecting real user sessions. Truncating also roughly halves prompt cost with no analytical loss, since the failure *code* carries the signal, not the query string.

### 5. Other honest gaps

- **No consent-mode reasoning.** The tool grants consent and audits the granted state. It does not audit the denied state, which is where a lot of real-world tracking failures live.
- **Desktop only.** Most paid social traffic is mobile, and mobile tag setups frequently differ.
- **No cross-page journey.** It audits one page. Purchase tracking lives on a thank-you page it never visits.
- **Duplicate detection cannot see intent.** Two identical beacons 50ms apart are almost certainly a bug; two 30 seconds apart might be legitimate. The rule treats both the same.

## What a good run against Neeman's actually found

Measured on the live page, 2026-09-16:

- **8 vendors**: GTM, GA4, Meta Pixel, Google Ads, Snap, Criteo, Clarity, Hotjar
- **161 tracking requests**, 74 carrying a readable event name, 14 distinct names
- **GA4 fragmented across 3 measurement IDs** (`G-3042L5GP9T`, `G-VDE0ZFZ4LP`, `G-5RYZDGXEFH`); Google Ads across 3 accounts; Clarity and Snap across 2 each
- **Custom event names** including `checkout_gokwik`, `checkout_razorpay`, `scroll_depth`, `Neemans_Opti_Tracking`, `kp_visitors`, `kp_engaged_visitors`
- **A Criteo transport failure** (`net::ERR_CONNECTION_TIMED_OUT`) — the class of finding that a response-listener-only implementation misses entirely, because a request that dies in transport never produces a `response` event
- **Add to cart confirmed** (cart 0 → 1), reaching Meta (`AddToCart`), GA4 and Google Ads (`add_to_cart`) — but **not Snap or Criteo**, both of which are live on the page
- **Verdict: NOT_READY**
