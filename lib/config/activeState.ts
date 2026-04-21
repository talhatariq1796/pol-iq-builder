/**
 * Active state configuration — the single lever for switching states.
 *
 * To switch states:
 *   Set ACTIVE_STATE=california in .env.local (or .env.production)
 *   Valid values: 'pennsylvania' | 'california'
 *
 * No other files need to change when switching states.
 */

import type { StateConfig } from "@/types/stateConfig";
import { pennsylvaniaConfig } from "./states/pennsylvania";
import { californiaConfig } from "./states/california";

const STATE_CONFIGS: Record<string, StateConfig> = {
  pennsylvania: pennsylvaniaConfig,
  california: californiaConfig,
};

const ACTIVE_STATE = "california"

const activeKey =
  process.env.ACTIVE_STATE?.toLowerCase() ??
  process.env.NEXT_PUBLIC_ACTIVE_STATE?.toLowerCase() ??
  ACTIVE_STATE;

if (!activeKey) {
  throw new Error(
    `ACTIVE_STATE is required. Set it to one of: ${Object.keys(STATE_CONFIGS).join(", ")}.`,
  );
}

const configuredState = STATE_CONFIGS[activeKey];

if (!configuredState) {
  throw new Error(
    `Unsupported ACTIVE_STATE "${activeKey}". Set it to one of: ${Object.keys(STATE_CONFIGS).join(", ")}.`,
  );
}

export const activeState: StateConfig = configuredState;
