# Landing Page Pre-Flight Audit

**Do not put ad spend behind this page yet.**

| | |
|---|---|
| Verdict | **HOLD — do not spend yet** |
| Readiness | **0 / 100** |
| Page | `https://neemans.com/products/curve-knit-slip-ons-for-men-ivory` |
| Run at | 2026-09-16T08:05:02.647Z |
| Took | 92.0s |
| Findings | 7 serious · 5 middling · 1 minor |
| Interpretation | AI analysis by gemini-3.6-flash |

---

## 01 · What this means for your budget

Your advertising tracking is severely broken and will waste your budget. Google Ads is recording multiple fake sales before a customer even clicks anything on the page. Meanwhile, major ad channels like Meta, Snap, and Criteo receive no data when someone adds a product to their cart.

---

## 02 · Two kinds of finding

Every finding in this report is stamped with where it came from.

- **MEASURED** — a fixed rule applied to what the browser actually observed. Same telemetry in, same finding out, every time. No model involved.
- **AI** — a language model reading facts the measured layer already established, and judging what they mean commercially. It never decides what fired.

---

## 03 · The checklist

| | Check | Result | Detail |
|---|---|---|---|
| PASS | The page actually loads | pass | Responded HTTP 200 and stayed on neemans.com. |
| PASS | Your tags are installed and firing | pass | Both required tags fired. Google Analytics 4: 13 requests; Meta Pixel: 8 requests. |
| FAIL | Nothing fires twice | fail | 7 event(s) fired more than once. |
| PASS | The data actually arrives | pass | All 130 tracking requests were accepted. |
| FAIL | One account per platform | fail | 3 platform(s) split across multiple accounts. |
| FAIL | Add to cart gets tracked | fail | Meta Pixel, Snap Pixel, Criteo received no conversion event after the click. |
| FAIL | Event names make sense to the platforms | fail | 6 of 10 named events are non-standard. |
| PASS | Nothing dead is still running | pass | No traffic to deprecated Universal Analytics endpoints. |

<details><summary>How each check is decided</summary>

**The page actually loads** — *Will someone who clicks the ad reach the page at all?*

> The navigation response is an HTTP 2xx, and the URL the browser ended on has the same hostname as the one requested (ignoring a leading "www.").

**Your tags are installed and firing** — *Are Google Analytics and the Meta Pixel actually on this page?*

> Google Analytics 4 and Meta Pixel must each have sent at least one network request during the session.

**Nothing fires twice** — *Is the page counting the same thing more than once?*

> A SHA-1 fingerprint of vendor + event name + payload, with every param that changes on every hit removed first. Two requests sharing a fingerprint are the same beacon sent twice, not two legitimate events.

**The data actually arrives** — *Does the data reach the platforms, or does it die on the way?*

> Any tracking request answered with a 4xx or 5xx, plus any request that failed at the transport layer and never got a response at all. Grouped by vendor and status.

**One account per platform** — *Is the data all landing in the same account, or split across several?*

> For each vendor, count the distinct account / property / pixel IDs seen. More than one means the traffic is being split.

**Add to cart gets tracked** — *When someone adds to cart, do the ad platforms find out?*

> During the add-to-cart phase specifically, each installed ad platform must have received at least one event matching a commercial-intent pattern. If no add-to-cart button could be found, this is recorded as not applicable rather than pass or fail.

**Event names make sense to the platforms** — *Will the ad platforms understand the events they are being sent?*

> Each Meta and GA4 event name is checked for membership in that platform's published standard event vocabulary. Names outside it are custom and cannot drive built-in optimisation.

**Nothing dead is still running** — *Is the page still sending data to a system that was switched off?*

> Any hit to the Universal Analytics /collect endpoint. Universal Analytics stopped processing data in July 2024; these requests go nowhere.

</details>

---

## 04 · What to do next

1. Pause paid ad spend directed to this page until tag triggers are fixed.
2. Remove automated conversion triggers that fire during initial page load.
3. Configure Meta, Snap, and Criteo pixels to capture add-to-cart events.
4. Deduplicate Google Ads tags to fire only once per user click.
5. Remove duplicate GA4 and Snap account IDs from Tag Manager.

---

## 05 · Findings

### [MEASURED] Google Ads sent "conversion" 2 times (first at 13.1s, during load)

*serious*

This is a conversion event. Counting it 2 times inflates reported sales and teaches the ad platform to bid on the wrong signal.

- `event`: Google Ads / conversion
- `fired at (ms)`: 13059, 13733
- `phases`: load

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads sent "conversion" 2 times (first at 17.3s, during load)

*serious*

This is a conversion event. Counting it 2 times inflates reported sales and teaches the ad platform to bid on the wrong signal.

- `event`: Google Ads / conversion
- `fired at (ms)`: 17300, 17432
- `phases`: load

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads sent "add_to_cart" 2 times (first at 56.7s, during add_to_cart)

*serious*

This is a conversion event. Counting it 2 times inflates reported sales and teaches the ad platform to bid on the wrong signal.

- `event`: Google Ads / add_to_cart
- `fired at (ms)`: 56656, 57278
- `phases`: add_to_cart

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads sent "conversion" 2 times (first at 56.7s, during add_to_cart)

*serious*

This is a conversion event. Counting it 2 times inflates reported sales and teaches the ad platform to bid on the wrong signal.

- `event`: Google Ads / conversion
- `fired at (ms)`: 56674, 57280
- `phases`: add_to_cart

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] The add-to-cart click produced no conversion event for Meta Pixel

*serious*

The button was clicked (form[action*="/cart/add"] button[type="submit"] (normal click) + variant chooser) and Meta Pixel was live on the page, but no commercial-intent event reached it in the 46 requests that followed. This platform cannot optimise towards or retarget people who add to cart.

- `click strategy`: form[action*="/cart/add"] button[type="submit"] (normal click) + variant chooser
- `Meta Pixel events after the click`: none

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] The add-to-cart click produced no conversion event for Snap Pixel

*serious*

The button was clicked (form[action*="/cart/add"] button[type="submit"] (normal click) + variant chooser) and Snap Pixel was live on the page, but no commercial-intent event reached it in the 46 requests that followed. This platform cannot optimise towards or retarget people who add to cart.

- `click strategy`: form[action*="/cart/add"] button[type="submit"] (normal click) + variant chooser
- `Snap Pixel events after the click`: none

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] The add-to-cart click produced no conversion event for Criteo

*serious*

The button was clicked (form[action*="/cart/add"] button[type="submit"] (normal click) + variant chooser) and Criteo was live on the page, but no commercial-intent event reached it in the 46 requests that followed. This platform cannot optimise towards or retarget people who add to cart.

- `click strategy`: form[action*="/cart/add"] button[type="submit"] (normal click) + variant chooser
- `Criteo events after the click`: none

> How this was determined: a fixed rule over observed network traffic.

### [AI] Google Ads counts non-existent sales as soon as the page opens

*serious* · affects **Google Ads reported ROAS and cost per acquisition**

Automated ad bidding algorithms will see high conversion numbers that never happened, driving spend toward useless traffic that just opens the link.

**Evidence.** Google Ads received 8 separate conversion events between 11.7 seconds and 17.4 seconds during initial page load, long before any user click occurred.

**Fix.** Remove conversion tags assigned to page-load triggers and restrict conversion firing strictly to confirmed purchases.

> How this was determined: a model judged severity and business impact from measured telemetry. It did not decide what fired.

### [AI] Meta, Snap, and Criteo are completely blind to shopper intent

*serious* · affects **Meta, Snap, and Criteo retargeting ROAS**

You cannot retarget high-intent shoppers on Meta, Snap, or Criteo because these platforms never know when a user adds a product to their cart.

**Evidence.** When the add to cart button was clicked at 56.3 seconds, zero events were sent to Meta Pixel, Snap Pixel, or Criteo.

**Fix.** Add standard add_to_cart triggers in Tag Manager for Meta, Snap, and Criteo.

> How this was determined: a model judged severity and business impact from measured telemetry. It did not decide what fired.

### [AI] A single cart add triggers multiple conversion claims in Google Ads

*serious* · affects **Google Ads add-to-cart conversion count**

Your reporting will vastly overstate product demand and cart actions, making campaign reporting unreliable.

**Evidence.** A single add-to-cart action at 56.3 seconds generated 6 separate conversion calls to Google Ads across multiple account IDs.

**Fix.** Deduplicate Google Ads triggers so one button click sends exactly one event.

> How this was determined: a model judged severity and business impact from measured telemetry. It did not decide what fired.

### [MEASURED] Google Ads sent "page_view" 2 times (first at 13.1s, during load)

*middling*

The identical beacon was sent 2 times, so this event is over-counted by roughly 50%.

- `event`: Google Ads / page_view
- `fired at (ms)`: 13093, 13737
- `phases`: load

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads sent "view_item" 2 times (first at 13.1s, during load)

*middling*

The identical beacon was sent 2 times, so this event is over-counted by roughly 50%.

- `event`: Google Ads / view_item
- `fired at (ms)`: 13114, 13756
- `phases`: load

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Analytics 4 is reporting into 2 separate accounts

*middling*

Traffic is being split across G-3042L5GP9T, G-VDE0ZFZ4LP. No single account sees the whole picture, so every report built on one of them undercounts.

- `account 1`: G-3042L5GP9T
- `account 2`: G-VDE0ZFZ4LP

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads is reporting into 2 separate accounts

*middling*

Traffic is being split across G-3042L5GP9T, 766814719. No single account sees the whole picture, so every report built on one of them undercounts.

- `account 1`: G-3042L5GP9T
- `account 2`: 766814719

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Snap Pixel is reporting into 2 separate accounts

*middling*

Traffic is being split across f4be72d7-8814-42ea-acc9-1775197150e9, 725649e1-0ad2-4529-9339-91a6bca3a646. No single account sees the whole picture, so every report built on one of them undercounts.

- `account 1`: f4be72d7-8814-42ea-acc9-1775197150e9
- `account 2`: 725649e1-0ad2-4529-9339-91a6bca3a646

> How this was determined: a fixed rule over observed network traffic.

### [AI] Data is split across duplicate Google and Snap account IDs

*middling* · affects **GA4 total session and event counts**

Your analytics reporting is fractured across two separate Google Analytics accounts and two Snap account IDs, leading to inaccurate performance summaries.

**Evidence.** GA4 tracking sends events to both G-3042L5GP9T and G-VDE0ZFZ4LP, while Snap sends to two distinct account IDs.

**Fix.** Audit Google Tag Manager and remove secondary or legacy tracking IDs.

> How this was determined: a model judged severity and business impact from measured telemetry. It did not decide what fired.

### [MEASURED] 6 event name(s) are not recognised by the platforms

*minor*

Names like "checkout_gokwik", "scroll_depth", "loyalty_touchpoint_view" are custom. They still record, but they cannot drive the platforms' built-in conversion optimisation or standard reporting.

- `Google Analytics 4`: checkout_gokwik (1x)
- `Google Analytics 4`: scroll_depth (1x)
- `Google Analytics 4`: loyalty_touchpoint_view (1x)
- `Google Analytics 4`: Neemans_Opti_Tracking (1x)
- `Google Analytics 4`: form_start (1x)
- `Google Analytics 4`: ADD-TO-CART-GA4-V2 (1x)

> How this was determined: a fixed rule over observed network traffic.


---

## 06 · Tags found on the page

| Vendor | Requests | Failed | Account IDs | Events seen |
|---|---|---|---|---|
| Google Ads | 47 | 0 | `G-3042L5GP9T`, `766814719` | gtag.config, conversion, page_view, view_item, add_to_cart |
| Snap Pixel | 27 | 0 | `f4be72d7-8814-42ea-acc9-1775197150e9`, `725649e1-0ad2-4529-9339-91a6bca3a646` | — |
| Microsoft Clarity | 21 | 0 | `ibzxcze2wv` | — |
| Google Analytics 4 | 13 | 0 | `G-3042L5GP9T`, `G-VDE0ZFZ4LP` | page_view, view_item, checkout_gokwik, scroll_depth, scroll, loyalty_touchpoint_view |
| Google Tag Manager | 8 | 0 | `GTM-578LLRZ`, `G-3042L5GP9T`, `G-VDE0ZFZ4LP` | container_load |
| Meta Pixel | 8 | 0 | `—` | — |
| Criteo | 6 | 0 | `—` | — |

---

## 07 · What the event names mean

| Event | Vendor | Category | In plain English | Should be called |
|---|---|---|---|---|
| `checkout_gokwik` | ga4 | custom_ambiguous | Records an automated initialization of the GoKwik checkout widget during page load. | `begin_checkout` |
| `scroll_depth` | ga4 | custom_clear | Tracks how deep a user scrolled on the page. | `scroll` |
| `loyalty_touchpoint_view` | ga4 | custom_clear | Records when a customer views a loyalty rewards element. | `loyalty_touchpoint_view` |
| `Neemans_Opti_Tracking` | ga4 | custom_ambiguous | Internal tracking for website optimization and experiment testing. | `optimization_experiment_view` |
| `ADD-TO-CART-GA4-V2` | ga4 | custom_clear | A secondary custom event triggered on adding an item to the cart. | `add_to_cart` |

---

## 08 · Things that fired more than once

| Vendor | Event | Times | Conversion? | Phases |
|---|---|---|---|---|
| Google Ads | `conversion` | 2 | yes | load |
| Google Ads | `page_view` | 2 | no | load |
| Google Ads | `view_item` | 2 | no | load |
| Google Ads | `conversion` | 2 | yes | load |
| Google Ads | `add_to_cart` | 2 | yes | add_to_cart |
| Google Ads | `conversion` | 2 | yes | add_to_cart |
| Google Ads | `conversion` | 2 | yes | add_to_cart |

---

## 09 · Raw evidence

**Session phases**

| Phase | From | To |
|---|---|---|
| load | 0ms | 32842ms |
| consent | 32842ms | 34277ms |
| scroll | 34277ms | 41816ms |
| add_to_cart | 41816ms | 66155ms |
| settle | 66155ms | 67656ms |

**Every event captured**

| t (ms) | Phase | Vendor | Event | Status | Account | Conv. | Standard |
|---|---|---|---|---|---|---|---|
| 8535 | load | gtm | `container_load` | 200 | `GTM-578LLRZ` |  | — |
| 9472 | load | gtm | `container_load` | 200 | `G-3042L5GP9T` |  | — |
| 9473 | load | gtm | `container_load` | 200 | `—` |  | — |
| 9473 | load | gtm | `container_load` | 200 | `—` |  | — |
| 10114 | load | gtm | `container_load` | 200 | `—` |  | — |
| 10292 | load | gtm | `container_load` | 200 | `G-VDE0ZFZ4LP` |  | — |
| 10293 | load | gtm | `container_load` | 200 | `G-3042L5GP9T` |  | — |
| 10293 | load | gtm | `container_load` | 200 | `—` |  | — |
| 11401 | load | ga4 | `page_view` | 204 | `G-3042L5GP9T` |  | yes |
| 11415 | load | ga4 | `view_item` | 204 | `G-3042L5GP9T` |  | yes |
| 11757 | load | google_ads | `gtag.config` | 200 | `766814719` |  | — |
| 11758 | load | google_ads | `gtag.config` | 200 | `—` |  | — |
| 11761 | load | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 11762 | load | google_ads | `page_view` | 200 | `766814719` |  | — |
| 11762 | load | google_ads | `view_item` | 200 | `766814719` |  | — |
| 11773 | load | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 11778 | load | google_ads | `page_view` | 200 | `766814719` |  | — |
| 11779 | load | google_ads | `view_item` | 200 | `766814719` |  | — |
| 12456 | load | ga4 | `page_view` | 204 | `G-VDE0ZFZ4LP` |  | yes |
| 13059 | load | google_ads | `conversion` | 302 | `766814719` | yes | — |
| 13093 | load | google_ads | `page_view` | 302 | `766814719` |  | — |
| 13114 | load | google_ads | `view_item` | 302 | `766814719` |  | — |
| 13720 | load | google_ads | `gtag.config` | 200 | `—` |  | — |
| 13733 | load | google_ads | `conversion` | 200 | `—` | yes | — |
| 13737 | load | google_ads | `page_view` | 200 | `—` |  | — |
| 13756 | load | google_ads | `view_item` | 200 | `—` |  | — |
| 17054 | load | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 17055 | load | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 17212 | load | ga4 | `checkout_gokwik` | 204 | `G-3042L5GP9T` | yes | no |
| 17300 | load | google_ads | `conversion` | 302 | `766814719` | yes | — |
| 17432 | load | google_ads | `conversion` | 200 | `—` | yes | — |
| 40022 | scroll | ga4 | `scroll_depth` | 204 | `G-3042L5GP9T` |  | no |
| 43916 | add_to_cart | ga4 | `scroll` | 204 | `G-VDE0ZFZ4LP` |  | yes |
| 45342 | add_to_cart | ga4 | `loyalty_touchpoint_view` | 204 | `G-3042L5GP9T` |  | no |
| 55739 | add_to_cart | ga4 | `Neemans_Opti_Tracking` | 204 | `G-3042L5GP9T` |  | no |
| 55741 | add_to_cart | ga4 | `page_view` | 204 | `G-3042L5GP9T` |  | yes |
| 55742 | add_to_cart | google_ads | `page_view` | 200 | `766814719` |  | — |
| 55742 | add_to_cart | google_ads | `page_view` | 200 | `—` |  | — |
| 55752 | add_to_cart | ga4 | `form_start` | 204 | `G-VDE0ZFZ4LP` |  | no |
| 55838 | add_to_cart | google_ads | `page_view` | 200 | `—` |  | — |
| 56362 | add_to_cart | ga4 | `add_to_cart` | 204 | `G-3042L5GP9T` | yes | yes |
| 56374 | add_to_cart | google_ads | `add_to_cart` | 200 | `766814719` | yes | — |
| 56374 | add_to_cart | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 56374 | add_to_cart | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 56375 | add_to_cart | google_ads | `add_to_cart` | 200 | `766814719` | yes | — |
| 56375 | add_to_cart | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 56656 | add_to_cart | google_ads | `add_to_cart` | 302 | `766814719` | yes | — |
| 56674 | add_to_cart | google_ads | `conversion` | 302 | `766814719` | yes | — |
| 56676 | add_to_cart | google_ads | `conversion` | 302 | `766814719` | yes | — |
| 57278 | add_to_cart | google_ads | `add_to_cart` | 200 | `—` | yes | — |
| 57280 | add_to_cart | google_ads | `conversion` | 200 | `—` | yes | — |
| 57295 | add_to_cart | google_ads | `conversion` | 200 | `—` | yes | — |
| 60697 | add_to_cart | ga4 | `page_view` | 204 | `G-VDE0ZFZ4LP` |  | yes |
| 61215 | add_to_cart | ga4 | `ADD-TO-CART-GA4-V2` | 204 | `G-3042L5GP9T` |  | no |

---

*Generated by the Landing Page Pre-Flight Auditor. Observation by Playwright/Chromium; checks are deterministic; interpretation by gemini-3.6-flash. Single-run sampling — this is evidence, not proof. See NOTE.md.*