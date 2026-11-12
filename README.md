# Show Mode: event pickup MVP prototype

A clickable prototype of **Show Mode**, an event pickup layer for a rideshare app. It shows one concert night at **Harbor Arena** (18,000 seats) from three points of view, one per tab:

- **Rider app** (Maya, leaving with five friends, so she takes UberXL), in a phone frame
- **Driver app** (Dev, who drives an XL), in a phone frame
- **Ops event view**, an event layer on top of the existing city dashboard

Thesis: **the bottleneck is the curb, not the number of drivers.** The prototype runs on mocked data only. There's no backend, no API keys and no network calls.

## Run it

Requires Node 18+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). It's designed for a 1440 px wide laptop screen.

## How it works

- **Map-first phones.** Both phones use the standard rideshare layout: a full-screen, street-level map with floating controls and a bottom sheet. Pickups follow the pattern rideshare apps use at airports today: lots look like ordinary parking areas on the base map, pickup points are blue markers, and Maya's is labelled "Rideshare Lot, Zone B, Spot B7" with a walking time. A **Directions to pickup** button opens a step-by-step guide with a picture of the "Ride App Pickup" sign at each step (placeholder art standing in for venue photos). Individual bays aren't drawn, since phone GPS isn't precise enough for that; the numbered signs do the last few meters. Only the ops spot grid shows bay-level detail. The map is a stylized SVG of a fictional city (`src/map/`), so it needs no map tiles, API keys or network. The ops **Live map** uses the same geography, so Dev's car sits in the same place on all three tabs.
- **Three tabs, one night.** Switch between **1 Rider app**, **2 Driver app** and **3 Ops event view** with the tabs or the keys `1` `2` `3`. Each tab label shows that view's live status.
- **One shared clock.** The show is published to end at 11:30 PM. The scrubber runs from 7:00 PM to 12:30 AM, with play/pause and 50x / 100x / 200x speed (100x plays the post-show hour in about 36 seconds).
- **Mode selector:** **Software only** (the default) or **Full Show Mode**. Each mode is a preset of the feature switches. Flip any switch on its own and the mode shows as "Custom".
- **Feature switches:** separate XL line, pickup codes, numbered spots, staging lot. The virtual queue with dispatch pacing is always on. Numbered spots and staging are for large pilot venues only, so they're disabled at Riverside Hall.
- **Scenario toggles:** encore runs 15 min late, weak cell service, Zone B overloaded, staging lot under-filled.
- **Phone steppers.** The journey list beside each phone, and the dots and ‹ › under it, jump the shared clock to that screen, so you can click through the whole flow without pressing play. In-app buttons ("I'm heading out", "I'm on my way", "Code matches?") also advance the story.
- **Ops controls** (pacing by zone or by ride type, open overflow spots, hold or release staged drivers, message Zone B, expected show end) take effect from the current minute onward. Use **Reset** to undo them.
- **Venue picker:** switch to **Riverside Hall** (11,000 seats, mid-size, roomy lot, no spots or staging) to show that software only is enough where the curb isn't the bottleneck.
- **Planned road closure:** ops sets up the Pier St closure and one staging-to-zone route before each show, so every route on the phones and the ops map uses the preset detour.

### Rider flow (Maya)

During the show → show ends: pick **UberX** or **UberXL (up to 6)**, each with its current wait → **I'm heading out** → place in the UberXL line → **your turn**: "Head to Spot B7 now. Dev is on the way in a Honda Odyssey" → gate-to-spot walking directions → pickup code → in ride → arrived. A "Demo: driver cancels" link shows that Maya keeps her place in line.

### Driver flow (Dev)

Event preview (about 2,500 rides, ~20% XL, staged drivers get priority dispatch) → staging lot with separate UberX and UberXL queues, no extra pay shown → priority release to Spot B7 on the preset route → at the spot: rider, party size, code → trip → earnings, with "Next pickup: you're #3 in the staging queue".

### Ops event view

Demand forecast by 15-minute window with XL share and recommended staged X/XL drivers (actual requests overlay it once the night starts) · top metrics including trip completion, P90 and staging fill vs. target · zone cards with queue and P90 by ride type and the spot grid (two XL spots per zone) · live map with the closure and staging route · alerts · manual controls · mode comparison · post-event summary.

### Deep links for demo prep

| Param | Example |
| --- | --- |
| `mode` | `software`, `full` |
| `t` | `11:35`, `12:10 AM` or minutes after 7 PM |
| `feat` | `xlLine,codes,spots,staging` (turns these on) |
| `scen` | `encore,weakSignal,zoneBOverload,stagingUnderfilled` |
| `venue` | `riverside` |
| `view` | `rider`, `driver`, `ops` |
| `modal` | `report`, `roadmap` |

Example: `http://localhost:5173/?view=rider&mode=full&t=11:50&scen=weakSignal`

## Simulation model (simple and deterministic)

`src/sim/engine.ts` simulates the whole night minute by minute for the current settings. The scrubber just reads one minute of that run.

- **Demand:** about 2,500 requests, 20% of them UberXL, peaking 5–15 min after the show ends.
- **Two lanes per zone:** UberX and UberXL each have a queue, a travel pipeline and cars at the curb. Drivers are also 20% XL, in the city pool and in staging.
- **Curb capacity:** positions × 60 / dwell. Each zone has 10 numbered spots (two sized for XL), each a signed bay holding 4 cars. Codes and numbered spots cut dwell.
- **Queue + pacing (always on):** drivers are released only as fast as the zone can load them. Riders keep their place, so cancellations stay low and there's no surge.
- **Separate XL line:** each ride type has its own line and pacing. Without it there's one shared line: the dispatcher sends whichever car is next, and an XL car takes whoever is first in line (usually an UberX rider), so groups wait much longer and cancel more.
- **Staging:** up to 120 drivers (96 X, 24 XL) wait 4 min away and get priority dispatch, released on a steady cadence. Drivers sent from across the city arrive bunched, leaving positions idle. Staging pays nothing extra.
- **Staging lot under-filled:** only about half the target shows up and refills come slower, so Full Show Mode lands between the two modes and the summary flags a driver incentive test.
- **Encore:** demand shifts 15 min later. With staging, release is held. Without it, early drivers drift away.
- **Weak signal:** handoffs slow down a little. Saved info and a text fallback keep the pickup working.
- **P90** counts riders still waiting at 12:30 AM at their wait so far. **Trip completion** counts them as not completed.

Results for Harbor Arena with no scenarios on (illustrative):

| | Software only | Full Show Mode |
| --- | --- | --- |
| Trip completion | ~92% | ~98% |
| P90 heading out → in car | ~18 min | ~11 min |
| P90 UberX / UberXL | ~18 / ~19 min | ~11 / ~12 min |
| Cancellations | ~6% | ~1% |
| Avg price (X + XL mix) | $29 | $29 |

Without the separate XL line, UberXL P90 rises to about 35 min. With staging under-filled, Full Show Mode P90 is about 13 min.

## 5-minute demo script

1. **Software only at 11:35 PM** (the default on load). On the **Rider** tab, Maya's group picks **UberXL** and taps **I'm heading out**. Step through her place in the UberXL line, "your turn", walking directions and the pickup code with the ‹ › stepper. Optionally turn off **Separate XL line** to show XL waits jump in the ops zone cards.
2. **Switch to Full Show Mode.** On the **Driver** tab, Dev waits in the staging lot's XL queue with priority dispatch, then is sent to **Spot B7** on the preset route. Back on the **Rider** tab, Maya's group walks straight to B7. On the **Ops** tab, show the forecast panel and the **mode comparison**.
3. **Turn on Weak cell service.** On the **Rider** tab, step Maya to the walk or pickup screen. The banner reads "Weak signal, showing saved info", the code and map still show, and the text fallback arrives ("Your driver is at Spot B7, code 4821").
4. **Turn on Zone B overloaded.** On the **Ops** tab, Zone B goes red and the overload alert suggests controls. Click **Message Zone B → try A** and/or **Open overflow spots** and watch the waits drop. Optionally turn on **Staging lot under-filled** to show the "Staging lot at 50% of target" alert.
5. **Open Post-event summary:** forecast vs. actual, trip completion, worst bottleneck, staging fill rate (with "Candidate for driver incentive test" when under-filled), and which features drove the improvement, including the UberXL P90. Then open **Roadmap** for M1, M2 and the vision.

Optional: toggle **Encore runs 15 min late** (ops alert "holding driver release", Dev's staging screen shows the hold, and ops can type 11:45 PM into the show-time field). Switch the venue to **Riverside Hall** to show where software only is enough.

## Project structure

```
src/
  sim/        config, engine (minute-by-minute model), story (Maya/Dev screens), alerts, formatting
  state/      SimContext: shared store, playback loop, memoized sim runs
  map/        fictional city geography, the SVG map, map + bottom-sheet layout, Maya/Dev positions
  components/ control bar, view tabs, phone frame, modals (post-event summary, roadmap), shared UI
  rider/      rider app screens
  driver/     driver app screens
  ops/        forecast, metrics, zone cards by ride type, map, timeline chart, alerts, controls, mode comparison
```

All names, venues and the logo mark are fictional.
