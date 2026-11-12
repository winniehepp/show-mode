import {
  ENCORE_DELAY,
  MAYA_JOIN_OFFSET,
  PUBLISHED_END,
  RIDE_TYPES,
  STAGING_OPEN,
  T_END,
  VENUES,
  XL_SHARE,
  XL_SPOTS,
  ZONES,
  stagingTarget,
  venueFeatures,
} from './config';
import type { Health, LaneSnap, PaceKey, RideType, SimInput, SimResult, Snap, Summary, VenueId, ZoneId, ZoneSnap } from './types';

/**
 * Deterministic minute-by-minute model of one concert night.
 *
 * Each zone has an UberX lane and an UberXL lane: riders wait in FIFO
 * queues, drivers are dispatched into a travel pipeline, wait at the curb,
 * and load at the zone's capacity. Dispatch is paced to what the curb can
 * load, because extra cars at the curb slow travel and loading for everyone.
 *
 * With the separate XL line on, each ride type has its own line and pacing.
 * Without it there is one shared line: the dispatcher sends whichever car is
 * next, and an XL car takes whoever is first in line, usually an UberX rider,
 * so groups wait much longer.
 */

interface Cohort {
  t0: number;
  n: number;
  maya?: boolean;
}

interface Lane {
  q: Cohort[];
  arrivals: number[];
  enRoute: number;
  curb: number;
  served: { t: number; wait: number; n: number }[];
}

type ZoneState = Record<RideType, Lane>;

const TYPE_SHARE: Record<RideType, number> = { X: 1 - XL_SHARE, XL: XL_SHARE };

function demandWeights(): number[] {
  const w: number[] = [];
  for (let m = 0; m < 75; m++) w.push(Math.pow(m + 1, 1.9) * Math.exp(-(m + 1) / 8));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}
const WEIGHTS = demandWeights();

function requestsAt(t: number, end: number, demand: number): number {
  const m = t - end;
  if (m >= -10 && m < 0) return (demand * 0.04) / 10;
  if (m >= 0 && m < WEIGHTS.length) return demand * 0.96 * WEIGHTS[m];
  return 0;
}

export interface Forecast {
  windows: { start: number; requests: number; xl: number }[];
  total: number;
  staged: Record<RideType, number>;
}

/** Pre-event forecast: expected requests by 15-minute window around the expected show end. */
export function forecast(venue: VenueId, expectedEnd: number): Forecast {
  const v = VENUES[venue];
  const windows = [];
  for (let start = expectedEnd - 15; start < expectedEnd + 75; start += 15) {
    let n = 0;
    for (let t = start; t < start + 15; t++) n += requestsAt(t, expectedEnd, v.demand);
    windows.push({ start, requests: n, xl: n * XL_SHARE });
  }
  return { windows, total: windows.reduce((a, w) => a + w.requests, 0), staged: stagingTarget(venue) };
}

function qTotal(l: Lane) {
  let s = 0;
  for (const c of l.q) s += c.n;
  return s;
}

function p90FromList(list: { wait: number; n: number }[], q = 0.9): number | null {
  const total = list.reduce((a, b) => a + b.n, 0);
  if (total < 3) return null;
  const sorted = [...list].sort((a, b) => a.wait - b.wait);
  let acc = 0;
  for (const s of sorted) {
    acc += s.n;
    if (acc >= total * q) return s.wait;
  }
  return sorted[sorted.length - 1].wait;
}

const byType = <T,>(fn: (type: RideType) => T): Record<RideType, T> => ({ X: fn('X'), XL: fn('XL') });

export function runSim(input: SimInput): SimResult {
  const { scenarios: sc, levers } = input;
  const f = venueFeatures(input.venue, input.features);
  const v = VENUES[input.venue];
  const actualEnd = PUBLISHED_END + (sc.encore ? ENCORE_DELAY : 0);
  const mayaJoin = actualEnd + MAYA_JOIN_OFFSET;
  const positionsBase = v.spotsPerZone * v.carsPerSpot;
  const target = stagingTarget(input.venue);
  const targetTotal = target.X + target.XL;
  // Under-filled staging: only about half the target shows up, and refills come slower.
  const fillRate = sc.stagingUnderfilled ? 0.5 : 1;
  const reach = byType((type) => target[type] * fillRate);

  const lane = (): Lane => ({ q: [], arrivals: new Array(T_END + 80).fill(0), enRoute: 0, curb: 0, served: [] });
  const zs: Record<ZoneId, ZoneState> = { A: byType(lane), B: byType(lane) };

  const avail = byType(() => 0);
  const staged = byType(() => 0);
  let peakStaged = 0;
  let requestsCum = 0;
  let pickupsCum = 0;
  let cancelsCum = 0;
  let priceSum = 0;
  let stagingTrips = 0;
  const allServed: { wait: number; n: number; type: RideType }[] = [];
  const servedHist = new Array(T_END + 2).fill(0); // served riders by whole-minute wait
  const snaps: Snap[] = [];
  const maya = {
    join: mayaJoin,
    pickup: null as number | null,
    travel: v.baseTravel,
    fromStaging: false,
    price: v.fare[input.mayaType],
    aheadAtJoin: 0,
  };
  // Dev's drive time if dispatched at minute t, read back once Maya's pickup is known.
  const mayaTravelAt: { travel: number; fromStaging: boolean }[] = [];
  // Share of each zone's last release that staging covered; drives how evenly cars reach the curb.
  const stageCover: Record<ZoneId, number> = { A: 0, B: 0 };
  let worst = { zone: 'B' as ZoneId, t: actualEnd, p90: 0 };
  let peakQueue = 0;
  let peakRequests = 0;
  let peakPickups = 0;

  const on = (since: number | null, t: number) => since !== null && t >= since;

  for (let t = 0; t < T_END; t++) {
    const overflow = on(levers.overflow, t);
    const msgB = on(levers.messageB, t);
    const heldByLever = levers.hold !== null && t >= levers.hold.from && (levers.hold.to === null || t < levers.hold.to);
    const heldByEncore = f.staging && sc.encore && t >= Math.min(input.expectedEnd, PUBLISHED_END) && t < actualEnd;
    const held = heldByLever || heldByEncore;
    const paceOf = (k: PaceKey) => (t >= levers.pacing[k].since ? levers.pacing[k].mult : 1);

    // --- Demand -----------------------------------------------------------
    let shareB = sc.zoneBOverload ? 0.72 : 0.5;
    if (msgB) shareB = Math.max(0.45, shareB - 0.2);
    const req = requestsAt(t, actualEnd, v.demand);
    requestsCum += req;
    peakRequests = Math.max(peakRequests, req);
    const zoneReq: Record<ZoneId, number> = { A: req * (1 - shareB), B: req * shareB };
    for (const id of ZONES) {
      if (zoneReq[id] <= 0) continue;
      for (const type of RIDE_TYPES) zs[id][type].q.push({ t0: t, n: zoneReq[id] * TYPE_SHARE[type] });
    }
    if (t === mayaJoin) {
      zs[input.mayaZone][input.mayaType].q.push({ t0: t, n: 1, maya: true });
      requestsCum += 1;
      maya.aheadAtJoin = Math.round(aheadOfMaya(zs[input.mayaZone], input.mayaType, f.xlLine) + 1);
    }
    // Ops messages Zone B riders: part of B's waiting line moves to Zone A.
    if (levers.messageB !== null && t === levers.messageB) {
      for (const type of RIDE_TYPES) {
        const b = zs.B[type];
        let move = qTotal(b) * 0.2;
        for (let i = b.q.length - 1; i >= 0 && move > 0; i--) {
          const c = b.q[i];
          if (c.maya) continue;
          const k = Math.min(c.n, move);
          c.n -= k;
          move -= k;
          zs.A[type].q.push({ t0: c.t0, n: k });
        }
        zs.A[type].q.sort((a, b2) => a.t0 - b2.t0);
      }
    }

    // --- Supply -----------------------------------------------------------
    const scale = v.demand / 2500;
    for (const type of RIDE_TYPES) {
      const share = TYPE_SHARE[type];
      if (t === PUBLISHED_END - 25) avail[type] += 140 * scale * share; // drivers already nearby
      if (t >= PUBLISHED_END - 25) {
        avail[type] += 58 * scale * share;
        avail[type] = Math.min(avail[type], 450 * scale * share); // idle drivers don't wait around forever
      }
      // Encore: drivers who showed up for the published end drift away unless they're holding a place in staging.
      if (sc.encore && t >= PUBLISHED_END && t < actualEnd) avail[type] *= 0.97;
      if (f.staging && t >= STAGING_OPEN) {
        if (t < PUBLISHED_END - 25) avail[type] += 7 * scale * share;
        const move = Math.max(0, Math.min(avail[type], reach[type] - staged[type], 30 * share * fillRate));
        staged[type] += move;
        avail[type] -= move;
      }
    }
    peakStaged = Math.max(peakStaged, staged.X + staged.XL);

    // --- Per-zone loading, cancels, dispatch ---------------------------------
    const zoneSnaps = {} as Record<ZoneId, ZoneSnap>;
    let pickupsNow = 0;
    let totalQueue = 0;
    // Split this minute's supply of each ride type between zones by how many riders each is holding.
    const qNow = { A: byType((ty) => qTotal(zs.A[ty])), B: byType((ty) => qTotal(zs.B[ty])) };
    const share = (id: ZoneId, ty: RideType) => (qNow.A[ty] + qNow.B[ty] > 0 ? qNow[id][ty] / (qNow.A[ty] + qNow.B[ty]) : 0.5);
    const stagedStart = { ...staged };
    const availStart = { ...avail };

    for (const id of ZONES) {
      const z = zs[id];
      const positions = positionsBase + (overflow ? 12 : 0);
      for (const type of RIDE_TYPES) {
        z[type].curb += z[type].arrivals[t];
        z[type].enRoute -= z[type].arrivals[t];
      }

      // Seconds a car holds a loading position: load + finding each other.
      let dwell = 50;
      dwell += f.spots ? 22 : 45;
      if (!f.codes) dwell += 15;
      if (sc.weakSignal) dwell += 6;
      const capBase = (positions * 60) / dwell;
      const curbTotal = z.X.curb + z.XL.curb;
      const excess = Math.max(0, curbTotal - positions);
      // Drivers sent from across the city arrive bunched, leaving positions idle; staging
      // releases them from 4 min away on a steady cadence, as long as it has drivers to release.
      const utilization = 0.92 + 0.08 * stageCover[id];
      const capEff = capBase * utilization * Math.max(0.5, 1 - 0.0022 * excess);
      // Numbered spots reserve XL-sized bays; in an open lot, cars share the curb.
      const spotShare = byType((ty) => (ty === 'XL' ? XL_SPOTS / v.spotsPerZone : 1 - XL_SPOTS / v.spotsPerZone));
      const capShare = f.spots ? spotShare : curbTotal > 0 ? byType((ty) => z[ty].curb / curbTotal) : TYPE_SHARE;

      // Loading
      const pickedByType = byType(() => 0);
      const serve = (type: RideType, k: number) => {
        const l = z[type];
        pickedByType[type] += k;
        while (k > 1e-9 && l.q.length) {
          const c = l.q[0];
          const n = Math.min(c.n, k);
          c.n -= n;
          k -= n;
          const wait = t - c.t0 + 1;
          l.served.push({ t, wait, n });
          allServed.push({ wait, n, type });
          servedHist[wait] += n;
          priceSum += n * v.fare[type];
          if (c.maya && c.n <= 1e-9) maya.pickup = t;
          if (c.n <= 1e-9) l.q.shift();
        }
      };
      // Riders each car type actually serves per minute, for wait estimates.
      let laneCap: Record<RideType, number>;
      if (f.xlLine) {
        for (const type of RIDE_TYPES) {
          const k = Math.min(capEff * capShare[type], z[type].curb, qTotal(z[type]));
          serve(type, k);
          z[type].curb -= k;
        }
        laneCap = byType((ty) => capEff * (f.spots ? spotShare[ty] : TYPE_SHARE[ty]));
      } else {
        const kX = Math.min(capEff * capShare.X, z.X.curb, qTotal(z.X));
        serve('X', kX);
        z.X.curb -= kX;
        // An XL car takes whoever is next in the shared line, usually an UberX rider.
        const xlCars = Math.min(capEff * capShare.XL, z.XL.curb);
        const qx = qTotal(z.X);
        const qxl = qTotal(z.XL);
        const fracXL = qx + qxl > 0 ? qxl / (qx + qxl) : 1;
        const toXL = Math.min(xlCars * fracXL, qxl);
        const toX = Math.min(xlCars - toXL, qx);
        serve('XL', toXL);
        serve('X', toX);
        z.XL.curb -= toXL + toX;
        laneCap = { X: capEff * (TYPE_SHARE.X + TYPE_SHARE.XL * (1 - fracXL)), XL: capEff * TYPE_SHARE.XL * fracXL };
      }
      const pickedTotal = pickedByType.X + pickedByType.XL;
      pickupsNow += pickedTotal;
      pickupsCum += pickedTotal;

      // Rider cancellations (riders in the queue keep their place, so they bail less).
      // In a shared line, groups give up more often or split into two cars.
      for (const type of RIDE_TYPES) {
        let rate = f.spots ? 0.006 : 0.009;
        if (sc.weakSignal) rate += 0.002;
        if (type === 'XL' && !f.xlLine) rate *= 2;
        for (const c of z[type].q) {
          if (c.maya || t - c.t0 < 6) continue;
          const k = c.n * rate;
          c.n -= k;
          cancelsCum += k;
        }
      }
      // Driver cancellations when stuck in the pile-up at the curb
      if (excess > 0) {
        for (const type of RIDE_TYPES) {
          const dc = excess * 0.004 * (sc.weakSignal ? 1.5 : 1) * (z[type].curb / curbTotal);
          z[type].curb -= dc;
          cancelsCum += dc;
        }
      }

      // Dispatch
      const zonePace = paceOf(id);
      const extra = Math.min(18, 0.05 * excess);
      const travelStage = v.stagingMin + extra;
      const travelCity = v.baseTravel + extra;
      const stagedHere = byType((ty) => (f.staging && !held ? Math.min(staged[ty], stagedStart[ty] * share(id, ty)) : 0));
      const send = (type: RideType, want: number) => {
        if (want <= 0) return;
        const l = z[type];
        const go = (n: number, mins: number) => {
          l.arrivals[t + Math.max(1, Math.round(mins))] += n;
          l.enRoute += n;
        };
        // Staged drivers get priority dispatch; anyone beyond them comes from wherever they are.
        const fromStage = Math.min(want, stagedHere[type]);
        if (fromStage > 0) {
          staged[type] -= fromStage;
          stagingTrips += fromStage;
          go(fromStage, travelStage);
        }
        const rest = Math.min(want - fromStage, availStart[type] * share(id, type), avail[type]);
        if (rest > 0) {
          avail[type] -= rest;
          go(rest, travelCity);
        }
      };
      const pipe = (type: RideType) => z[type].enRoute + z[type].curb;
      // Blend travel by how much of this minute's release staging can cover, so pacing stays smooth.
      const blend = (stagedN: number, cap: number) => {
        const stageFrac = Math.min(1, stagedN / Math.max(1, cap * 2));
        return { travel: travelStage * stageFrac + travelCity * (1 - stageFrac), stageFrac };
      };
      const travelBy = {} as Record<RideType, { travel: number; stageFrac: number }>;
      if (f.xlLine) {
        for (const type of RIDE_TYPES) {
          const pace = zonePace * paceOf(type);
          const cap = capBase * (f.spots ? spotShare[type] : TYPE_SHARE[type]) * pace;
          travelBy[type] = blend(stagedHere[type], cap);
          const unassigned = Math.max(0, qTotal(z[type]) - pipe(type));
          const want = held ? 0 : Math.min(unassigned, Math.max(0, cap * (travelBy[type].travel + 0.6) - pipe(type)));
          send(type, want);
        }
      } else {
        const cap = capBase * zonePace;
        const both = blend(stagedHere.X + stagedHere.XL, cap);
        travelBy.X = both;
        travelBy.XL = both;
        const pipeline = pipe('X') + pipe('XL');
        const unassigned = Math.max(0, qTotal(z.X) + qTotal(z.XL) - pipeline);
        const want = held ? 0 : Math.min(unassigned, Math.max(0, cap * (both.travel + 0.6) - pipeline));
        // The dispatcher doesn't look at ride type, so cars go out in the mix they're available in.
        for (const type of RIDE_TYPES) send(type, want * TYPE_SHARE[type]);
      }
      if (f.staging && !held && t >= actualEnd) stageCover[id] = 0.7 * stageCover[id] + 0.3 * travelBy.X.stageFrac;
      if (id === input.mayaZone) {
        const fromStaging = stagedHere[input.mayaType] >= 1;
        mayaTravelAt[t] = { travel: fromStaging ? travelStage : travelCity, fromStaging };
      }

      // Zone health: forward-looking, the worse of recent actual P90 and the estimate for someone joining now.
      const shownWait = (served: { t: number; wait: number; n: number }[], q: number, cap: number, travel: number) => {
        const p90 = p90FromList(served.filter((s) => s.t > t - 12));
        const est = q / Math.max(0.5, cap) + travel * 0.3;
        return { shown: q > 5 ? Math.max(p90 ?? 0, est) : p90, est };
      };
      const lanes = byType<LaneSnap>((ty) => {
        const q = qTotal(z[ty]);
        return { queue: q, p90: shownWait(z[ty].served, q, laneCap[ty] * zonePace, travelBy[ty].travel).shown };
      });
      const queueNow = lanes.X.queue + lanes.XL.queue;
      const overall = shownWait([...z.X.served, ...z.XL.served], queueNow, capEff * zonePace, travelBy.X.travel);
      const shown = overall.shown;
      const health: Health = shown === null ? 'green' : shown > 15 ? 'red' : shown > 10 ? 'amber' : 'green';
      if (shown !== null && shown > worst.p90) worst = { zone: id, t, p90: shown };
      zoneSnaps[id] = {
        queue: queueNow,
        enRoute: z.X.enRoute + z.XL.enRoute,
        curb: z.X.curb + z.XL.curb,
        pickups: pickedTotal,
        requests: zoneReq[id],
        cap: capEff,
        positions,
        p90: shown,
        estWait: overall.est,
        health,
        lanes,
      };
      totalQueue += queueNow;
    }

    peakQueue = Math.max(peakQueue, totalQueue);
    peakPickups = Math.max(peakPickups, pickupsNow);
    const mz = zs[input.mayaZone];
    const mayaIn = mz[input.mayaType].q.some((c) => c.maya);
    snaps.push({
      t,
      zones: zoneSnaps,
      requests: req,
      pickups: pickupsNow,
      staged: staged.X + staged.XL,
      stagedByType: { ...staged },
      stagingFill: targetTotal > 0 ? peakStaged / targetTotal : 0,
      active: zoneSnaps.A.enRoute + zoneSnaps.B.enRoute + zoneSnaps.A.curb + zoneSnaps.B.curb,
      avail: avail.X + avail.XL,
      requestsCum,
      pickupsCum,
      cancelsCum,
      cancelRate: requestsCum > 0 ? cancelsCum / requestsCum : 0,
      completion: pickupsCum + cancelsCum > 1 ? pickupsCum / (pickupsCum + cancelsCum) : 1,
      avgPrice: pickupsCum > 1 ? priceSum / pickupsCum : null,
      p90Cum: p90SoFar(servedHist, zs, t),
      held,
      mayaAhead: mayaIn ? Math.max(0, Math.round(aheadOfMaya(mz, input.mayaType, f.xlLine))) : null,
    });
  }

  // Dev is dispatched at the latest minute that still gets him to the curb in time for Maya's pickup.
  if (maya.pickup !== null) {
    for (let td = maya.pickup - 1; td >= mayaJoin; td--) {
      const rec = mayaTravelAt[td];
      if (rec && td + Math.round(rec.travel) <= maya.pickup - 1) {
        maya.travel = Math.max(2, Math.round(rec.travel));
        maya.fromStaging = rec.fromStaging;
        break;
      }
    }
  }

  // Riders still waiting at the end of the night count with their wait so far.
  const censored = [...allServed];
  for (const id of ZONES)
    for (const type of RIDE_TYPES) for (const c of zs[id][type].q) censored.push({ wait: T_END - c.t0, n: c.n, type });

  const summary: Summary = {
    p90: p90FromList(censored) ?? 0,
    p90ByType: byType((ty) => p90FromList(censored.filter((s) => s.type === ty)) ?? 0),
    median: p90FromList(censored, 0.5) ?? 0,
    cancelRate: requestsCum > 0 ? cancelsCum / requestsCum : 0,
    completion: requestsCum > 0 ? pickupsCum / requestsCum : 1,
    avgPrice: pickupsCum > 0 ? priceSum / pickupsCum : v.fare.X,
    trips: pickupsCum,
    requests: requestsCum,
    xlShare: XL_SHARE,
    lastPickup: [...snaps].reverse().find((s) => s.pickups > 0.5)?.t ?? actualEnd,
    peakQueue,
    peakRequests,
    peakPickups,
    stagingTarget: targetTotal,
    stagingFill: targetTotal > 0 ? peakStaged / targetTotal : 0,
    stagingTrips,
    worst,
  };

  return { input, snaps, maya, summary, actualEnd };
}

/** Riders ahead of Maya: in her own line, or in the one shared line when there's no separate XL line. */
function aheadOfMaya(z: ZoneState, type: RideType, xlLine: boolean): number {
  let ahead = 0;
  let join = Infinity;
  for (const c of z[type].q) {
    if (c.maya) {
      join = c.t0;
      break;
    }
    ahead += c.n;
  }
  if (!xlLine) for (const c of z[type === 'X' ? 'XL' : 'X'].q) if (c.t0 <= join) ahead += c.n;
  return ahead;
}

/** P90 over riders served so far plus riders still waiting (counted at their wait so far). */
function p90SoFar(hist: number[], zs: Record<ZoneId, ZoneState>, t: number): number | null {
  const h = [...hist];
  for (const id of ZONES) for (const type of RIDE_TYPES) for (const c of zs[id][type].q) h[Math.min(h.length - 1, t - c.t0 + 1)] += c.n;
  const total = h.reduce((a, b) => a + b, 0);
  if (total < 3) return null;
  let acc = 0;
  for (let w = 0; w < h.length; w++) {
    acc += h[w];
    if (acc >= total * 0.9) return w;
  }
  return h.length - 1;
}
