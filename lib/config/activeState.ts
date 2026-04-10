/**
 * Active state configuration — the single lever for switching states.
 *
 * To switch states:
 *   Set ACTIVE_STATE=california in .env.local (or .env.production)
 *   Valid values: 'pennsylvania' | 'california'
 *
 * No other files need to change when switching states.
 */

import type { StateConfig } from '@/types/stateConfig';
import { pennsylvaniaConfig } from './states/pennsylvania';
import { californiaConfig } from './states/california';

const STATE_CONFIGS: Record<string, StateConfig> = {
  pennsylvania: pennsylvaniaConfig,
  california: californiaConfig,
};

const activeKey = process.env.ACTIVE_STATE?.toLowerCase() ?? 'pennsylvania';

export const activeState: StateConfig =
  STATE_CONFIGS[activeKey] ?? pennsylvaniaConfig;
