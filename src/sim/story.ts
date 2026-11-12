import { ARRIVE_START, PICKUP_CODE, RIDE_MIN, SHOW_START, STAGING_OPEN, T_END, VENUES, venueFeatures } from './config';
import type { SimResult } from './types';

/**
 * Maya's and Dev's screens, derived from the simulated night so the phones
 * agree with what ops sees.
 */

export type RiderStage = 'arriving' | 'show' | 'ended' | 'queue' | 'turn' | 'walk' | 'pickup' | 'ride' | 'arrived';

export type DriverStage = 'preview' | 'staging' | 'nearby' | 'dispatch' | 'atSpot' | 'trip' | 'earnings';

export interface Story {
  join: number;
  pickup: number;
  /** Maya's turn comes up: she's told to head out and Dev is on the way. */
  turn: number;
  walkStart: number;
  rideEnd: number;
  /** Ride length in minutes; shortened on late nights so the trip ends before the timeline does. */
  rideMin: number;
  devDispatch: number;
  devArrive: number;
  devTravel: number;
  spot: string;
  code: string;
  rider: { stage: RiderStage; start: number }[];
  driver: { stage: DriverStage; start: number }[];
}

export function buildStory(r: SimResult): Story {
  const { mayaZone } = r.input;
  const f = venueFeatures(r.input.venue, r.input.features);
  const v = VENUES[r.input.venue];
  const walk = v.walk[mayaZone];
  const join = r.maya.join;
  const simPickup = r.maya.pickup ?? join + 45;
  // Maya waits inside, then walks out when her turn comes up.
  const pickup = Math.max(simPickup, join + walk + 2);
  const devTravel = r.maya.travel;
  const devDispatch = Math.max(join + 1, pickup - 1 - devTravel);
  const devArrive = pickup - 1;
  const walkStart = Math.max(join + 1, pickup - walk - 1);
  const turn = Math.max(join + 1, Math.min(devDispatch, walkStart) - 1);
  const rideMin = Math.max(8, Math.min(RIDE_MIN, T_END - 3 - (pickup + 1)));
  const rideEnd = pickup + 1 + rideMin;

  const rider: Story['rider'] = [
    { stage: 'arriving', start: ARRIVE_START },
    { stage: 'show', start: SHOW_START },
    { stage: 'ended', start: r.actualEnd },
    { stage: 'queue', start: join },
    { stage: 'turn', start: turn },
    { stage: 'walk', start: walkStart },
    { stage: 'pickup', start: pickup - 1 },
    { stage: 'ride', start: pickup + 1 },
    { stage: 'arrived', start: rideEnd },
  ];

  const driver: Story['driver'] = [{ stage: 'preview', start: 0 }];
  if (f.staging) driver.push({ stage: 'staging', start: STAGING_OPEN + 5 });
  else driver.push({ stage: 'nearby', start: r.actualEnd - 10 });
  driver.push({ stage: 'dispatch', start: devDispatch });
  driver.push({ stage: 'atSpot', start: devArrive });
  driver.push({ stage: 'trip', start: pickup + 1 });
  driver.push({ stage: 'earnings', start: rideEnd });

  return {
    join,
    pickup,
    turn,
    walkStart,
    rideEnd,
    rideMin,
    devDispatch,
    devArrive,
    devTravel,
    spot: `${mayaZone}7`,
    code: PICKUP_CODE,
    rider: dedupe(rider),
    driver: dedupe(driver),
  };
}

/** Keep stages in time order even when the sim squeezes them together. */
function dedupe<T extends { start: number }>(list: T[]): T[] {
  const out: T[] = [];
  for (const s of list) {
    const prev = out[out.length - 1];
    const start = prev ? Math.max(s.start, prev.start + 1) : s.start;
    out.push({ ...s, start });
  }
  return out;
}

export function stageAt<S>(list: { stage: S; start: number }[], t: number): { stage: S; start: number; index: number } {
  let i = 0;
  for (let k = 0; k < list.length; k++) if (t >= list[k].start) i = k;
  return { ...list[i], index: i };
}
