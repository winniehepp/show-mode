import type { ZoneId } from '../sim/types';

/**
 * Fictional city geography around the arena, in world units (~2 m each).
 * North is up. Pier St runs east–west below the arena; Harbor Blvd runs north–south.
 */

export type Pt = [number, number];

export interface Road {
  pts: Pt[];
  name?: string;
  kind: 'major' | 'minor' | 'service';
}

export const ROADS: Road[] = [
  {
    kind: 'minor',
    name: 'Bay St',
    pts: [
      [110, 100],
      [1100, 100],
    ],
  },
  {
    kind: 'minor',
    name: 'Market St',
    pts: [
      [120, 250],
      [1100, 250],
    ],
  },
  {
    kind: 'minor',
    name: 'Front St',
    pts: [
      [120, 780],
      [1100, 780],
    ],
  },
  {
    kind: 'minor',
    name: '1st Ave',
    pts: [
      [180, -100],
      [180, 1100],
    ],
  },
  {
    kind: 'minor',
    pts: [
      [300, -100],
      [300, 250],
    ],
  },
  {
    kind: 'minor',
    pts: [
      [300, 640],
      [300, 1100],
    ],
  },
  {
    kind: 'minor',
    name: '8th Ave',
    pts: [
      [800, -100],
      [800, 1100],
    ],
  },
  {
    kind: 'minor',
    name: '10th Ave',
    pts: [
      [960, -100],
      [960, 1100],
    ],
  },
  {
    kind: 'minor',
    pts: [
      [430, 250],
      [430, 305],
    ],
  },
  {
    kind: 'major',
    name: 'Pier St',
    pts: [
      [110, 520],
      [1100, 520],
    ],
  },
  {
    kind: 'major',
    name: 'Harbor Blvd',
    pts: [
      [640, -100],
      [640, 1100],
    ],
  },
  {
    kind: 'service',
    name: 'Dock Rd',
    pts: [
      [300, 640],
      [800, 640],
    ],
  },
  {
    kind: 'service',
    pts: [
      [370, 520],
      [370, 548],
    ],
  },
  {
    kind: 'service',
    pts: [
      [490, 520],
      [490, 548],
    ],
  },
  {
    kind: 'service',
    pts: [
      [370, 620],
      [370, 640],
    ],
  },
  {
    kind: 'service',
    pts: [
      [490, 620],
      [490, 640],
    ],
  },
];

export const WATER: Pt[] = [
  [-200, -200],
  [105, -200],
  [118, 180],
  [92, 400],
  [125, 620],
  [98, 1200],
  [-200, 1200],
];

export const PARK = { x: 192, y: 112, w: 96, h: 126 };
export const ARENA = { cx: 430, cy: 395, rx: 112, ry: 72, plaza: { x: 310, y: 300, w: 240, h: 205 } };
export const GATES: Record<string, Pt> = { G2: [338, 448], G3: [395, 466], G4: [465, 466], G5: [522, 448] };
export const LOTS: Record<ZoneId, { x: number; y: number; w: number; h: number }> = {
  A: { x: 318, y: 548, w: 104, h: 72 },
  B: { x: 438, y: 548, w: 104, h: 72 },
};
export const STAGING = { x: 680, y: 582, w: 112, h: 116 };
export const CLOSURE = { x1: 556, x2: 624, y: 520 };
export const HOME: Pt = [930, 100];
export const DROP_OFF: Pt = [430, 305];
export const DEV_HOME_BASE: Pt = [880, 250];

/** Centre of numbered spot `n` (1–10) in a zone: two rows of five bays. */
export function spotPos(zone: ZoneId, n: number): Pt {
  const lot = LOTS[zone];
  const i = n - 1;
  return [lot.x + 14 + (i % 5) * 19, lot.y + 18 + Math.floor(i / 5) * 34];
}

export function lotEntry(zone: ZoneId, side: 'north' | 'south'): Pt {
  const x = zone === 'A' ? 370 : 490;
  return side === 'north' ? [x, 548] : [x, 620];
}

export interface Route {
  pts: Pt[];
  /** Turn instruction for each segment (steps.length === pts.length - 1). */
  steps: string[];
}

/** Driver's route into the zone. A Pier St closure sends rerouted drivers in from Dock Rd. */
export function routeToSpot(zone: ZoneId, spot: Pt, from: 'staging' | 'city', rerouted: boolean): Route {
  const x = zone === 'A' ? 370 : 490;
  if (from === 'staging') {
    return rerouted
      ? {
          pts: [[736, 640], [x, 640], [x, 620], spot],
          steps: ['Exit Lot 7, head west on Dock Rd', `Turn right into Zone ${zone}`, 'Your spot is ahead'],
        }
      : {
          pts: [[736, 640], [640, 640], [640, 520], [x, 520], [x, 548], spot],
          steps: [
            'Exit Lot 7 onto Dock Rd',
            'Turn right onto Harbor Blvd',
            'Turn left onto Pier St',
            `Turn left into Zone ${zone}`,
            'Your spot is ahead',
          ],
        };
  }
  return rerouted
    ? {
        pts: [DEV_HOME_BASE, [640, 250], [640, 640], [x, 640], [x, 620], spot],
        steps: [
          'Head west on Market St',
          'Turn left onto Harbor Blvd',
          'Pier St closed: turn right onto Dock Rd',
          `Turn right into Zone ${zone}`,
          'Your spot is ahead',
        ],
      }
    : {
        pts: [DEV_HOME_BASE, [640, 250], [640, 520], [x, 520], [x, 548], spot],
        steps: [
          'Head west on Market St',
          'Turn left onto Harbor Blvd',
          'Turn right onto Pier St',
          `Turn left into Zone ${zone}`,
          'Pick up at the curb',
        ],
      };
}

export function routeHome(zone: ZoneId, spot: Pt, avoidPier: boolean): Route {
  const x = zone === 'A' ? 370 : 490;
  return avoidPier
    ? {
        pts: [spot, [x, 620], [x, 640], [640, 640], [640, 250], [930, 250], HOME],
        steps: [
          'Exit the lot',
          'Turn left onto Dock Rd',
          'Turn left onto Harbor Blvd',
          'Turn right onto Market St',
          'Turn left onto 10th Ave',
          'Arriving',
        ],
      }
    : {
        pts: [spot, [x, 548], [x, 520], [640, 520], [640, 250], [930, 250], HOME],
        steps: [
          'Exit the lot',
          'Turn right onto Pier St',
          'Turn left onto Harbor Blvd',
          'Turn right onto Market St',
          'Turn left onto 10th Ave',
          'Arriving',
        ],
      };
}

export const ROUTE_ARRIVE: Route = {
  pts: [HOME, [930, 250], [430, 250], DROP_OFF],
  steps: ['Head south on 10th Ave', 'Turn right onto Market St', 'Turn left to the main entrance'],
};

/** Walking path from the gate to the zone, or to the exact spot. */
export function walkPath(zone: ZoneId, target: Pt): Pt[] {
  const gate = zone === 'A' ? GATES.G3 : GATES.G4;
  const x = zone === 'A' ? 370 : 490;
  return [gate, [gate[0], 512], [x - 6, 528], [x - 6, 556], target];
}

/* ---- geometry helpers ---- */

export function pathLength(pts: Pt[]) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return d;
}

/** Point and heading at fraction `p` along a polyline. */
export function along(pts: Pt[], p: number): { pos: Pt; angle: number; seg: number } {
  const total = pathLength(pts);
  let target = Math.max(0, Math.min(1, p)) * total;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (target <= len || i === pts.length - 1) {
      const f = len === 0 ? 0 : Math.min(1, target / len);
      return { pos: [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f], angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, seg: i - 1 };
    }
    target -= len;
  }
  return { pos: pts[pts.length - 1], angle: 0, seg: pts.length - 2 };
}

/** The part of a polyline from fraction `p` to the end (the route still to drive). */
export function remaining(pts: Pt[], p: number): Pt[] {
  const a = along(pts, p);
  return [a.pos, ...pts.slice(a.seg + 1)];
}

export function bounds(pts: Pt[]) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
