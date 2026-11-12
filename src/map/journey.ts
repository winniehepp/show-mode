import { ARRIVE_START, SHOW_START } from '../sim/config';
import type { Story } from '../sim/story';
import type { Features, ZoneId } from '../sim/types';
import {
  ARENA,
  DEV_HOME_BASE,
  ROUTE_ARRIVE,
  STAGING,
  along,
  routeHome,
  routeToSpot,
  spotPos,
  walkPath,
  type Pt,
  type Route,
} from './world';

/**
 * Where Maya and Dev are on the map at a given moment. Both phones and the
 * ops map read this, so the car is in the same place on every screen.
 */
export interface Journey {
  pickupPt: Pt;
  toSpot: Route;
  home: Route;
  walk: Pt[];
  devStart: Pt;
  dev: { pos: Pt; angle: number; seg: number; leg: 'waiting' | 'toSpot' | 'atSpot' | 'trip' | 'done' };
  maya: { pos: Pt | null; walkProgress: number };
  arriving: { pos: Pt; angle: number };
}

export function journey(t: number, story: Story, f: Features, zone: ZoneId): Journey {
  const x = zone === 'A' ? 370 : 490;
  const pickupPt: Pt = f.spots ? spotPos(zone, 7) : [x, 562];
  // Ops plans around the Pier St closure before each show, so every route uses the preset detour.
  const toSpot = routeToSpot(zone, pickupPt, f.staging ? 'staging' : 'city', true);
  const home = routeHome(zone, pickupPt, true);
  const walk = walkPath(zone, pickupPt);
  const devStart: Pt = f.staging ? [STAGING.x + 56, STAGING.y + 27] : DEV_HOME_BASE;

  let dev: Journey['dev'];
  if (t < story.devDispatch) {
    dev = { pos: devStart, angle: f.staging ? -90 : 180, seg: 0, leg: 'waiting' };
  } else if (t < story.devArrive) {
    const p = (t - story.devDispatch) / Math.max(0.5, story.devArrive - story.devDispatch);
    dev = { ...along(toSpot.pts, p), leg: 'toSpot' };
  } else if (t < story.pickup + 1) {
    dev = { ...along(toSpot.pts, 1), leg: 'atSpot' };
  } else if (t < story.rideEnd) {
    dev = { ...along(home.pts, (t - story.pickup - 1) / story.rideMin), leg: 'trip' };
  } else {
    dev = { ...along(home.pts, 1), leg: 'done' };
  }

  let maya: Journey['maya'] = { pos: [ARENA.cx + 10, ARENA.cy + 20], walkProgress: 0 };
  if (t < SHOW_START) maya = { pos: null, walkProgress: 0 };
  else if (t >= story.pickup + 1) maya = { pos: null, walkProgress: 1 };
  else if (t >= story.walkStart) {
    const p = Math.min(1, (t - story.walkStart) / Math.max(1, story.pickup - 1 - story.walkStart));
    maya = { pos: along(walk, p).pos, walkProgress: p };
  }

  const a = along(ROUTE_ARRIVE.pts, Math.max(0, Math.min(1, (t - ARRIVE_START) / (SHOW_START - ARRIVE_START))));
  return { pickupPt, toSpot, home, walk, devStart, dev, maya, arriving: { pos: a.pos, angle: a.angle } };
}
