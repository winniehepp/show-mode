import { Panel, cx } from '../components/ui';
import { MODE_LABEL, VENUES } from '../sim/config';
import { money, pct } from '../sim/format';
import { useSim } from '../state/SimContext';
import { PRESETS, useComparison } from './useComparison';

/** Same simulated night under each mode, side by side. */
export function ComparisonPanel() {
  const { mode, dispatch, state } = useSim();
  const pilot = VENUES[state.venue].pilot;
  const cmp = useComparison();
  const rows = [
    { k: 'Trip completion', get: (m: (typeof PRESETS)[number]) => cmp[m].summary.completion, fmt: pct, higherBetter: true },
    { k: 'P90 wait', get: (m: (typeof PRESETS)[number]) => cmp[m].summary.p90, fmt: (v: number) => `${v} min` },
    { k: 'Cancellations', get: (m: (typeof PRESETS)[number]) => cmp[m].summary.cancelRate, fmt: pct },
    { k: 'Avg price', get: (m: (typeof PRESETS)[number]) => cmp[m].summary.avgPrice, fmt: money },
  ];
  return (
    <Panel title="Mode comparison · same night" right={<span className="text-[11px] text-gray-400">full-night results</span>}>
      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-1.5 gap-y-1.5">
        <span />
        {PRESETS.map((m) => (
          <button
            key={m}
            onClick={() => dispatch({ type: 'mode', mode: m })}
            disabled={m === 'full' && !pilot}
            className={cx(
              'rounded-md px-1 py-1 text-center text-[11px] font-bold',
              mode === m ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
        {rows.map((r) => {
          const offered = PRESETS.filter((m) => pilot || m !== 'full');
          const vals = PRESETS.map(r.get);
          const shown = offered.map(r.get);
          const worst = 'higherBetter' in r ? Math.min(...shown) : Math.max(...shown);
          const best = 'higherBetter' in r ? Math.max(...shown) : Math.min(...shown);
          const scale = Math.max(...shown);
          const tied = Math.abs(worst - best) < 0.005;
          return [
            <span key={r.k} className="pr-1 text-[12px] font-medium text-gray-500">
              {r.k}
            </span>,
            ...PRESETS.map((m, i) =>
              m === 'full' && !pilot ? (
                <div key={r.k + m} className="rounded-md bg-gray-50 px-1.5 py-1 text-center text-[11px] text-gray-400">
                  Large venues only
                </div>
              ) : (
              <div key={r.k + m} className="rounded-md bg-gray-50 px-1.5 py-1">
                <div className="text-center text-[17px] font-bold tabular-nums">{r.fmt(vals[i])}</div>
                <div className="mt-0.5 h-1 rounded-full bg-gray-200">
                  <div
                    className={cx(
                      'h-full rounded-full',
                      tied ? 'bg-gray-500' : vals[i] === best ? 'bg-emerald-500' : 'bg-red-500',
                    )}
                    style={{ width: `${scale > 0 ? Math.max(4, (vals[i] / scale) * 100) : 4}%` }}
                  />
                </div>
              </div>
              ),
            ),
          ];
        })}
      </div>
      <p className="mt-2 text-[10.5px] text-gray-400">
        P90 = 90% of riders were in a car within this time of tapping "I'm heading out". Trip completion counts riders still waiting at 12:30 AM as not completed. Includes current scenarios and controls.
      </p>
    </Panel>
  );
}
