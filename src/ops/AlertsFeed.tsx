import { useMemo } from 'react';
import { Panel, cx } from '../components/ui';
import { alertsUntil } from '../sim/alerts';
import { clock } from '../sim/format';
import { useSim } from '../state/SimContext';

const ICON = { red: '▲', amber: '●', info: 'i' };
const STYLE = {
  red: 'border-red-200 bg-red-50 text-red-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-gray-200 bg-white text-gray-700',
};

export function AlertsFeed() {
  const { sim, state } = useSim();
  const now = Math.floor(state.t);
  const alerts = useMemo(() => alertsUntil(sim, now), [sim, now]);
  return (
    <Panel title="Alerts" right={<span className="text-[11px] text-gray-400">{alerts.length} so far</span>}>
      <ul className="no-scrollbar max-h-[200px] space-y-1.5 overflow-y-auto">
        {alerts.length === 0 && <li className="text-[12px] text-gray-400">All quiet.</li>}
        {alerts.map((a) => (
          <li key={a.id} className={cx('rounded-lg border px-2 py-1.5 text-[12px] leading-snug', STYLE[a.level])}>
            <div className="flex gap-1.5">
              <span className="w-3 shrink-0 text-center font-bold">{ICON[a.level]}</span>
              <span className="flex-1 font-semibold">{a.text}</span>
              <span className="shrink-0 font-mono text-[10px] opacity-70">{clock(a.t, false)}</span>
            </div>
            {a.hint && <div className="pl-[18px] text-[11px] opacity-80">{a.hint}</div>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
