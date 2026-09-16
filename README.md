# Landing Page Pre-Flight Auditor

Drives a real browser at a landing page, watches every analytics and ad-tech request it makes, checks that telemetry against fixed rules, and has an LLM translate the findings into business risk for whoever controls the ad budget.

It answers one question: **is this page technically safe to put ad spend behind?** That's a go/no-go decision, not a metrics dashboard.

```
Playwright session  →  deterministic checks  →  LLM interpretation  →  report
   (observation)          (fact)                  (judgement)          (decision)
```

Each stage consumes only the stage before it. The model never decides what fired — it receives facts already established by code and only interprets what they mean commercially. See [NOTE.md](NOTE.md) for why, and for the limitations.

---

## Quick start

```bash
npm install
npx playwright install chromium
cp .env.example .env     # optional — see below
npm start                # API on :3001
```

In a second terminal:

```bash
npm --prefix client install
npm --prefix client run dev    # UI on :5173
```

Open http://localhost:5173.

**No API keys are required.** With none configured, the browser session and all eight deterministic checks still run in full; the report is produced measured-only and says so, visibly, at the top. Runs are kept in memory instead of Supabase.

### Generate a sample report to disk

```bash
npm run export                                   # default Neeman's PDP
node scripts/export-report.js https://example.com/page
```

Writes `sample-report/audit-report.md` (human-readable) and `sample-report/audit-raw.json` (everything).

---

## Configuration

All optional. See [.env.example](.env.example).

| Variable | Effect if unset |
|---|---|
| `GEMINI_API_KEY` | Stage 3 is skipped; report is deterministic-only with a visible banner |
| `GEMINI_MODEL` | Defaults to `gemini-3.6-flash`; on a 404 the service lists available models and picks a current one |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Runs logged to an in-memory Map for the process lifetime |
| `DEFAULT_TARGET_URL` | Defaults to a live Neeman's product page |
| `PORT` | 3001 |

For Supabase, apply [`schema.sql`](schema.sql) first. The server writes with the service-role key and bypasses RLS; the policies in that file govern client-side reads by authenticated users.

---

## The eight checks

Each check ships its exact rule (`method`) in the API payload, and the UI renders it — so a reader can audit the auditor.

| Check | Rule |
|---|---|
| The page actually loads | Navigation is HTTP 2xx and the final URL is the same host as requested |
| Your tags are installed and firing | GA4 and Meta Pixel each produced ≥1 request |
| Nothing fires twice | SHA-1 over vendor + event + payload, volatile params stripped; a shared fingerprint is a genuine double-fire |
| The data actually arrives | Any 4xx/5xx **or transport-level failure**, grouped by vendor and status |
| One account per platform | Each vendor resolves to exactly one distinct account ID |
| Add to cart gets tracked | A conversion-intent event reached each installed ad platform during the add-to-cart phase |
| Event names make sense | Set membership against the published Meta and GA4 vocabularies |
| Nothing dead is still running | Any hit to a Universal Analytics endpoint |

Each records `pass` / `fail` / `not_applicable`. Passing checks are reported too: a checklist showing only problems can't distinguish *checked and fine* from *never checked*, which matters when the output authorises spend.

`not_applicable` is a deliberate third state. If no add-to-cart button can be found — or the button is clicked but the cart never changes — the check reports that it wasn't tested, rather than guessing at a misleading pass or fail.

**Scoring.** Start at 100, subtract 25/10/3 per serious/middling/minor finding. Any serious finding → `NOT_READY`. Score under 80 → `READY_WITH_FIXES`. Otherwise `READY`.

---

## API

| Endpoint | |
|---|---|
| `POST /api/audit` | `{ url, interactions }` → full report |
| `GET /api/audits?limit=` | Recent runs |
| `GET /api/audits/:id` | One run |
| `GET /api/health` | Which integrations are configured |

---

## Files

| File | Responsibility |
|---|---|
| `server.js` | Express API, Playwright session, network interception, deterministic checks, scoring |
| `trackingTaxonomy.js` | Vendor URL patterns, standard event vocabularies, volatile-param list |
| `geminiService.js` | Prompt construction, schema-constrained Gemini call, retry, fallback |
| `supabaseClient.js` | Logs every run; degrades to in-memory when unconfigured |
| `schema.sql` | Supabase table, indexes, RLS policies |
| `scripts/export-report.js` | Runs an audit and writes Markdown + JSON to `sample-report/` |
| `client/src/App.jsx` | URL input, progress, run history |
| `client/src/Dashboard.jsx` | Report shell: shared masthead, then the audience split |
| `client/src/BusinessView.jsx` | The plain-English read, with charts |
| `client/src/TechnicalView.jsx` | Rules, evidence, account IDs, full network log |
| `client/src/charts.jsx` | Inline-SVG chart primitives (no charting dependency) |

---

## Two reports, one audit

The same audit is presented twice, because the two audiences need different things and one combined report overwhelms both.

**For the business** (the default tab) answers "can we spend?" without requiring an engineer. It leads with a readiness dial and four headline numbers, then a signal matrix — *for each platform you pay, can it actually see a sale?* — a delivery donut, a per-tool volume chart, the problems in plain English, and an ordered list of what to do next. No vendor IDs, no status codes, no CSS selectors. Platforms are named the way a marketer buys them: "Facebook & Instagram", not "Meta Pixel".

**For the engineer** is the full inspection: every check with its exact rule, every finding with its evidence and provenance stamp, the tag inventory with account IDs, duplicates, and the complete second-by-second event log.

The provenance split (MEASURED vs AI) lives in the technical view, where it belongs — a budget holder needs the finding, an engineer needs to know which layer produced it.

### Theme

The interface follows neemans.com: Bebas Neue headings in uppercase with `0.18em` tracking, Roboto for text, Roboto Mono for anything machine-produced, white and `#F3F2F2` surfaces, `#1C1C1C` ink, `#B78742` gold accent, and fully rounded pill controls. These values were sampled from the live site's computed styles rather than eyeballed.

---

## Three implementation details that matter

**The `requestfailed` listener is not optional.** Requests that die at the transport layer (`ERR_CONNECTION_TIMED_OUT`, `ERR_ABORTED`) never produce a `response` event. On the live Neeman's page these are consistently the highest-severity findings; a response listener alone misses them entirely.

**Interaction phases are stamped onto every request.** Because each beacon carries the phase it fired during and a ms offset, the report can say *"the add-to-cart click produced no conversion event"* rather than the much weaker *"AddToCart is missing"* — it can prove when a beacon fired relative to the interaction that should have caused it.

**Volatile params must be stripped before fingerprinting.** Params like `_p`, `seq`, `_et` and `rnd` change on every hit. Leave them in and no two beacons ever match, so the duplicate check silently reports "nothing fires twice" forever — a false pass, and the worst failure mode this tool has.

---

## What a real run finds

Against the live Neeman's PDP (2026-09-16): 8 vendors, 161 tracking requests, 74 named events, GA4 fragmented across 3 measurement IDs, custom names like `checkout_gokwik` and `scroll_depth`, a Criteo transport failure, and add-to-cart reaching Meta and Google but not Snap or Criteo. **Verdict: NOT_READY.**

Results vary between runs of the same URL — that's real variance in the site, and it's the most important limitation of the tool. [NOTE.md](NOTE.md) covers it.
