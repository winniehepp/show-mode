export type ZoneId = 'A' | 'B';
export type RideType = 'X' | 'XL';
export type VenueId = 'harbor' | 'riverside';
export type ModeId = 'software' | 'full' | 'custom';

/** Virtual queue + dispatch pacing is always on; these switches layer on top of it. */
export interface Features {
  xlLine: boolean; // separate UberXL line and pacing
  codes: boolean;
  spots: boolean; // numbered spots + gate-to-spot wayfinding (large pilot venues)
  staging: boolean; // physical staging lot with priority dispatch (large pilot venues)
}

export interface Scenarios {
  encore: boolean;
  weakSignal: boolean;
  zoneBOverload: boolean;
  stagingUnderfilled: boolean;
}

export type PaceKey = ZoneId | RideType;

/** Controls take effect from the sim minute they were used (`since`). */
export interface Levers {
  pacing: Record<PaceKey, { mult: number; since: number }>;
  overflow: number | null;
  messageB: number | null;
  hold: { from: number; to: number | null } | null;
}

export interface SimInput {
  venue: VenueId;
  features: Features;
  scenarios: Scenarios;
  levers: Levers;
  /** Ops' expected show end, minutes since 7:00 PM. */
  expectedEnd: number;
  mayaZone: ZoneId;
  mayaType: RideType;
}

export type Health = 'green' | 'amber' | 'red';

export interface LaneSnap {
  queue: number;
  p90: number | null;
}

export interface ZoneSnap {
  queue: number;
  enRoute: number;
  curb: number;
  pickups: number;
  requests: number;
  cap: number;
  positions: number;
  p90: number | null;
  estWait: number;
  health: Health;
  lanes: Record<RideType, LaneSnap>;
}

export interface Snap {
  t: number;
  zones: Record<ZoneId, ZoneSnap>;
  requests: number;
  pickups: number;
  staged: number;
  stagedByType: Record<RideType, number>;
  /** Peak staged so far vs. the staging target. */
  stagingFill: number;
  active: number;
  avail: number;
  requestsCum: number;
  pickupsCum: number;
  cancelsCum: number;
  cancelRate: number;
  /** Completed trips vs. trips that have finished either way (completed or cancelled). */
  completion: number;
  avgPrice: number | null;
  p90Cum: number | null;
  held: boolean;
  mayaAhead: number | null;
}

export interface MayaTimes {
  join: number;
  pickup: number | null;
  travel: number; // Dev's drive time once dispatched
  fromStaging: boolean;
  price: number;
  aheadAtJoin: number;
}

export interface Summary {
  p90: number;
  p90ByType: Record<RideType, number>;
  median: number;
  cancelRate: number;
  /** Completed trips / requests; riders still waiting at 12:30 AM count as not completed. */
  completion: number;
  avgPrice: number;
  trips: number;
  requests: number;
  xlShare: number;
  lastPickup: number;
  peakQueue: number;
  peakRequests: number;
  peakPickups: number;
  stagingTarget: number;
  stagingFill: number;
  stagingTrips: number;
  worst: { zone: ZoneId; t: number; p90: number };
}

export interface SimResult {
  input: SimInput;
  snaps: Snap[];
  maya: MayaTimes;
  summary: Summary;
  actualEnd: number;
}
