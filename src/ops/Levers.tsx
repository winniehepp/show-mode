import { useEffect, useState } from 'react';
import { Btn, Panel, Segmented, cx } from '../components/ui';
import { PUBLISHED_END } from '../sim/config';
import { clock, parseClock } from '../sim/format';
import type { PaceKey } from '../sim/types';
import { useSim } from '../state/SimContext';

export function Levers() {
  const { state, dispatch } = useSim();
  const typePacing = state.features.xlLine;
  const L = state.levers;
  const held = L.hold !== null && L.hold.to === null;
  const [end, setEnd] = useState(clock(state.expectedEnd));
  useEffect(() => setEnd(clock(state.expectedEnd)), [state.expectedEnd]);
  const parsed = parseClock(end);

  return (
    <Panel
      title="Manual controls"
      right={
        <button onClick={() => dispatch({ type: 'resetLevers' })} className="text-[11px] font-medium text-gray-400 hover:text-black">
          Reset
        </button>
      }
    >
      <div className="space-y-2">
        {(['A', 'B', 'X', 'XL'] as PaceKey[]).map((k) => (
          <div key={k} className={cx('flex items-center justify-between gap-2', (k === 'X' || k === 'XL') && !typePacing && 'opacity-40')}>
            <span className="text-[12px] font-medium">
              {k === 'X' || k === 'XL' ? `Uber${k} pacing` : `Zone ${k} pacing`}
              {(k === 'X' || k === 'XL') && !typePacing && <span className="ml-1 text-[10px] text-gray-400">needs XL line</span>}
            </span>
            <Segmented
              size="sm"
              value={L.pacing[k].mult}
              onChange={(mult) => (typePacing || k === 'A' || k === 'B') && dispatch({ type: 'pacing', key: k, mult })}
              options={[
                { value: 0.8, label: 'Slow' },
                { value: 1, label: 'Normal' },
                { value: 1.2, label: 'Fast' },
              ]}
            />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-1.5">
          <LeverBtn on={L.overflow !== null} onClick={() => dispatch({ type: 'lever', key: 'overflow' })}>
            Open overflow spots
          </LeverBtn>
          <LeverBtn on={held} onClick={() => dispatch({ type: 'hold' })}>
            {held ? 'Release staged drivers' : 'Hold staged drivers'}
          </LeverBtn>
          <LeverBtn on={L.messageB !== null} onClick={() => dispatch({ type: 'lever', key: 'messageB' })}>
            Message Zone B → try A
          </LeverBtn>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[12px] font-medium">Expected show end</span>
            <span className="text-[10px] text-gray-400">published {clock(PUBLISHED_END)} + venue texts</span>
          </div>
          <div className="flex gap-1.5">
            <input
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={cx(
                'w-full rounded-md border bg-white px-2 py-1 font-mono text-[13px]',
                parsed === null ? 'border-red-400' : 'border-gray-300',
              )}
            />
            <Btn
              disabled={parsed === null || parsed === state.expectedEnd}
              onClick={() => parsed !== null && dispatch({ type: 'expectedEnd', t: parsed })}
            >
              Update
            </Btn>
          </div>
        </div>
        <p className="text-[10.5px] text-gray-400">Controls apply from the current minute forward.</p>
      </div>
    </Panel>
  );
}

function LeverBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'rounded-lg border px-2 py-1.5 text-left text-[12px] font-semibold transition-colors',
        on ? 'border-black bg-black text-white' : 'border-gray-300 bg-white hover:border-black',
      )}
    >
      {children}
    </button>
  );
}
