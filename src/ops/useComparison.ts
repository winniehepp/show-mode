import { useMemo } from 'react';
import { MODE_FEATURES } from '../sim/config';
import type { SimResult } from '../sim/types';
import { simInput, simulate, useSim } from '../state/SimContext';

export type PresetMode = 'software' | 'full';
export const PRESETS: PresetMode[] = ['software', 'full'];

/** The same night (venue, scenarios, levers) run under each mode. */
export function useComparison(): Record<PresetMode, SimResult> {
  const { state } = useSim();
  return useMemo(() => {
    const out = {} as Record<PresetMode, SimResult>;
    for (const m of PRESETS) out[m] = simulate(simInput(state, MODE_FEATURES[m]));
    return out;
  }, [state.venue, state.features, state.scenarios, state.levers, state.expectedEnd, state.mayaZone, state.mayaType]);
}
