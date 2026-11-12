import type { Features, Levers, ModeId, RideType, Scenarios, VenueId, ZoneId } from './types';

export const T_END = 330; // 7:00 PM → 12:30 AM, in minutes
export const PUBLISHED_END = 270; // 11:30 PM
export const ENCORE_DELAY = 15;
export const STAGING_OPEN = 240; // 11:00 PM
export const ARRIVE_START = 30; // 7:30 PM, Maya's ride to the venue
export const SHOW_START = 60; // 8:00 PM, dropped off at the venue
export const ZONES: ZoneId[] = ['A', 'B'];
export const RIDE_TYPES: RideType[] = ['X', 'XL'];
export const XL_SHARE = 0.2; // of requests, and of drivers
export const XL_SPOTS = 2; // per zone, sized for XL vehicles

export interface Venue {
  id: VenueId;
  name: string;
  capacity: number;
  demand: number;
  /** Large pilot venues get numbered spots and a staging lot; mid-size venues run software only. */
  pilot: boolean;
  /** Numbered spots per zone; each spot is a signed curb bay that loads up to 4 cars. */
  spotsPerZone: number;
  carsPerSpot: number;
  stagingCap: number;
  stagingMin: number;
  baseTravel: number;
  fare: Record<RideType, number>;
  walk: Record<ZoneId, number>;
  lotNote: string;
}

export const VENUES: Record<VenueId, Venue> = {
  harbor: {
    id: 'harbor',
    name: 'Harbor Arena',
    capacity: 18000,
    demand: 2500,
    pilot: true,
    spotsPerZone: 10,
    carsPerSpot: 4,
    stagingCap: 120,
    stagingMin: 4,
    baseTravel: 7,
    fare: { X: 26, XL: 42 },
    walk: { A: 4, B: 6 },
    lotNote: 'Tight existing rideshare lot, two zones',
  },
  riverside: {
    id: 'riverside',
    name: 'Riverside Hall',
    capacity: 11000,
    demand: 1400,
    pilot: false,
    spotsPerZone: 16,
    carsPerSpot: 4,
    stagingCap: 0,
    stagingMin: 4,
    baseTravel: 6,
    fare: { X: 22, XL: 36 },
    walk: { A: 3, B: 4 },
    lotNote: 'Mid-size venue, roomy lot, software only',
  },
};

export const RIDE_LABEL: Record<RideType, string> = { X: 'UberX', XL: 'UberXL' };

/** All switches off: the virtual queue with one shared line. */
export const BASE_FEATURES: Features = { xlLine: false, codes: false, spots: false, staging: false };

export const MODE_FEATURES: Record<Exclude<ModeId, 'custom'>, Features> = {
  software: { xlLine: true, codes: true, spots: false, staging: false },
  full: { xlLine: true, codes: true, spots: true, staging: true },
};

export const MODE_LABEL: Record<ModeId, string> = {
  software: 'Software only',
  full: 'Full Show Mode',
  custom: 'Custom',
};

export function deriveMode(f: Features): ModeId {
  const same = (m: Features) => (Object.keys(m) as (keyof Features)[]).every((k) => m[k] === f[k]);
  if (same(MODE_FEATURES.software)) return 'software';
  if (same(MODE_FEATURES.full)) return 'full';
  return 'custom';
}

/** Mid-size venues have no numbered spots or staging lot. */
export function venueFeatures(venue: VenueId, f: Features): Features {
  return VENUES[venue].pilot ? f : { ...f, spots: false, staging: false };
}

export const NO_SCENARIOS: Scenarios = {
  encore: false,
  weakSignal: false,
  zoneBOverload: false,
  stagingUnderfilled: false,
};

export const DEFAULT_LEVERS: Levers = {
  pacing: {
    A: { mult: 1, since: 0 },
    B: { mult: 1, since: 0 },
    X: { mult: 1, since: 0 },
    XL: { mult: 1, since: 0 },
  },
  overflow: null,
  messageB: null,
  hold: null,
};

export const PICKUP_CODE = '4821';
export const MAYA_JOIN_OFFSET = 15; // minutes after the show actually ends
export const MAYA_PARTY = 6; // Maya plus five friends
export const RIDE_MIN = 22;

/** Staged drivers ops aims for, split by ride type. */
export function stagingTarget(venue: VenueId): Record<RideType, number> {
  const cap = VENUES[venue].stagingCap;
  return { X: Math.round(cap * (1 - XL_SHARE)), XL: Math.round(cap * XL_SHARE) };
}
