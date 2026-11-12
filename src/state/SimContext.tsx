import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { DEFAULT_LEVERS, MODE_FEATURES, NO_SCENARIOS, PUBLISHED_END, T_END, VENUES, deriveMode, venueFeatures } from '../sim/config';
import { runSim } from '../sim/engine';
import { parseClock } from '../sim/format';
import { buildStory, type Story } from '../sim/story';
import type { Features, Levers, ModeId, PaceKey, RideType, Scenarios, SimInput, SimResult, Snap, VenueId, ZoneId } from '../sim/types';

export type Speed = 50 | 100 | 200;
export type Modal = null | 'report' | 'roadmap';
export type View = 'rider' | 'driver' | 'ops';
export const VIEWS: View[] = ['rider', 'driver', 'ops'];

export interface State {
  t: number;
  playing: boolean;
  speed: Speed;
  venue: VenueId;
  features: Features;
  scenarios: Scenarios;
  levers: Levers;
  expectedEnd: number;
  mayaZone: ZoneId;
  mayaType: RideType;
  rider: { codeConfirmed: boolean; driverCancelled: boolean; directions: boolean };
  driver: { codeConfirmed: boolean };
  modal: Modal;
  view: View;
}

export type Action =
  | { type: 'setT'; t: number }
  | { type: 'tick'; dt: number }
  | { type: 'play'; playing: boolean }
  | { type: 'speed'; speed: Speed }
  | { type: 'venue'; venue: VenueId }
  | { type: 'mode'; mode: Exclude<ModeId, 'custom'> }
  | { type: 'feature'; key: keyof Features }
  | { type: 'scenario'; key: keyof Scenarios }
  | { type: 'pacing'; key: PaceKey; mult: number }
  | { type: 'lever'; key: 'overflow' | 'messageB' }
  | { type: 'hold' }
  | { type: 'resetLevers' }
  | { type: 'expectedEnd'; t: number }
  | { type: 'mayaZone'; zone: ZoneId }
  | { type: 'mayaType'; rideType: RideType }
  | { type: 'rider'; patch: Partial<State['rider']> }
  | { type: 'driver'; patch: Partial<State['driver']> }
  | { type: 'modal'; modal: Modal }
  | { type: 'view'; view: View };

const initial: State = {
  t: PUBLISHED_END + 5, // 11:35 PM, the first beat of the demo script
  playing: false,
  speed: 100,
  venue: 'harbor',
  features: { ...MODE_FEATURES.software },
  scenarios: { ...NO_SCENARIOS },
  levers: DEFAULT_LEVERS,
  expectedEnd: PUBLISHED_END,
  mayaZone: 'B',
  mayaType: 'XL',
  rider: { codeConfirmed: false, driverCancelled: false, directions: false },
  driver: { codeConfirmed: false },
  modal: null,
  view: 'rider',
};

/** Deep links for demo prep, e.g. ?mode=full&t=11:50&scen=weakSignal,encore&venue=riverside */
function fromUrl(base: State): State {
  if (typeof window === 'undefined') return base;
  const q = new URLSearchParams(window.location.search);
  let s = base;
  const mode = q.get('mode');
  if (mode === 'software' || mode === 'full') s = { ...s, features: { ...MODE_FEATURES[mode] } };
  for (const k of (q.get('feat') ?? '').split(',').filter(Boolean))
    if (k in s.features) s = { ...s, features: { ...s.features, [k]: true } };
  for (const k of (q.get('scen') ?? '').split(',').filter(Boolean))
    if (k in s.scenarios) s = { ...s, scenarios: { ...s.scenarios, [k]: true } };
  const venue = q.get('venue');
  if (venue === 'harbor' || venue === 'riverside') s = { ...s, venue };
  const t = q.get('t');
  if (t) {
    const parsed = t.includes(':') ? parseClock(t) : Number(t);
    if (parsed !== null && !Number.isNaN(parsed)) s = { ...s, t: clamp(parsed + 0.5) };
  }
  const view = q.get('view');
  if (view && (VIEWS as string[]).includes(view)) s = { ...s, view: view as View };
  if (q.get('modal') === 'report' || q.get('modal') === 'roadmap') s = { ...s, modal: q.get('modal') as Modal };
  return { ...s, features: venueFeatures(s.venue, s.features) };
}

function reducer(s: State, a: Action): State {
  const now = Math.floor(s.t);
  switch (a.type) {
    case 'setT':
      return { ...s, t: clamp(a.t), rider: { ...s.rider, driverCancelled: false, codeConfirmed: false }, driver: { codeConfirmed: false } };
    case 'tick': {
      const t = clamp(s.t + a.dt);
      return { ...s, t, playing: t < T_END - 0.01 && s.playing };
    }
    case 'play':
      return { ...s, playing: a.playing, t: a.playing && s.t >= T_END - 0.01 ? 0 : s.t };
    case 'speed':
      return { ...s, speed: a.speed };
    case 'venue':
      return { ...s, venue: a.venue, features: venueFeatures(a.venue, s.features), levers: DEFAULT_LEVERS };
    case 'mode':
      // Mid-size venues have no numbered spots or staging lot, so Full Show Mode isn't offered there.
      return { ...s, features: venueFeatures(s.venue, { ...MODE_FEATURES[a.mode] }) };
    case 'feature':
      if (!VENUES[s.venue].pilot && (a.key === 'spots' || a.key === 'staging')) return s;
      return { ...s, features: { ...s.features, [a.key]: !s.features[a.key] } };
    case 'scenario': {
      const scenarios = { ...s.scenarios, [a.key]: !s.scenarios[a.key] };
      // Turning off the encore puts the show back on its published schedule.
      const expectedEnd = a.key === 'encore' && !scenarios.encore ? PUBLISHED_END : s.expectedEnd;
      return { ...s, scenarios, expectedEnd };
    }
    case 'pacing':
      return {
        ...s,
        levers: { ...s.levers, pacing: { ...s.levers.pacing, [a.key]: { mult: a.mult, since: now } } },
      };
    case 'lever':
      return { ...s, levers: { ...s.levers, [a.key]: s.levers[a.key] === null ? now : null } };
    case 'hold': {
      const h = s.levers.hold;
      const hold = h === null || h.to !== null ? { from: now, to: null } : { ...h, to: now };
      return { ...s, levers: { ...s.levers, hold } };
    }
    case 'resetLevers':
      return { ...s, levers: DEFAULT_LEVERS };
    case 'expectedEnd':
      return { ...s, expectedEnd: a.t };
    case 'mayaZone':
      return { ...s, mayaZone: a.zone };
    case 'mayaType':
      return { ...s, mayaType: a.rideType };
    case 'rider':
      return { ...s, rider: { ...s.rider, ...a.patch } };
    case 'driver':
      return { ...s, driver: { ...s.driver, ...a.patch } };
    case 'modal':
      return { ...s, modal: a.modal, playing: a.modal ? false : s.playing };
    case 'view':
      return { ...s, view: a.view };
  }
}

function clamp(t: number) {
  return Math.max(0, Math.min(T_END - 0.01, t));
}

export function simInput(s: State, features = s.features): SimInput {
  return {
    venue: s.venue,
    features,
    scenarios: s.scenarios,
    levers: s.levers,
    expectedEnd: s.expectedEnd,
    mayaZone: s.mayaZone,
    mayaType: s.mayaType,
  };
}

const cache = new Map<string, SimResult>();
/** Memoized sim run; the comparison panel and report reuse runs across renders. */
export function simulate(input: SimInput): SimResult {
  const key = JSON.stringify(input);
  let r = cache.get(key);
  if (!r) {
    r = runSim(input);
    if (cache.size > 200) cache.clear();
    cache.set(key, r);
  }
  return r;
}

interface Ctx {
  state: State;
  dispatch: Dispatch<Action>;
  sim: SimResult;
  story: Story;
  snap: Snap;
  mode: ModeId;
}

const SimCtx = createContext<Ctx | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial, fromUrl);
  const input = useMemo(
    () => simInput(state),
    [state.venue, state.features, state.scenarios, state.levers, state.expectedEnd, state.mayaZone, state.mayaType],
  );
  const sim = useMemo(() => simulate(input), [input]);
  const story = useMemo(() => buildStory(sim), [sim]);
  const snap = sim.snaps[Math.min(sim.snaps.length - 1, Math.floor(state.t))];
  const mode = deriveMode(state.features);

  // Playback: `speed` sim minutes per real minute.
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!state.playing) {
      last.current = null;
      return;
    }
    let raf = 0;
    const loop = (ts: number) => {
      if (last.current !== null) dispatch({ type: 'tick', dt: ((ts - last.current) / 60000) * state.speed });
      last.current = ts;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.playing, state.speed]);

  const value = useMemo(() => ({ state, dispatch, sim, story, snap, mode }), [state, sim, story, snap, mode]);
  return <SimCtx.Provider value={value}>{children}</SimCtx.Provider>;
}

export function useSim() {
  const c = useContext(SimCtx);
  if (!c) throw new Error('useSim outside SimProvider');
  return c;
}
