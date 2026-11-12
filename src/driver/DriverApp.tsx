import type { ReactNode } from 'react';
import { PhoneFrame } from '../components/PhoneFrame';
import { cx } from '../components/ui';
import { CityMap, fitCamera, type Camera, type MapProps } from '../map/CityMap';
import { journey } from '../map/journey';
import { MapScreen, PHONE_H, PHONE_W } from '../map/MapScreen';
import { ARENA, HOME, STAGING, type Pt } from '../map/world';
import { CAR } from '../rider/RiderApp';
import { MAYA_PARTY, RIDE_LABEL, STAGING_OPEN, VENUES, XL_SHARE, stagingTarget } from '../sim/config';
import { clock, money, money2 } from '../sim/format';
import { stageAt, type DriverStage } from '../sim/story';
import type { Features } from '../sim/types';
import { useSim } from '../state/SimContext';

export const DRIVER_LABEL: Record<DriverStage, string> = {
  preview: 'Event preview',
  staging: 'Staging lot',
  nearby: 'Online nearby',
  dispatch: 'Dispatch',
  atSpot: 'At the spot',
  trip: 'On trip',
  earnings: 'Earnings',
};

export function driverLabel(stage: DriverStage, f: Features) {
  return stage === 'atSpot' && !f.spots ? 'At the zone' : DRIVER_LABEL[stage];
}

const VISIBLE = 0.58;
// Street-level only, like the base maps rideshare apps use: no bay-by-bay lot detail.
const MAX_ZOOM = 1.5;
const fit = (pts: Pt[], maxZoom = 2) => fitCamera(pts, PHONE_W, PHONE_H * VISIBLE, maxZoom, 36);

export function DriverApp() {
  const { state, story, sim, snap, dispatch } = useSim();
  const f = state.features;
  const v = VENUES[state.venue];
  const cur = stageAt(story.driver, state.t);
  const steps = story.driver.map((s) => ({ label: driverLabel(s.stage, f), start: s.start }));
  const t = Math.floor(state.t);
  const zone = state.mayaZone;
  const target = f.spots ? `Spot ${story.spot}` : `Zone ${zone}`;
  // Dev drives the ride type Maya picked (an XL for her group of six).
  const rideType = state.mayaType;
  const rideName = RIDE_LABEL[rideType];
  const party = rideType === 'XL' ? MAYA_PARTY : 1;
  const stagedFrom = STAGING_OPEN + 5;
  const fare = sim.maya.price * 0.72;
  const j = journey(state.t, story, f, zone);
  const z = snap.zones;

  /* ---- map ---- */
  const base: MapProps = {
    venue: v.name,
    theme: 'dark',
    camera: { x: ARENA.cx, y: ARENA.cy, zoom: 0.8 },
    visible: VISIBLE,
    width: PHONE_W,
    height: PHONE_H,
    stagingOn: f.staging,
    closure: true,
    baseMap: true,
    showGates: false,
    car: j.dev,
    traffic: { n: Math.min(14, (z.A.enRoute + z.B.enRoute) / 25), t: state.t },
  };
  let map: MapProps = base;
  let camera: Camera = base.camera;
  let nav: string | null = null;
  switch (cur.stage) {
    case 'preview':
      map = {
        ...base,
        traffic: undefined,
        pins: [{ pos: [ARENA.cx, ARENA.cy - 70], label: `~${v.demand.toLocaleString()} rides tonight` }],
      };
      camera = fit([[ARENA.cx - 80, ARENA.cy - 80], j.devStart, ...(f.staging ? [[STAGING.x + 112, STAGING.y + 116] as Pt] : [])], 1);
      break;
    case 'staging':
      camera = fit(
        [
          [STAGING.x - 90, STAGING.y - 90],
          [STAGING.x + STAGING.w + 60, STAGING.y + STAGING.h + 60],
        ],
        1,
      );
      break;
    case 'nearby':
      camera = fit([j.devStart, [ARENA.cx, ARENA.cy + 120]], 1);
      break;
    case 'dispatch':
      map = {
        ...base,
        route: [j.dev.pos, ...j.toSpot.pts.slice(j.dev.seg + 1)],
        pickup: { pos: j.pickupPt, label: target },
        zoneFocus: zone,
      };
      camera = fit([j.dev.pos, j.pickupPt], MAX_ZOOM);
      nav = j.toSpot.steps[Math.min(j.dev.seg, j.toSpot.steps.length - 1)];
      break;
    case 'atSpot':
      map = { ...base, you: j.maya.pos, pickup: { pos: j.pickupPt, label: target }, zoneFocus: zone };
      camera = { x: j.pickupPt[0], y: j.pickupPt[1] - 20, zoom: MAX_ZOOM };
      break;
    case 'trip':
      map = { ...base, route: [j.dev.pos, ...j.home.pts.slice(j.dev.seg + 1)], pins: [{ pos: HOME, label: 'Drop-off' }] };
      camera = { x: j.dev.pos[0], y: j.dev.pos[1], zoom: 0.95 };
      nav = j.home.steps[Math.min(j.dev.seg, j.home.steps.length - 1)];
      break;
    case 'earnings':
      map = { ...base, traffic: undefined };
      camera = { x: HOME[0], y: HOME[1] + 60, zoom: 1 };
      break;
  }

  /* ---- floating top ---- */
  const top = (
    <>
      {nav ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-black px-3 py-2.5 text-white shadow-lg">
          <span className="text-[22px] leading-none">{/left/i.test(nav) ? '↰' : /right/i.test(nav) ? '↱' : '↑'}</span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold leading-tight">{nav}</div>
            {cur.stage === 'dispatch' && (
              <div className="text-[11px] font-medium text-emerald-400">Preset route avoids the Pier St closure</div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-[11px] font-bold text-white shadow-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Online · {rideName}
          </span>
          <span className="rounded-full bg-black px-3 py-1.5 font-mono text-[12px] font-bold text-white shadow-md">
            {money2(cur.stage === 'earnings' ? fare : 0)}
          </span>
        </div>
      )}
    </>
  );

  /* ---- bottom sheet ---- */
  let sheet: ReactNode;
  switch (cur.stage) {
    case 'preview':
      sheet = (
        <>
          <Kicker>Event tonight</Kicker>
          <Title>{v.name} concert</Title>
          <Rows
            rows={[
              ['Rides after the show', `~${v.demand.toLocaleString()} · ~${Math.round(XL_SHARE * 100)}% XL`],
              ['Show ends', `~${clock(state.expectedEnd)}`],
              ...(f.staging ? ([['Staging lot opens', `${clock(STAGING_OPEN)} · Lot 7`]] as [string, string][]) : []),
            ]}
          />
          <Note>
            {f.staging
              ? 'Staged drivers get priority dispatch, like an airport waiting lot. You’re sent when a rider is ready, not into a jam.'
              : 'Show Mode paces dispatch to what the curb can load. You’re sent when a rider is ready, not into a jam.'}
          </Note>
          <Primary onClick={() => dispatch({ type: 'setT', t: (story.driver[1]?.start ?? STAGING_OPEN) + 0.5 })}>
            {f.staging ? 'Navigate to staging lot' : 'Go online nearby'}
          </Primary>
        </>
      );
      break;
    case 'staging': {
      const releaseIn = Math.max(1, story.devDispatch - t);
      // Dev joined early, so he starts partway up his ride type's queue and moves up as releases begin.
      const startPos = Math.max(1, Math.round(stagingTarget(state.venue)[rideType] * 0.4));
      const span = Math.max(1, story.devDispatch - sim.actualEnd);
      const pos = t < sim.actualEnd ? startPos : Math.max(1, Math.round((startPos * (story.devDispatch - t)) / span));
      const inLine = (type: typeof rideType) => Math.round(snap.stagedByType[type]);
      sheet = (
        <>
          <Kicker>Lot 7 · staging queue</Kicker>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(['X', 'XL'] as const).map((type) => (
              <div key={type} className={cx('rounded-lg p-2', type === rideType ? 'bg-white text-black' : 'bg-white/10')}>
                <div className={cx('text-[11px] font-semibold', type === rideType ? 'text-gray-500' : 'text-neutral-400')}>
                  {RIDE_LABEL[type]} queue
                </div>
                {type === rideType ? (
                  <div className="text-[26px] font-bold leading-none tracking-tight">
                    #{pos}
                    <span className="ml-1 text-[12px] font-semibold text-gray-500">of {Math.max(pos, inLine(type))}</span>
                  </div>
                ) : (
                  <div className="text-[26px] font-bold leading-none tracking-tight">
                    {inLine(type)}
                    <span className="ml-1 text-[12px] font-semibold text-neutral-400">drivers</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div
            className={cx(
              'mt-2.5 rounded-lg px-3 py-2 text-[12.5px]',
              snap.held ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 text-neutral-200',
            )}
          >
            {snap.held
              ? 'Release on hold: the show is running late. You keep your place in line.'
              : t < sim.actualEnd
                ? `Show ends ~${clock(state.expectedEnd)}. Staged drivers get priority dispatch when riders head out.`
                : `Release expected in about ${releaseIn} min. Drivers go in batches by ride type as spots free up.`}
          </div>
        </>
      );
      break;
    }
    case 'nearby':
      sheet = (
        <>
          <Kicker>Online · downtown</Kicker>
          <Title>Show Mode demand ahead</Title>
          <Rows
            rows={[
              [`Zone ${zone} release pace`, `~${z[zone].cap.toFixed(0)} cars/min`],
              [`${rideName} line in Zone ${zone}`, `${Math.round(z[zone].lanes[rideType].queue)} riders`],
              ['Drive to the zone', `~${story.devTravel} min`],
            ]}
          />
        </>
      );
      break;
    case 'dispatch': {
      const eta = Math.max(1, story.devArrive - t);
      sheet = (
        <>
          <div className="flex items-start justify-between">
            <div>
              <Kicker>{sim.maya.fromStaging ? 'Priority release from staging' : 'Released · picking up'}</Kicker>
              <Title>Maya · {target}</Title>
            </div>
            <div className="text-right">
              <div className="text-[22px] font-bold leading-none">{eta}</div>
              <div className="text-[11px] text-neutral-400">min</div>
            </div>
          </div>
          <Rows
            rows={[
              ['Rider', `Maya · party of ${party} · ${rideName}`],
              ['Fare', money(fare)],
            ]}
          />
        </>
      );
      break;
    }
    case 'atSpot': {
      const secs = Math.max(0, (story.pickup - state.t) * 60);
      sheet = (
        <>
          <div className="flex items-start justify-between">
            <div>
              <Kicker>Arrived · {target}</Kicker>
              <Title>Pick up Maya</Title>
              <div className="-mt-1 mb-1.5 text-[12px] text-neutral-400">
                Party of {party} · {rideName} · {CAR[rideType]}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[20px] font-bold tabular-nums">
                {Math.floor(secs / 60)}:{String(Math.floor(secs % 60)).padStart(2, '0')}
              </div>
              <div className="text-[11px] text-neutral-400">wait left</div>
            </div>
          </div>
          {f.codes ? (
            <div className="rounded-xl bg-white/10 p-2.5 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Ask for her code</div>
              <div className="font-mono text-[34px] font-bold leading-tight tracking-[0.18em]">{story.code}</div>
              <button
                onClick={() => dispatch({ type: 'driver', patch: { codeConfirmed: true } })}
                className={cx(
                  'mt-1 h-10 w-full rounded-lg font-bold',
                  state.driver.codeConfirmed ? 'bg-emerald-500 text-white' : 'bg-white text-black',
                )}
              >
                {state.driver.codeConfirmed ? 'Code confirmed ✓' : 'Confirm code'}
              </button>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-500/20 px-2.5 py-2 text-[12.5px] text-amber-200">
              Can't find rider. Crowded pickup area. Calling Maya…
            </div>
          )}
        </>
      );
      break;
    }
    case 'trip': {
      const p = Math.min(1, (state.t - story.pickup - 1) / story.rideMin);
      sheet = (
        <>
          <Kicker>On trip</Kicker>
          <Title>Dropping off Maya</Title>
          <div className="h-1.5 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(4, p * 100)}%` }} />
          </div>
          <div className="mt-1.5 text-[12px] text-neutral-400">{Math.max(1, Math.round(story.rideMin * (1 - p)))} min · 6.2 mi</div>
        </>
      );
      break;
    }
    case 'earnings': {
      const total = fare;
      const minutesSpent = story.rideEnd - (f.staging ? stagedFrom : story.devDispatch);
      sheet = (
        <>
          <Kicker>Trip complete</Kicker>
          <div className="text-[30px] font-bold leading-tight">{money2(total)}</div>
          <Rows
            rows={[
              [`Trip fare · ${rideName}`, money2(fare)],
              ['Time on this trip', `${minutesSpent} min`],
              ['Effective rate', `${money(total / (minutesSpent / 60))}/hr`],
            ]}
          />
          <Note>
            {f.staging
              ? 'Next pickup: head back to Lot 7 and you’re #3 in the staging queue.'
              : 'Next event pickup available. Head back to the area for another round?'}
          </Note>
        </>
      );
      break;
    }
  }

  return (
    <PhoneFrame title="Driver app" persona="Dev" steps={steps} current={cur.index}>
      <MapScreen dark map={<CityMap {...map} camera={camera} />} top={top} sheet={sheet} />
    </PhoneFrame>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <div className="text-[10.5px] font-semibold uppercase tracking-wider text-neutral-400">{children}</div>;
}
function Title({ children }: { children: ReactNode }) {
  return <h2 className="mb-1.5 text-[19px] font-bold leading-tight tracking-tight">{children}</h2>;
}
function Note({ children }: { children: ReactNode }) {
  return <div className="my-2 rounded-lg bg-white/10 px-2.5 py-2 text-[11.5px] leading-snug text-neutral-300">{children}</div>;
}
function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="divide-y divide-white/10">
      {rows.map(([k, val]) => (
        <div key={k} className="flex justify-between py-1.5 text-[13px]">
          <span className="text-neutral-400">{k}</span>
          <b>{val}</b>
        </div>
      ))}
    </div>
  );
}
function Primary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-2 h-11 w-full rounded-lg bg-white text-[15px] font-bold text-black">
      {children}
    </button>
  );
}
