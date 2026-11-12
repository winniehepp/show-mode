import { MODE_LABEL, VENUES } from '../sim/config';
import { clock } from '../sim/format';
import { useSim } from '../state/SimContext';
import { AlertsFeed } from './AlertsFeed';
import { ComparisonPanel } from './ComparisonPanel';
import { ForecastPanel } from './ForecastPanel';
import { Levers } from './Levers';
import { MapPanel } from './MapPanel';
import { Metrics } from './Metrics';
import { TimelineChart } from './TimelineChart';
import { ZoneCard } from './ZoneCard';

export function OpsView() {
  const { state, mode } = useSim();
  const v = VENUES[state.venue];
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">Ops event view</span>
        <span className="text-[12px] text-gray-400">City ops dashboard › Events › {v.name}</span>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-2.5">
        <div className="flex items-center justify-between rounded-xl bg-black px-3 py-2 text-white">
          <div>
            <div className="text-[14px] font-bold">{v.name} · Concert · event layer</div>
            <div className="text-[11px] text-gray-400">
              Overlay on the existing city dashboard, not new infrastructure · {v.capacity.toLocaleString()} capacity
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[16px] font-semibold">{clock(state.t)}</div>
            <div className="text-[11px] text-gray-400">{MODE_LABEL[mode]}</div>
          </div>
        </div>
        <Metrics />
        <div className="grid grid-cols-[1fr_1fr_1.15fr] gap-2.5">
          <ZoneCard zone="A" />
          <ZoneCard zone="B" />
          <MapPanel />
        </div>
        <div className="grid grid-cols-[0.85fr_1.5fr_1fr] gap-2.5">
          <ForecastPanel />
          <TimelineChart />
          <AlertsFeed />
        </div>
        <div className="grid grid-cols-[1fr_1.15fr] gap-2.5">
          <Levers />
          <ComparisonPanel />
        </div>
      </div>
    </div>
  );
}
