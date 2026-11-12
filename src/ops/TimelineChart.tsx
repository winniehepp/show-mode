import { useState } from 'react';
import { Panel, Segmented } from '../components/ui';
import { MODE_LABEL, PUBLISHED_END, T_END, VENUES } from '../sim/config';
import { clock } from '../sim/format';
import { useSim } from '../state/SimContext';
import { useComparison, type PresetMode } from './useComparison';

const T0 = PUBLISHED_END - 15; // 11:15 PM
const T1 = T_END;
const W = 460;
const H = 170;
const PAD = { l: 30, r: 10, t: 10, b: 20 };

/** Requests/min (bars) vs pickups/min (lines) for each mode on the same night. */
export function TimelineChart() {
  const { state, sim } = useSim();
  const cmp = useComparison();
  const [hover, setHover] = useState<number | null>(null);
  const [show, setShow] = useState<'all' | PresetMode>('all');

  const reqs = sim.snaps.slice(T0, T1).map((s) => s.requests);
  const series: { mode: PresetMode; data: number[]; stroke: string; dash?: string; width: number }[] = [
    { mode: 'software', data: cmp.software.snaps.slice(T0, T1).map((s) => s.pickups), stroke: '#6b7280', width: 2 },
    { mode: 'full', data: cmp.full.snaps.slice(T0, T1).map((s) => s.pickups), stroke: '#111', width: 2.5 },
  ];
  // Mid-size venues don't offer Full Show Mode.
  const offered = series.filter((s) => VENUES[state.venue].pilot || s.mode !== 'full');
  const visible = offered.filter((s) => show === 'all' || s.mode === show);
  const max = Math.ceil(Math.max(20, ...reqs, ...visible.flatMap((s) => s.data)) / 20) * 20;
  const x = (i: number) => PAD.l + (i / (T1 - T0 - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const bw = (W - PAD.l - PAD.r) / (T1 - T0) - 1;
  const now = Math.floor(state.t) - T0;
  const smooth = (d: number[]) =>
    d.map((_, i) => d.slice(Math.max(0, i - 1), i + 2).reduce((a, b) => a + b, 0) / d.slice(Math.max(0, i - 1), i + 2).length);
  const h = hover;

  return (
    <Panel
      title="Requests vs pickups / min"
      right={
        <Segmented
          size="sm"
          value={show}
          onChange={setShow}
          options={[
            { value: 'all', label: 'All modes' },
            { value: 'software', label: 'Software' },
            { value: 'full', label: 'Full' },
          ]}
        />
      }
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="max-h-[230px] w-full"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (T1 - T0 - 1));
            setHover(i >= 0 && i < T1 - T0 ? i : null);
          }}
        >
          {[0, 0.5, 1].map((p) => (
            <g key={p}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(max * p)} y2={y(max * p)} stroke="#f0f1f3" />
              <text x={PAD.l - 4} y={y(max * p) + 3} fontSize="9" textAnchor="end" fill="#9ca3af">
                {Math.round(max * p)}
              </text>
            </g>
          ))}
          {[0, 15, 30, 45, 60].map((i) => (
            <text key={i} x={x(i)} y={H - 6} fontSize="9" textAnchor="middle" fill="#9ca3af">
              {clock(T0 + i, false)}
            </text>
          ))}
          {reqs.map((r, i) => (
            <rect
              key={i}
              x={x(i) - bw / 2}
              y={y(r)}
              width={Math.max(1, bw)}
              height={Math.max(0, H - PAD.b - y(r))}
              rx={Math.min(2, bw / 2)}
              fill="#e5e7eb"
            />
          ))}
          {visible.map((s) => (
            <polyline
              key={s.mode}
              fill="none"
              stroke={s.stroke}
              strokeWidth={s.width}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
              points={smooth(s.data)
                .map((v, i) => `${x(i)},${y(v)}`)
                .join(' ')}
            />
          ))}
          {visible.map((s) => {
            const sm = smooth(s.data);
            // Each mode's label sits where that line is clear of the others.
            const at = { full: sm.indexOf(Math.max(...sm)), software: 56 }[s.mode];
            const pk = Math.min(at, sm.length - 1);
            return (
              <text key={`l${s.mode}`} x={Math.min(W - 60, x(pk) + 4)} y={y(sm[pk]) - 4} fontSize="9" fontWeight="600" fill="#374151">
                {MODE_LABEL[s.mode]}
              </text>
            );
          })}
          {now >= 0 && now < T1 - T0 && <line x1={x(now)} x2={x(now)} y1={PAD.t} y2={H - PAD.b} stroke="#111" strokeDasharray="2 2" />}
          {h !== null && (
            <g>
              <line x1={x(h)} x2={x(h)} y1={PAD.t} y2={H - PAD.b} stroke="#9ca3af" />
              {visible.map((s) => (
                <circle key={s.mode} cx={x(h)} cy={y(smooth(s.data)[h])} r="4" fill={s.stroke} stroke="#fff" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
        {h !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] shadow"
            style={{ left: `${Math.min(70, (x(h) / W) * 100)}%` }}
          >
            <div className="font-semibold">{clock(T0 + h)}</div>
            <div className="text-gray-500">Requests {reqs[h].toFixed(0)}/min</div>
            {visible.map((s) => (
              <div key={s.mode}>
                {MODE_LABEL[s.mode]}: <b>{s.data[h].toFixed(0)}</b> pickups
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10.5px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-gray-200" />
          Ride requests
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-2 border-gray-500" />
          Software only
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-[2.5px] border-black" />
          Full Show Mode
        </span>
      </div>
    </Panel>
  );
}
