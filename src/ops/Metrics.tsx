import { cx } from '../components/ui';
import { PUBLISHED_END, venueFeatures } from '../sim/config';
import { int, money, pct } from '../sim/format';
import { useSim } from '../state/SimContext';

export function Metrics() {
  const { snap, state } = useSim();
  const f = venueFeatures(state.venue, state.features);
  const queue = snap.zones.A.queue + snap.zones.B.queue;
  const p90 = snap.p90Cum;
  const p90Health = p90 === null ? 'text-gray-400' : p90 > 15 ? 'text-red-600' : p90 > 10 ? 'text-amber-600' : 'text-emerald-600';
  const tiles = [
    {
      k: 'Riders in queue',
      v: int(queue),
      sub: `X ${int(snap.zones.A.lanes.X.queue + snap.zones.B.lanes.X.queue)} · XL ${int(snap.zones.A.lanes.XL.queue + snap.zones.B.lanes.XL.queue)}`,
    },
    {
      k: 'Trip completion',
      v: pct(snap.completion),
      sub: 'completed / finished',
      cls: snap.completion < 0.85 ? 'text-red-600' : undefined,
    },
    {
      k: 'P90 heading out → in car',
      v: p90 === null ? '–' : `${p90} min`,
      sub: 'north star · incl. still waiting',
      north: true,
      cls: p90Health,
    },
    { k: 'Pickups / min', v: snap.pickups.toFixed(0), sub: `${int(snap.pickupsCum)} total` },
    {
      k: 'Cancellation rate',
      v: pct(snap.cancelRate),
      sub: `${int(snap.cancelsCum)} cancelled`,
      cls: snap.cancelRate > 0.15 ? 'text-red-600' : undefined,
    },
    {
      k: 'Staged / active drivers',
      v: `${f.staging ? int(snap.staged) : '–'} / ${int(snap.active)}`,
      sub: f.staging ? `XL staged ${int(snap.stagedByType.XL)}` : 'no staging lot',
    },
    {
      k: 'Staging fill vs. target',
      v: f.staging ? `${Math.round(snap.stagingFill * 100)}%` : '–',
      sub: f.staging ? 'peak staged / 120' : 'no staging lot',
      cls: f.staging && snap.t >= PUBLISHED_END - 15 && snap.stagingFill < 0.8 ? 'text-amber-600' : undefined,
    },
    {
      k: 'Average price',
      v: snap.avgPrice ? money(snap.avgPrice) : '–',
      sub: 'X + XL · no surge',
    },
  ];
  return (
    <div className="grid grid-cols-8 gap-2">
      {tiles.map((x) => (
        <div key={x.k} className={cx('rounded-xl border bg-white p-2.5', x.north ? 'border-black ring-1 ring-black' : 'border-gray-200')}>
          <div className="text-[11px] font-medium leading-tight text-gray-500">{x.k}</div>
          <div className={cx('mt-0.5 text-[22px] font-bold leading-tight tabular-nums', x.cls)}>{x.v}</div>
          <div className="truncate text-[10.5px] text-gray-400">{x.sub}</div>
        </div>
      ))}
    </div>
  );
}
