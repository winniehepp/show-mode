import type { ReactNode } from 'react';
import { clock } from '../sim/format';
import { useSim } from '../state/SimContext';
import { cx } from './ui';

export interface Step {
  label: string;
  start: number;
}

/**
 * A phone with its journey list beside it and a step navigator underneath.
 * Stepping moves the shared clock, so the other views follow along.
 */
export function PhoneFrame({
  title,
  persona,
  weak,
  steps,
  current,
  children,
}: {
  title: string;
  persona: string;
  weak?: boolean;
  steps: Step[];
  current: number;
  children: ReactNode;
}) {
  const { state, dispatch } = useSim();
  const go = (i: number) => {
    const s = steps[Math.max(0, Math.min(steps.length - 1, i))];
    dispatch({ type: 'play', playing: false });
    dispatch({ type: 'setT', t: s.start + 0.5 });
  };

  return (
    <div className="flex items-start gap-10">
      <aside className="w-[260px] shrink-0 pt-2">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{title}</div>
        <div className="mb-3 text-[20px] font-bold tracking-tight">{persona}'s night</div>
        <ol className="space-y-1">
          {steps.map((s, i) => (
            <li key={s.label + i}>
              <button
                onClick={() => go(i)}
                className={cx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
                  i === current ? 'bg-black font-semibold text-white' : 'hover:bg-gray-200',
                  i < current && 'text-gray-400',
                )}
              >
                <span
                  className={cx(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    i === current
                      ? 'bg-white text-black'
                      : i < current
                        ? 'bg-gray-200 text-gray-500'
                        : 'border border-gray-300 text-gray-500',
                  )}
                >
                  {i < current ? '✓' : i + 1}
                </span>
                <span className="flex-1">{s.label}</span>
                <span className={cx('font-mono text-[11px] tabular-nums', i === current ? 'text-gray-300' : 'text-gray-400')}>
                  {clock(s.start, false)}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-3 px-1 text-[11px] leading-snug text-gray-400">
          Click a step or use ‹ › to jump the shared clock. The other tabs stay in sync.
        </p>
      </aside>
      <div className="flex w-[300px] shrink-0 flex-col items-center">
        <div className="relative h-[600px] w-[296px] rounded-[44px] bg-black p-[9px] shadow-xl">
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[36px] bg-white">
            <div className="flex h-9 shrink-0 items-center justify-between px-6 pt-1 text-[12px] font-semibold">
              <span className="tabular-nums">{clock(state.t, false)}</span>
              <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
              <span className="flex items-center gap-1">
                <SignalBars weak={weak} />
                <span className="ml-0.5 inline-block h-2.5 w-5 rounded-[3px] border border-black p-[1px]">
                  <span className="block h-full w-3/5 rounded-[1px] bg-black" />
                </span>
              </span>
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
            <div className="mx-auto mb-1.5 mt-1 h-1 w-24 shrink-0 rounded-full bg-black/80" />
          </div>
        </div>
        <div className="mt-2 flex w-full items-center gap-1">
          <button
            onClick={() => go(current - 1)}
            disabled={current === 0}
            className="rounded-md px-2 py-1 text-[14px] font-bold text-gray-500 hover:bg-gray-200 disabled:opacity-30"
          >
            ‹
          </button>
          <div className="flex flex-1 flex-wrap justify-center gap-1">
            {steps.map((s, i) => (
              <button
                key={s.label + i}
                onClick={() => go(i)}
                title={`${s.label} · ${clock(s.start)}`}
                className={cx('h-2 rounded-full transition-all', i === current ? 'w-5 bg-black' : 'w-2 bg-gray-300 hover:bg-gray-500')}
              />
            ))}
          </div>
          <button
            onClick={() => go(current + 1)}
            disabled={current === steps.length - 1}
            className="rounded-md px-2 py-1 text-[14px] font-bold text-gray-500 hover:bg-gray-200 disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <div className="text-[12px] font-medium text-gray-600">
          {current + 1}/{steps.length} · {steps[current]?.label}
        </div>
      </div>
    </div>
  );
}

function SignalBars({ weak }: { weak?: boolean }) {
  return (
    <span className="flex items-end gap-[1.5px]">
      {[4, 6, 8, 10].map((h, i) => (
        <span key={h} className={cx('w-[3px] rounded-[1px]', weak && i > 0 ? 'bg-gray-300' : 'bg-black')} style={{ height: h }} />
      ))}
    </span>
  );
}
