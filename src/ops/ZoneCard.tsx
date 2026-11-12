import { cx, healthDot, healthLabel, healthText } from '../components/ui';
import { RIDE_LABEL, RIDE_TYPES, VENUES, XL_SPOTS } from '../sim/config';
import { int, mins } from '../sim/format';
import type { Health, ZoneId } from '../sim/types';
import { useSim } from '../state/SimContext';

export function ZoneCard({ zone }: { zone: ZoneId }) {
  const { snap, state, story } = useSim();
  const z = snap.zones[zone];
  const v = VENUES[state.venue];
  const f = state.features;
  const overflow = state.levers.overflow !== null && snap.t >= state.levers.overflow;
  const spots = v.spotsPerZone + (overflow ? 3 : 0);
  // Cars in loading positions, spread across spots deterministically.
  // Cars loading this minute plus cars waiting; some positions are always mid-turnover.
  const occupied = Math.min(z.positions * 0.85, z.curb + z.pickups * 0.8);
  const perSpot = spotFill(occupied, spots, v.carsPerSpot, snap.t + (zone === 'A' ? 0 : 7));
  const pace = state.levers.pacing[zone].mult;
  const mayaZone = state.mayaZone;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[15px] font-bold">Zone {zone}</h3>
        <span className={cx('flex items-center gap-1.5 text-[12px] font-semibold', healthText[z.health])}>
          <span className={cx('h-2 w-2 rounded-full', healthDot[z.health])} />
          {healthLabel[z.health]}
        </span>
      </div>
      <div className="grid grid-cols-[64px_1fr_1fr] gap-1 text-center">
        <span />
        {RIDE_TYPES.map((ty) => (
          <span key={ty} className="text-[11px] font-semibold text-gray-500">
            {RIDE_LABEL[ty]}
            {!f.xlLine && ty === 'XL' && <span className="ml-1 font-medium text-gray-400">(shared line)</span>}
          </span>
        ))}
        <span className="self-center text-left text-[11px] text-gray-500">Queue</span>
        {RIDE_TYPES.map((ty) => (
          <Stat key={ty} v={int(z.lanes[ty].queue)} />
        ))}
        <span className="self-center text-left text-[11px] text-gray-500">P90 wait</span>
        {RIDE_TYPES.map((ty) => (
          <Stat key={ty} v={mins(z.lanes[ty].p90)} cls={healthText[healthOf(z.lanes[ty].p90)]} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-gray-500">
        <span>
          {z.pickups.toFixed(0)} pickups/min · capacity ~{z.cap.toFixed(0)}
        </span>
        <span>
          Pacing {Math.round(pace * 100)}%
          {f.xlLine && state.levers.pacing.XL.mult !== 1 ? ` · XL ${Math.round(state.levers.pacing.XL.mult * 100)}%` : ''}
        </span>
      </div>
      {f.spots ? (
        <div className="mt-2">
          <div className="grid grid-cols-5 gap-1">
            {perSpot.map((n, i) => {
              const label = `${zone}${i + 1}`;
              const state = n === 0 ? 'empty' : n >= v.carsPerSpot ? 'occupied' : 'loading';
              return (
                <div
                  key={label}
                  title={`${label}: ${state}`}
                  className={cx(
                    'rounded-md border px-1 py-0.5 text-[10px] font-bold',
                    state === 'empty' && 'border-gray-200 text-gray-400',
                    state === 'loading' && 'border-emerald-400 bg-emerald-50 text-emerald-700',
                    state === 'occupied' && 'border-black bg-black text-white',
                    label === story.spot && zone === mayaZone && 'ring-2 ring-emerald-500 ring-offset-1',
                    i >= v.spotsPerZone && 'border-dashed',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>{label}</span>
                    {i >= v.spotsPerZone - XL_SPOTS && i < v.spotsPerZone && <span className="text-[8px] opacity-70">XL</span>}
                  </div>
                  <div className="mt-0.5 flex gap-[2px]">
                    {Array.from({ length: v.carsPerSpot }).map((_, k) => (
                      <span
                        key={k}
                        className={cx(
                          'h-1 flex-1 rounded-full',
                          k < n ? (state === 'occupied' ? 'bg-white' : 'bg-emerald-500') : 'bg-gray-200',
                        )}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-3 text-[10px] text-gray-500">
            <Legend cls="border border-gray-300" l="Empty" />
            <Legend cls="bg-emerald-400" l="Loading" />
            <Legend cls="bg-black" l="Full" />
          </div>
        </div>
      ) : (
        <div className="mt-2 rounded-lg bg-gray-50 p-2 text-[11px] text-gray-500">
          Open lot, no numbered spots. {int(z.enRoute)} cars heading in, {int(z.curb)} at the curb
          {z.curb > z.positions ? `, ${int(z.curb - z.positions)} circling` : ''}.
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div
              className={cx('h-full', z.curb > z.positions ? 'bg-red-500' : 'bg-black')}
              style={{ width: `${Math.min(100, (z.curb / z.positions) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ v, cls }: { v: string; cls?: string }) {
  return <div className={cx('rounded-lg bg-gray-50 py-1 text-[17px] font-bold tabular-nums', cls)}>{v}</div>;
}

function healthOf(p90: number | null): Health {
  return p90 === null ? 'green' : p90 > 15 ? 'red' : p90 > 10 ? 'amber' : 'green';
}

function Legend({ cls, l }: { cls: string; l: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cx('h-2 w-2 rounded-sm', cls)} />
      {l}
    </span>
  );
}

function spotFill(cars: number, spots: number, per: number, seed: number): number[] {
  const out = new Array(spots).fill(0);
  let left = Math.round(cars);
  // Deterministic shuffle so the grid looks alive but stays stable within a minute.
  const order = Array.from({ length: spots }, (_, i) => i).sort((a, b) => hash(a + seed * 31) - hash(b + seed * 31));
  for (const i of order) {
    if (left <= 0) break;
    const k = Math.min(left, 1 + Math.floor(hash(i + seed * 7) * per));
    out[i] = k;
    left -= k;
  }
  for (const i of order) {
    if (left <= 0) break;
    const k = Math.min(left, per - out[i]);
    out[i] += k;
    left -= k;
  }
  return out;
}

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
