import { MODE_LABEL, PUBLISHED_END, STAGING_OPEN, T_END, VENUES } from '../sim/config';
import { clock } from '../sim/format';
import type { Features, Scenarios } from '../sim/types';
import { useSim, type Speed } from '../state/SimContext';
import { Btn, Mark, Segmented, Toggle, cx } from './ui';

const FEATURES: { key: keyof Features; label: string; pilotOnly?: boolean }[] = [
  { key: 'xlLine', label: 'Separate XL line' },
  { key: 'codes', label: 'Pickup codes' },
  { key: 'spots', label: 'Numbered spots', pilotOnly: true },
  { key: 'staging', label: 'Staging lot', pilotOnly: true },
];

const SCENARIOS: { key: keyof Scenarios; label: string }[] = [
  { key: 'encore', label: 'Encore runs 15 min late' },
  { key: 'weakSignal', label: 'Weak cell service' },
  { key: 'zoneBOverload', label: 'Zone B overloaded' },
  { key: 'stagingUnderfilled', label: 'Staging lot under-filled' },
];

export function ControlBar() {
  const { state, dispatch, mode, sim, story } = useSim();
  const pilot = VENUES[state.venue].pilot;
  const marks = [
    { t: STAGING_OPEN, label: 'Staging opens' },
    { t: sim.actualEnd, label: 'Show ends' },
    { t: story.join, label: 'Maya heads out' },
  ];
  const playing = state.playing;

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="flex items-center gap-4 px-4 pt-2.5">
        <div className="flex items-center gap-2">
          <Mark className="h-7 w-7 text-black" />
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight">Show Mode</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Event pickup MVP · prototype</div>
          </div>
        </div>
        <select
          value={state.venue}
          onChange={(e) => dispatch({ type: 'venue', venue: e.target.value as 'harbor' | 'riverside' })}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[13px] font-semibold"
        >
          <option value="harbor">Harbor Arena · 18,000 · pilot</option>
          <option value="riverside">Riverside Hall · 11,000 · mid-size</option>
        </select>

        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Segmented
            value={mode === 'custom' ? ('custom' as const) : mode}
            onChange={(m) => m !== 'custom' && dispatch({ type: 'mode', mode: m })}
            options={[
              { value: 'software' as const, label: 'Software only' },
              {
                value: 'full' as const,
                label: 'Full Show Mode',
                disabled: !pilot,
                title: pilot ? undefined : 'Numbered spots and staging run at large pilot venues only',
              },
            ]}
          />
          {mode === 'custom' && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">{MODE_LABEL.custom}</span>
          )}
          <Btn variant="outline" onClick={() => dispatch({ type: 'modal', modal: 'report' })}>
            Post-event summary
          </Btn>
          <Btn variant="outline" onClick={() => dispatch({ type: 'modal', modal: 'roadmap' })}>
            Roadmap
          </Btn>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 pt-1.5">
        <button
          onClick={() => dispatch({ type: 'play', playing: !playing })}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white hover:bg-gray-800"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="ml-0.5 h-4 w-4" fill="currentColor">
              <path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z" />
            </svg>
          )}
        </button>
        <div className="w-[104px] shrink-0 whitespace-nowrap font-mono text-[20px] font-semibold tabular-nums">{clock(state.t)}</div>
        <div className="relative flex-1 pb-4 pt-1">
          {/* Every label but the last sits left of its mark, so labels close together never collide. */}
          <input
            type="range"
            min={0}
            max={T_END - 1}
            step={1}
            value={Math.floor(state.t)}
            onChange={(e) => dispatch({ type: 'setT', t: Number(e.target.value) + 0.5 })}
            className="scrubber w-full"
          />
          {marks.map((m, i) => (
            <button
              key={m.label}
              onClick={() => dispatch({ type: 'setT', t: m.t + 0.5 })}
              className={cx(
                'absolute top-6 whitespace-nowrap text-[10px] font-medium text-gray-500 hover:text-black',
                i === marks.length - 1 ? '' : '-translate-x-full',
              )}
              style={{ left: `${(m.t / (T_END - 1)) * 100}%` }}
            >
              {i === marks.length - 1 ? `▲ ${m.label}` : `${m.label} ▲`}
            </button>
          ))}
          {state.scenarios.encore && (
            <div
              className="pointer-events-none absolute top-[9px] h-1.5 rounded bg-amber-400/70"
              style={{ left: `${(PUBLISHED_END / (T_END - 1)) * 100}%`, width: `${(15 / (T_END - 1)) * 100}%` }}
            />
          )}
        </div>
        <Segmented<Speed>
          size="sm"
          value={state.speed}
          onChange={(speed) => dispatch({ type: 'speed', speed })}
          options={[
            { value: 50, label: '50x' },
            { value: 100, label: '100x' },
            { value: 200, label: '200x' },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pb-2.5 pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Feature switches</span>
          {FEATURES.map((f) => (
            <Toggle
              key={f.key}
              on={state.features[f.key]}
              disabled={f.pilotOnly && !pilot}
              title={f.pilotOnly && !pilot ? 'Large pilot venues only' : undefined}
              onClick={() => dispatch({ type: 'feature', key: f.key })}
            >
              {f.label}
            </Toggle>
          ))}
        </div>
        <div className={cx('flex flex-wrap items-center gap-1.5 border-l border-gray-200 pl-4')}>
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Scenarios</span>
          {SCENARIOS.map((s) => (
            <Toggle key={s.key} on={state.scenarios[s.key]} onClick={() => dispatch({ type: 'scenario', key: s.key })}>
              {s.label}
            </Toggle>
          ))}
        </div>
      </div>
    </header>
  );
}
