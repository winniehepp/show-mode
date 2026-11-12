import { useEffect } from 'react';
import { driverLabel } from '../driver/DriverApp';
import { riderLabel } from '../rider/RiderApp';
import { stageAt } from '../sim/story';
import type { Health } from '../sim/types';
import { useSim, VIEWS, type View } from '../state/SimContext';
import { cx, healthDot } from './ui';

const TITLE: Record<View, string> = { rider: 'Rider app', driver: 'Driver app', ops: 'Ops event view' };

/**
 * One view per tab. Every tab shares the clock, so each label also shows where
 * that view is right now, even when it's hidden.
 */
export function ViewTabs() {
  const { state, dispatch, story, snap } = useSim();
  const rider = riderLabel(stageAt(story.rider, state.t).stage, state.features);
  const driver = driverLabel(stageAt(story.driver, state.t).stage, state.features);
  const worst: Health = [snap.zones.A.health, snap.zones.B.health].includes('red')
    ? 'red'
    : [snap.zones.A.health, snap.zones.B.health].includes('amber')
      ? 'amber'
      : 'green';
  const status: Record<View, string> = {
    rider: `Maya · ${rider}`,
    driver: `Dev · ${driver}`,
    ops: snap.p90Cum === null ? 'P90 –' : `P90 ${snap.p90Cum} min`,
  };

  // Keys 1 / 2 / 3 switch tabs (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = ['1', '2', '3'].indexOf(e.key);
      if (i >= 0) dispatch({ type: 'view', view: VIEWS[i] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <nav className="flex gap-1 border-b border-gray-200" role="tablist">
      {VIEWS.map((v, i) => {
        const active = state.view === v;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={active}
            onClick={() => dispatch({ type: 'view', view: v })}
            className={cx(
              '-mb-px flex items-center gap-2.5 rounded-t-lg border px-4 py-2 text-left transition-colors',
              active ? 'border-gray-200 border-b-gray-100 bg-gray-100' : 'border-transparent text-gray-500 hover:text-black',
            )}
          >
            <span
              className={cx(
                'rounded px-1.5 font-mono text-[11px] font-semibold',
                active ? 'bg-black text-white' : 'bg-gray-200 text-gray-600',
              )}
            >
              {i + 1}
            </span>
            <span>
              <span className="block text-[14px] font-bold leading-tight">{TITLE[v]}</span>
              <span className="flex items-center gap-1 text-[11.5px] font-medium text-gray-500">
                {v === 'ops' && <span className={cx('h-1.5 w-1.5 rounded-full', healthDot[worst])} />}
                {status[v]}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
