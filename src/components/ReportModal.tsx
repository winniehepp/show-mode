import { useMemo } from 'react';
import { BASE_FEATURES, MODE_LABEL, VENUES, venueFeatures } from '../sim/config';
import { forecast } from '../sim/engine';
import { clock, int, money, pct } from '../sim/format';
import type { Features } from '../sim/types';
import { simInput, simulate, useSim } from '../state/SimContext';
import { Modal } from './Modal';
import { cx } from './ui';

const STEPS: { key: keyof Features; label: string }[] = [
  { key: 'xlLine', label: 'Separate UberX / UberXL lines' },
  { key: 'codes', label: 'Pickup codes' },
  { key: 'spots', label: 'Numbered spots' },
  { key: 'staging', label: 'Staging lot, priority dispatch' },
];

export function ReportModal() {
  const { state, dispatch, sim, mode } = useSim();
  const open = state.modal === 'report';
  const v = VENUES[state.venue];

  // Feature attribution: start from the virtual queue with one shared line and add each enabled feature in turn.
  const ladder = useMemo(() => {
    if (!open) return [];
    let f: Features = { ...BASE_FEATURES };
    const base = simulate(simInput(state, f)).summary;
    const out = [{ label: 'Queue + pacing, one line (baseline)', p90: base.p90, xl: base.p90ByType.XL, cancel: base.cancelRate, delta: 0 }];
    let prev = base.p90;
    for (const s of STEPS) {
      if (!venueFeatures(state.venue, state.features)[s.key]) continue;
      f = { ...f, [s.key]: true };
      const r = simulate(simInput(state, f)).summary;
      out.push({ label: `+ ${s.label}`, p90: r.p90, xl: r.p90ByType.XL, cancel: r.cancelRate, delta: r.p90 - prev });
      prev = r.p90;
    }
    return out;
  }, [open, state]);

  if (!open) return null;
  const s = sim.summary;
  const maxP90 = Math.max(...ladder.map((l) => l.p90), 1);
  const underfilled = s.stagingFill < 0.8;
  const top = [...ladder.slice(1)].sort((a, b) => a.delta - b.delta)[0];

  return (
    <Modal
      title="Post-event summary"
      sub={`${v.name} · concert · ${MODE_LABEL[mode]} · simulated night`}
      onClose={() => dispatch({ type: 'modal', modal: null })}
    >
      <div className="grid grid-cols-5 gap-3">
        <Tile k="Requests" v={int(s.requests)} sub={`forecast ${int(forecast(state.venue, state.expectedEnd).total)}`} />
        <Tile k="Trip completion" v={pct(s.completion)} sub={`${int(s.trips)} completed`} />
        <Tile
          k="P90 heading out → in car"
          v={`${s.p90} min`}
          sub={`UberX ${s.p90ByType.X} · UberXL ${s.p90ByType.XL} min`}
          strong
        />
        <Tile
          k="Cancellations · avg price"
          v={`${pct(s.cancelRate)} · ${money(s.avgPrice)}`}
          sub="no surge"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <section className="rounded-xl border border-gray-200 p-4">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-gray-500">Worst bottleneck</h3>
          <div className="text-[20px] font-bold">
            Zone {s.worst.zone} at {clock(s.worst.t)}
          </div>
          <div className="text-[13px] text-gray-600">
            P90 wait reached {Math.round(s.worst.p90)} min. Peak demand {s.peakRequests.toFixed(0)} requests/min vs. peak loading{' '}
            {s.peakPickups.toFixed(0)} pickups/min.
          </div>
          <div className="mt-3 text-[13px] text-gray-600">
            Peak queue {int(s.peakQueue)} riders · last pickup {clock(s.lastPickup)}
          </div>
        </section>
        <section className="rounded-xl border border-gray-200 p-4">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-gray-500">Staging fill rate</h3>
          {venueFeatures(state.venue, state.features).staging ? (
            <>
              <div className="text-[20px] font-bold">
                {Math.round(s.stagingFill * 100)}% of target
                <span className="ml-1.5 text-[13px] font-medium text-gray-500">
                  ({int(s.stagingTarget * s.stagingFill)} of {s.stagingTarget} drivers)
                </span>
              </div>
              <div className="text-[13px] text-gray-600">
                {int(s.stagingTrips)} trips dispatched from the staging lot with priority dispatch, no extra pay
                {state.scenarios.encore ? ', including the encore hold' : ''}.
              </div>
              {underfilled && (
                <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[13px] font-semibold text-amber-800">
                  Candidate for driver incentive test
                </div>
              )}
            </>
          ) : (
            <div className="text-[13px] text-gray-500">
              No staging lot tonight{v.pilot ? '' : ' (mid-size venue, software only)'}.
            </div>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-gray-200 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Which features drove the improvement</h3>
          {top && top.delta < 0 && (
            <span className="text-[12px] text-gray-500">
              Biggest single gain: <b className="text-black">{top.label.slice(2)}</b>
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {ladder.map((l, i) => (
            <div key={l.label} className="grid grid-cols-[260px_1fr_70px_70px_90px] items-center gap-3 text-[13px]">
              <span className={cx(i === 0 ? 'font-semibold' : 'text-gray-700')}>{l.label}</span>
              <div className="h-3 rounded-full bg-gray-100">
                <div
                  className={cx('h-full rounded-full', i === 0 ? 'bg-gray-400' : 'bg-black')}
                  style={{ width: `${(l.p90 / maxP90) * 100}%` }}
                />
              </div>
              <span className="text-right font-bold tabular-nums">{l.p90} min</span>
              <span
                className={cx('text-right tabular-nums', l.delta < 0 ? 'text-emerald-600' : l.delta > 0 ? 'text-red-600' : 'text-gray-400')}
              >
                {i === 0 ? '' : `${l.delta > 0 ? '+' : ''}${l.delta} min`}
              </span>
              <span className="text-right text-[12px] tabular-nums text-gray-500">XL {l.xl} min</span>
            </div>
          ))}
          {ladder.length === 1 && <p className="text-[13px] text-gray-500">No Show Mode features on. Switch modes to see attribution.</p>}
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Each row re-runs the same night with one more feature switched on. P90 includes riders still waiting at 12:30 AM; the last column is the UberXL P90.
        </p>
      </section>
    </Modal>
  );
}

function Tile({ k, v, sub, strong }: { k: string; v: string; sub: string; strong?: boolean }) {
  return (
    <div className={cx('rounded-xl border p-3', strong ? 'border-black ring-1 ring-black' : 'border-gray-200')}>
      <div className="text-[12px] text-gray-500">{k}</div>
      <div className="text-[22px] font-bold tabular-nums">{v}</div>
      <div className="text-[11px] text-gray-400">{sub}</div>
    </div>
  );
}
