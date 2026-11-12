import { Panel } from '../components/ui';
import { CityMap, fitCamera } from '../map/CityMap';
import { journey } from '../map/journey';
import { STAGING_OPEN, VENUES } from '../sim/config';
import { int } from '../sim/format';
import { useSim } from '../state/SimContext';

const W = 440;
const H = 240;
const CAMERA = fitCamera(
  [
    [300, 290],
    [800, 705],
  ],
  W,
  H,
  1,
  16,
);

/** The same city map the phones use, with zone health, live traffic, staging, and where Dev and Maya are. */
export function MapPanel() {
  const { snap, state, story } = useSim();
  const f = state.features;
  const v = VENUES[state.venue];
  const z = snap.zones;
  const j = journey(state.t, story, f, state.mayaZone);
  const circling = Math.max(0, z.A.curb - z.A.positions) + Math.max(0, z.B.curb - z.B.positions);
  const devVisible = j.dev.leg === 'toSpot' || j.dev.leg === 'atSpot' || (f.staging && j.dev.leg === 'waiting' && state.t > STAGING_OPEN);

  return (
    <Panel
      title="Live map"
      right={
        <span className="text-[11px] text-gray-400">
          {int(z.A.enRoute + z.B.enRoute)} en route · {int(circling)} circling
        </span>
      }
    >
      <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: `${W} / ${H}` }}>
        <CityMap
          venue={v.name}
          camera={CAMERA}
          width={W}
          height={H}
          iconScale={0.7}
          spotsOn={f.spots}
          stagingOn={f.staging}
          staged={snap.staged}
          closure
          zoneHealth={{ A: z.A.health, B: z.B.health }}
          traffic={{ n: Math.min(24, (z.A.enRoute + z.B.enRoute) / 15), t: state.t }}
          lotFill={{ A: z.A.curb / z.A.positions + 0.15, B: z.B.curb / z.B.positions + 0.15 }}
          car={devVisible ? j.dev : null}
          you={j.maya.pos}
          route={f.staging ? j.toSpot.pts : null}
        />
        {state.scenarios.weakSignal && (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
            Weak signal near Gate 3
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10.5px] text-gray-500">
        <span>Zone outline = health</span>
        <span>Red bar = planned Pier St closure</span>
        {f.staging && <span>Black line = preset staging route</span>}
        <span>▮ Dev</span>
        <span className="text-[#2563eb]">● Maya</span>
      </div>
    </Panel>
  );
}
