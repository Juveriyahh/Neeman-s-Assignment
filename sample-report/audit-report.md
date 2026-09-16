# Landing Page Pre-Flight Audit

**Don't spend yet.**

| | |
|---|---|
| Verdict | **HOLD — do not spend yet** |
| Readiness | **0 / 100** |
| Page | `https://neemans.com/products/curve-knit-slip-ons-for-men-ivory` |
| Run at | 2026-09-16T04:49:48.434Z |
| Took | 50.5s |
| Findings | 7 serious · 6 middling · 1 minor |
| Interpretation | Measured findings only — AI interpretation unavailable |

> **AI interpretation was not available for this run.** GEMINI_API_KEY is not set. The report below is the deterministic layer only.
> Everything below is the deterministic layer, which stands on its own.

---

## 01 · What this means for your budget

A real browser was pointed at this page. It loaded it, handled consent, scrolled it, and clicked add to cart, watching every analytics and ad-tech request the page made. It captured **163 tracking requests** from **8 vendors**, of which **76** carried a readable event name.

7 serious problem(s) were found. At least one of them will cost money or hide sales, so spend should wait until they are fixed.

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
| PASS | Your tags are installed and firing | pass | Both required tags fired. Google Analytics 4: 15 requests; Meta Pixel: 15 requests. |
| FAIL | Nothing fires twice | fail | 10 event(s) fired more than once. |
| FAIL | The data actually arrives | fail | 1 of 163 tracking requests failed to arrive. |
| FAIL | One account per platform | fail | 4 platform(s) split across multiple accounts. |
| FAIL | Add to cart gets tracked | fail | Snap Pixel, Criteo received no conversion event after the click. |
| FAIL | Event names make sense to the platforms | fail | 8 of 14 named events are non-standard. |
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

## 04 · Findings

### [MEASURED] Google Ads sent "conversion" 3 times (first at 6.5s, during load)

*serious*

This is a conversion event. Counting it 3 times inflates reported sales and teaches the ad platform to bid on the wrong signal.

- `event`: Google Ads / conversion
- `fired at (ms)`: 6472, 7020, 7304
- `phases`: load

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads sent "conversion" 3 times (first at 24.7s, during load)

*serious*

This is a conversion event. Counting it 3 times inflates reported sales and teaches the ad platform to bid on the wrong signal.

- `event`: Google Ads / conversion
- `fired at (ms)`: 24712, 25802, 25804
- `phases`: load, consent

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads sent "add_to_cart" 3 times (first at 38.6s, during add_to_cart)

*serious*

This is a conversion event. Counting it 3 times inflates reported sales and teaches the ad platform to bid on the wrong signal.

- `event`: Google Ads / add_to_cart
- `fired at (ms)`: 38648, 39046, 39048
- `phases`: add_to_cart

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads sent "conversion" 3 times (first at 38.7s, during add_to_cart)

*serious*

This is a conversion event. Counting it 3 times inflates reported sales and teaches the ad platform to bid on the wrong signal.

- `event`: Google Ads / conversion
- `fired at (ms)`: 38651, 39328, 39330
- `phases`: add_to_cart

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] 1 Criteo request(s) never arrived (net::ERR_CONNECTION_TIMED_OUT)

*serious*

These requests died before reaching Criteo at all — no server ever answered them. The data in them is simply gone.

- `failure`: net::ERR_CONNECTION_TIMED_OUT
- `count`: 1
- `sample 1`: https://gum.criteo.com/fpm/init (+5 params)

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] The add-to-cart click produced no conversion event for Snap Pixel

*serious*

The button was clicked (form[action*="/cart/add"] button[type="submit"] (normal click) + variant chooser) and Snap Pixel was live on the page, but no commercial-intent event reached it in the 64 requests that followed. This platform cannot optimise towards or retarget people who add to cart.

- `click strategy`: form[action*="/cart/add"] button[type="submit"] (normal click) + variant chooser
- `Snap Pixel events after the click`: none

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] The add-to-cart click produced no conversion event for Criteo

*serious*

The button was clicked (form[action*="/cart/add"] button[type="submit"] (normal click) + variant chooser) and Criteo was live on the page, but no commercial-intent event reached it in the 64 requests that followed. This platform cannot optimise towards or retarget people who add to cart.

- `click strategy`: form[action*="/cart/add"] button[type="submit"] (normal click) + variant chooser
- `Criteo events after the click`: none

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads sent "view_item" 3 times (first at 4.2s, during load)

*middling*

The identical beacon was sent 3 times, so this event is over-counted by roughly 67%.

- `event`: Google Ads / view_item
- `fired at (ms)`: 4196, 5001, 5449
- `phases`: load

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads sent "page_view" 3 times (first at 5.2s, during load)

*middling*

The identical beacon was sent 3 times, so this event is over-counted by roughly 67%.

- `event`: Google Ads / page_view
- `fired at (ms)`: 5152, 6097, 6437
- `phases`: load

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Snap Pixel is reporting into 2 separate accounts

*middling*

Traffic is being split across f4be72d7-8814-42ea-acc9-1775197150e9, 725649e1-0ad2-4529-9339-91a6bca3a646. No single account sees the whole picture, so every report built on one of them undercounts.

- `account 1`: f4be72d7-8814-42ea-acc9-1775197150e9
- `account 2`: 725649e1-0ad2-4529-9339-91a6bca3a646

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Analytics 4 is reporting into 3 separate accounts

*middling*

Traffic is being split across G-3042L5GP9T, G-VDE0ZFZ4LP, G-5RYZDGXEFH. No single account sees the whole picture, so every report built on one of them undercounts.

- `account 1`: G-3042L5GP9T
- `account 2`: G-VDE0ZFZ4LP
- `account 3`: G-5RYZDGXEFH

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Google Ads is reporting into 3 separate accounts

*middling*

Traffic is being split across G-3042L5GP9T, 766814719, 876772125. No single account sees the whole picture, so every report built on one of them undercounts.

- `account 1`: G-3042L5GP9T
- `account 2`: 766814719
- `account 3`: 876772125

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] Microsoft Clarity is reporting into 2 separate accounts

*middling*

Traffic is being split across jcxo7ea0kx, ibzxcze2wv. No single account sees the whole picture, so every report built on one of them undercounts.

- `account 1`: jcxo7ea0kx
- `account 2`: ibzxcze2wv

> How this was determined: a fixed rule over observed network traffic.

### [MEASURED] 8 event name(s) are not recognised by the platforms

*minor*

Names like "kp_visitors", "checkout_gokwik", "kp_engaged_visitors" are custom. They still record, but they cannot drive the platforms' built-in conversion optimisation or standard reporting.

- `Meta Pixel`: kp_visitors (1x)
- `Google Analytics 4`: checkout_gokwik (1x)
- `Meta Pixel`: kp_engaged_visitors (1x)
- `Google Analytics 4`: scroll_depth (1x)
- `Google Analytics 4`: Neemans_Opti_Tracking (1x)
- `Google Analytics 4`: form_start (2x)
- `Meta Pixel`: kp_atc (1x)
- `Google Analytics 4`: ADD-TO-CART-GA4-V2 (1x)

> How this was determined: a fixed rule over observed network traffic.


---

## 05 · Tags found on the page

| Vendor | Requests | Failed | Account IDs | Events seen |
|---|---|---|---|---|
| Google Ads | 69 | 0 | `G-3042L5GP9T`, `766814719`, `876772125` | page_view, view_item, conversion, form_start, form_submit, add_to_cart |
| Snap Pixel | 28 | 0 | `f4be72d7-8814-42ea-acc9-1775197150e9`, `725649e1-0ad2-4529-9339-91a6bca3a646` | — |
| Microsoft Clarity | 21 | 0 | `jcxo7ea0kx`, `ibzxcze2wv` | — |
| Meta Pixel | 15 | 0 | `223335195137418` | PageView, kp_visitors, kp_engaged_visitors, AddToCart, kp_atc |
| Google Analytics 4 | 15 | 0 | `G-3042L5GP9T`, `G-VDE0ZFZ4LP`, `G-5RYZDGXEFH` | page_view, view_item, checkout_gokwik, scroll, scroll_depth, Neemans_Opti_Tracking |
| Google Tag Manager | 9 | 0 | `G-3042L5GP9T`, `GTM-MBDRX7M`, `GTM-578LLRZ`, `G-5RYZDGXEFH`, `G-VDE0ZFZ4LP` | container_load |
| Criteo | 3 | 1 | `—` | — |
| Hotjar | 3 | 0 | `1225354` | — |

---

## 06 · Things that fired more than once

| Vendor | Event | Times | Conversion? | Phases |
|---|---|---|---|---|
| Google Ads | `view_item` | 3 | no | load |
| Google Ads | `page_view` | 3 | no | load |
| Google Ads | `conversion` | 3 | yes | load |
| Google Ads | `conversion` | 3 | yes | load, consent |
| Google Ads | `add_to_cart` | 3 | yes | add_to_cart |
| Google Ads | `conversion` | 3 | yes | add_to_cart |
| Google Ads | `conversion` | 3 | yes | add_to_cart |
| Google Ads | `form_start` | 2 | no | add_to_cart |
| Google Ads | `form_submit` | 2 | no | add_to_cart |
| Google Ads | `page_view` | 2 | no | add_to_cart |

---

## 07 · Raw evidence

**Session phases**

| Phase | From | To |
|---|---|---|
| load | 0ms | 25226ms |
| consent | 25226ms | 26563ms |
| scroll | 26563ms | 33701ms |
| add_to_cart | 33701ms | 48806ms |
| settle | 48806ms | 50312ms |

**Every event captured**

| t (ms) | Phase | Vendor | Event | Status | Account | Conv. | Standard |
|---|---|---|---|---|---|---|---|
| 2088 | load | gtm | `container_load` | 200 | `G-3042L5GP9T` |  | — |
| 2092 | load | gtm | `container_load` | 200 | `—` |  | — |
| 2093 | load | gtm | `container_load` | 200 | `—` |  | — |
| 3734 | load | ga4 | `page_view` | 204 | `G-3042L5GP9T` |  | yes |
| 3736 | load | ga4 | `view_item` | 204 | `G-3042L5GP9T` |  | yes |
| 4050 | load | google_ads | `page_view` | 200 | `766814719` |  | — |
| 4053 | load | google_ads | `view_item` | 200 | `766814719` |  | — |
| 4054 | load | google_ads | `page_view` | 200 | `766814719` |  | — |
| 4054 | load | google_ads | `view_item` | 200 | `766814719` |  | — |
| 4196 | load | google_ads | `view_item` | 302 | `766814719` |  | — |
| 4426 | load | gtm | `container_load` | 200 | `G-3042L5GP9T` |  | — |
| 4428 | load | gtm | `container_load` | 200 | `—` |  | — |
| 4428 | load | gtm | `container_load` | 200 | `GTM-MBDRX7M` |  | — |
| 4428 | load | gtm | `container_load` | 200 | `GTM-578LLRZ` |  | — |
| 5001 | load | google_ads | `view_item` | 302 | `—` |  | — |
| 5152 | load | google_ads | `page_view` | 302 | `766814719` |  | — |
| 5409 | load | gtm | `container_load` | 200 | `G-5RYZDGXEFH` |  | — |
| 5449 | load | google_ads | `view_item` | 200 | `—` |  | — |
| 5712 | load | gtm | `container_load` | 200 | `G-VDE0ZFZ4LP` |  | — |
| 5824 | load | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 5826 | load | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 6097 | load | google_ads | `page_view` | 302 | `—` |  | — |
| 6276 | load | meta_pixel | `PageView` | 200 | `223335195137418` |  | yes |
| 6437 | load | google_ads | `page_view` | 200 | `—` |  | — |
| 6472 | load | google_ads | `conversion` | 302 | `766814719` | yes | — |
| 6662 | load | ga4 | `page_view` | 204 | `G-VDE0ZFZ4LP` |  | yes |
| 7020 | load | google_ads | `conversion` | 302 | `—` | yes | — |
| 7304 | load | google_ads | `conversion` | 200 | `—` | yes | — |
| 7840 | load | meta_pixel | `kp_visitors` | 200 | `223335195137418` |  | no |
| 10761 | load | ga4 | `checkout_gokwik` | 204 | `G-3042L5GP9T` | yes | no |
| 24322 | load | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 24323 | load | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 24712 | load | google_ads | `conversion` | 302 | `766814719` | yes | — |
| 25802 | consent | google_ads | `conversion` | 302 | `—` | yes | — |
| 25804 | consent | google_ads | `conversion` | 200 | `—` | yes | — |
| 29370 | scroll | meta_pixel | `kp_engaged_visitors` | 200 | `223335195137418` |  | no |
| 30817 | scroll | ga4 | `scroll` | 204 | `G-5RYZDGXEFH` |  | yes |
| 32345 | scroll | ga4 | `scroll_depth` | 204 | `G-3042L5GP9T` |  | no |
| 35784 | add_to_cart | ga4 | `scroll` | 204 | `G-VDE0ZFZ4LP` |  | yes |
| 36745 | add_to_cart | google_ads | `form_start` | 200 | `876772125` |  | — |
| 36746 | add_to_cart | google_ads | `form_start` | 200 | `—` |  | — |
| 36946 | add_to_cart | meta_pixel | `PageView` | 200 | `223335195137418` |  | yes |
| 37113 | add_to_cart | google_ads | `form_start` | 200 | `—` |  | — |
| 37114 | add_to_cart | google_ads | `form_start` | 200 | `—` |  | — |
| 37424 | add_to_cart | google_ads | `form_submit` | 200 | `876772125` |  | — |
| 37425 | add_to_cart | google_ads | `form_submit` | 200 | `—` |  | — |
| 37501 | add_to_cart | google_ads | `form_submit` | 200 | `—` |  | — |
| 37502 | add_to_cart | google_ads | `form_submit` | 200 | `—` |  | — |
| 37921 | add_to_cart | ga4 | `Neemans_Opti_Tracking` | 204 | `G-3042L5GP9T` |  | no |
| 37923 | add_to_cart | ga4 | `page_view` | 204 | `G-3042L5GP9T` |  | yes |
| 37924 | add_to_cart | google_ads | `page_view` | 200 | `766814719` |  | — |
| 37926 | add_to_cart | google_ads | `page_view` | 200 | `—` |  | — |
| 37926 | add_to_cart | ga4 | `form_start` | 204 | `G-5RYZDGXEFH` |  | no |
| 37927 | add_to_cart | ga4 | `form_start` | 204 | `G-VDE0ZFZ4LP` |  | no |
| 38089 | add_to_cart | google_ads | `page_view` | 200 | `—` |  | — |
| 38090 | add_to_cart | google_ads | `page_view` | 200 | `—` |  | — |
| 38501 | add_to_cart | ga4 | `add_to_cart` | 204 | `G-3042L5GP9T` | yes | yes |
| 38503 | add_to_cart | google_ads | `add_to_cart` | 200 | `766814719` | yes | — |
| 38503 | add_to_cart | google_ads | `add_to_cart` | 200 | `766814719` | yes | — |
| 38505 | add_to_cart | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 38505 | add_to_cart | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 38507 | add_to_cart | google_ads | `conversion` | 200 | `766814719` | yes | — |
| 38550 | add_to_cart | meta_pixel | `AddToCart` | 200 | `223335195137418` | yes | yes |
| 38648 | add_to_cart | google_ads | `add_to_cart` | 302 | `766814719` | yes | — |
| 38651 | add_to_cart | google_ads | `conversion` | 302 | `766814719` | yes | — |
| 38658 | add_to_cart | google_ads | `conversion` | 302 | `766814719` | yes | — |
| 39046 | add_to_cart | google_ads | `add_to_cart` | 302 | `—` | yes | — |
| 39048 | add_to_cart | google_ads | `add_to_cart` | 200 | `—` | yes | — |
| 39129 | add_to_cart | google_ads | `conversion` | 302 | `—` | yes | — |
| 39133 | add_to_cart | google_ads | `conversion` | 200 | `—` | yes | — |
| 39328 | add_to_cart | google_ads | `conversion` | 302 | `—` | yes | — |
| 39330 | add_to_cart | google_ads | `conversion` | 200 | `—` | yes | — |
| 40057 | add_to_cart | meta_pixel | `kp_atc` | 200 | `223335195137418` |  | no |
| 42878 | add_to_cart | ga4 | `page_view` | 204 | `G-5RYZDGXEFH` |  | yes |
| 42889 | add_to_cart | ga4 | `page_view` | 204 | `G-VDE0ZFZ4LP` |  | yes |
| 43460 | add_to_cart | ga4 | `ADD-TO-CART-GA4-V2` | 204 | `G-3042L5GP9T` |  | no |

**Requests that never arrived**

- `net::ERR_CONNECTION_TIMED_OUT` — https://gum.criteo.com/fpm/init (+5 params)

---

*Generated by the Landing Page Pre-Flight Auditor. Observation by Playwright/Chromium; checks are deterministic; interpretation unavailable for this run. Single-run sampling — this is evidence, not proof. See NOTE.md.*