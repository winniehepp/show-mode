import { useState } from 'react';
import { Panel, cx } from '../components/ui';
import { VENUES, XL_SHARE } from '../sim/config';
import { forecast } from '../sim/engine';
import { clock, int } from '../sim/format';
import { useSim } from '../state/SimContext';

const W = 300;
const H = 120;
const PAD = { l: 26, r: 4, t: 8, b: 16 };
const X_FILL = '#d1d5db';
const XL_FILL = '#111111';

/** Pre-event demand forecast by 15-minute window, with actual requests overlaid once the night is under way. */
export function ForecastPanel() {
  const { state, sim } = useSim();
  const [hover, setHover] = useState<number | null>(null);
  const v = VENUES[state.venue];
  const fc = forecast(state.venue, state.expectedEnd);
  const t = Math.floor(state.t);
  const actual = fc.windows.map((w) => {
    let n = 0;
    for (let m = w.start; m < Math.min(w.start + 15, t + 1); m++) n += sim.snaps[m]?.requests ?? 0;
    return t >= w.start ? n : null;
  });
  const max = Math.ceil(Math.max(...fc.windows.map((w) => w.requests), ...actual.map((a) => a ?? 0)) / 200) * 200;
  const slot = (W - PAD.l - PAD.r) / fc.windows.length;
  const bw = slot - 10;
  const y = (n: number) => H - PAD.b - (n / max) * (H - PAD.t - PAD.b);
  const preEvent = t < state.expectedEnd - 15;

  return (
    <Panel
      title="Demand forecast"
      right={
        <span className={cx('rounded px-1.5 py-0.5 text-[10px] font-semibold', preEvent ? 'bg-black text-white' : 'bg-gray-100 text-gray-500')}>
          {preEvent ? 'Before the event' : 'Forecast vs. actual'}
        </span>
      }
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[20px] font-bold tabular-nums">{int(fc.total)} requests</div>
        <div className="text-[12px] text-gray-500">~{Math.round(XL_SHARE * 100)}% UberXL</div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((p) => (
            <g key={p}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(max * p)} y2={y(max * p)} stroke="#f0f1f3" />
              <text x={PAD.l - 4} y={y(max * p) + 3} fontSize="8" textAnchor="end" fill="#9ca3af">
                {int(max * p)}
              </text>
            </g>
          ))}
          {fc.windows.map((w, i) => {
            const x = PAD.l + i * slot + 5;
            const xlTop = y(w.xl);
            const total = y(w.requests);
            const a = actual[i];
            return (
              <g key={w.start} onMouseEnter={() => setHover(i)}>
                <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} fill="transparent" />
                {/* XL at the base, UberX stacked on top, separated by a 2px surface gap */}
                <rect x={x} y={y(w.xl)} width={bw} height={H - PAD.b - y(w.xl)} fill={XL_FILL} />
                <rect x={x} y={total} width={bw} height={Math.max(0, xlTop - total - 2)} rx={3} fill={X_FILL} />
                {a !== null && <line x1={x - 3} x2={x + bw + 3} y1={y(a)} y2={y(a)} stroke="#10b981" strokeWidth={2} />}
                <text x={x + bw / 2} y={H - 4} fontSize="8" textAnchor="middle" fill="#6b7280">
                  {clock(w.start, false)}
                </text>
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] shadow"
            style={{ left: `${Math.min(55, ((PAD.l + hover * slot) / W) * 100)}%` }}
          >
            <div className="font-semibold">
              {clock(fc.windows[hover].start)}–{clock(fc.windows[hover].start + 15)}
            </div>
            <div>
              Forecast <b>{int(fc.windows[hover].requests)}</b> · XL {int(fc.windows[hover].xl)}
            </div>
            {actual[hover] !== null && (
              <div className="text-emerald-700">
                Actual so far <b>{int(actual[hover]!)}</b>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10.5px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: X_FILL }} />
          UberX
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: XL_FILL }} />
          UberXL
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 border-t-2 border-emerald-500" />
          Actual
        </span>
      </div>
      <div className="mt-1.5 rounded-lg bg-gray-50 px-2 py-1.5 text-[11.5px]">
        {v.pilot ? (
          <>
            Recommended staging: <b>{fc.staged.X} UberX</b> + <b>{fc.staged.XL} UberXL</b> drivers
          </>
        ) : (
          'Mid-size venue: no staging lot, software only'
        )}
      </div>
      <p className="mt-1 text-[10px] text-gray-400">Based on past shows at this venue plus ticket totals shared by the venue.</p>
    </Panel>
  );
}
