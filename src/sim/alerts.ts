import { PUBLISHED_END, STAGING_OPEN, venueFeatures } from './config';
import { clock, pct } from './format';
import type { SimResult } from './types';

export type AlertLevel = 'red' | 'amber' | 'info';

export interface Alert {
  id: string;
  t: number;
  level: AlertLevel;
  text: string;
  hint?: string;
}

/** Every alert that has fired by minute `now`, newest first. */
export function alertsUntil(r: SimResult, now: number): Alert[] {
  const { scenarios: sc, levers, expectedEnd } = r.input;
  const f = venueFeatures(r.input.venue, r.input.features);
  const out: Alert[] = [];
  const once = (a: Alert) => {
    if (a.t <= now && !out.some((x) => x.id === a.id)) out.push(a);
  };
  const first = (pred: (i: number) => boolean) => {
    for (let i = 0; i <= Math.min(now, r.snaps.length - 1); i++) if (pred(i)) return i;
    return null;
  };

  if (sc.encore) {
    once({ id: 'venue-text', t: PUBLISHED_END - 5, level: 'info', text: 'Venue contact (text): "Encore running ~15 min long"' });
    if (f.staging) {
      once({
        id: 'late',
        t: Math.min(expectedEnd, PUBLISHED_END),
        level: 'amber',
        text: 'Show running late, holding driver release',
        hint: expectedEnd > PUBLISHED_END ? `Expected end updated to ${clock(expectedEnd)}` : 'Update the show-time field below',
      });
    } else {
      once({
        id: 'late-no-staging',
        t: PUBLISHED_END + 3,
        level: 'amber',
        text: 'Show running late, early drivers idling near the arena and starting to leave',
      });
    }
  }
  if (sc.weakSignal) {
    once({ id: 'weak', t: r.actualEnd, level: 'info', text: 'Weak signal near Gate 3, text fallback active' });
  }
  once({
    id: 'closure',
    t: STAGING_OPEN - 15,
    level: 'info',
    text: 'Planned Pier St closure in effect',
    hint: f.staging ? 'Preset staging-to-zone route via Dock Rd is active' : 'Drivers routed in via Dock Rd',
  });

  for (const z of ['A', 'B'] as const) {
    const amber = first((i) => (r.snaps[i].zones[z].p90 ?? 0) > 10 && r.snaps[i].t >= r.actualEnd - 10);
    const red = first((i) => (r.snaps[i].zones[z].p90 ?? 0) > 15 && r.snaps[i].t >= r.actualEnd - 10);
    if (red !== null) once({ id: `p90-red-${z}`, t: red, level: 'red', text: `Zone ${z} P90 wait above 15 min` });
    else if (amber !== null) once({ id: `p90-amber-${z}`, t: amber, level: 'amber', text: `Zone ${z} P90 wait above 10 min` });

    const xl = first((i) => {
      const l = r.snaps[i].zones[z].lanes;
      return (l.XL.p90 ?? 0) > 8 && (l.XL.p90 ?? 0) >= 2 * (l.X.p90 ?? Infinity);
    });
    if (xl !== null)
      once({
        id: `xl-${z}`,
        t: xl,
        level: 'red',
        text: `UberXL wait 2x UberX in Zone ${z}`,
        hint: f.xlLine ? 'Try: speed up XL pacing' : 'Groups are stuck in the shared line. Turn on the separate XL line',
      });
  }

  const overload = first((i) => {
    const s = r.snaps[i];
    return s.zones.B.queue > 60 && s.zones.B.queue > 1.6 * s.zones.A.queue;
  });
  if (overload !== null) {
    once({
      id: 'overload',
      t: overload,
      level: 'red',
      text: 'Zone B overloaded: queue 60%+ longer than Zone A',
      hint: 'Try: message Zone B riders, open overflow spots',
    });
  }

  if (f.staging) {
    once({ id: 'staging-open', t: STAGING_OPEN, level: 'info', text: 'Staging lot open (target 120 drivers, 24 XL)' });
    // Checked 15 min before the published end, when the lot should be close to full.
    const checkAt = PUBLISHED_END - 15;
    const fill = r.snaps[checkAt]?.stagingFill ?? 0;
    if (fill < 0.8)
      once({
        id: 'staging-fill',
        t: checkAt,
        level: 'amber',
        text: `Staging lot at ${pct(fill)} of target`,
        hint: 'Priority dispatch alone isn’t drawing enough drivers. Flag for the incentive test',
      });
  }

  if (levers.overflow !== null)
    once({ id: 'lv-overflow', t: levers.overflow, level: 'info', text: 'Ops opened overflow spots A11–A13, B11–B13' });
  if (levers.messageB !== null)
    once({ id: 'lv-msg', t: levers.messageB, level: 'info', text: 'Ops messaged Zone B riders: "Zone A is 6 min faster"' });
  if (levers.hold !== null) {
    once({ id: 'lv-hold', t: levers.hold.from, level: 'amber', text: 'Ops holding staged driver release' });
    if (levers.hold.to !== null) once({ id: 'lv-release', t: levers.hold.to, level: 'info', text: 'Ops released held drivers' });
  }
  for (const k of ['A', 'B', 'X', 'XL'] as const) {
    const p = levers.pacing[k];
    const name = k === 'X' || k === 'XL' ? `Uber${k}` : `Zone ${k}`;
    if (p.mult !== 1)
      once({
        id: `lv-pace-${k}`,
        t: p.since,
        level: 'info',
        text: `Ops ${p.mult > 1 ? 'sped up' : 'slowed'} ${name} dispatch pacing to ${Math.round(p.mult * 100)}%`,
      });
  }

  return out.sort((a, b) => b.t - a.t);
}
