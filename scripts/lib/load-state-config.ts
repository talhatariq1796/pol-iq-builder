/**
 * Load the StateBuildConfig for the requested state.
 *
 * Reads `--state=<name>` from process.argv, falling back to the
 * ACTIVE_STATE environment variable (loaded from .env.local via dotenv).
 *
 * Usage in any build script:
 *   import { loadStateConfig } from './lib/load-state-config';
 *   const cfg = loadStateConfig();
 */

import * as path from 'path';
import * as fs from 'fs';
import type { StateBuildConfig } from '../types/state-build-config';

// Load .env.local so ACTIVE_STATE is available when running with ts-node
function loadDotenv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config({ path: envPath });
  } catch {
    // dotenv not available — rely on process.env already set
  }
}

export function getStateName(): string {
  loadDotenv();

  // Prefer explicit --state= flag
  const flag = process.argv.find(a => a.startsWith('--state='));
  if (flag) return flag.slice('--state='.length).toLowerCase();

  // Fall back to env var
  const env = process.env.ACTIVE_STATE;
  if (env) return env.toLowerCase();

  throw new Error(
    'No state specified. Pass --state=<name> or set ACTIVE_STATE in .env.local.\n' +
    'Available states: california, pennsylvania',
  );
}

export function loadStateConfig(): StateBuildConfig {
  const state = getStateName();

  const configMap: Record<string, () => StateBuildConfig> = {
    california: () => require('../state-configs/california').californiaConfig,
    pennsylvania: () => require('../state-configs/pennsylvania').pennsylvaniaConfig,
  };

  const loader = configMap[state];
  if (!loader) {
    throw new Error(
      `Unknown state "${state}". ` +
      `Available: ${Object.keys(configMap).join(', ')}.\n` +
      `To add a new state, create scripts/state-configs/${state}.ts and register it here.`,
    );
  }

  const cfg = loader();
  console.log(`[load-state-config] Loaded config for: ${cfg.stateName} (${cfg.stateAbbr})`);
  return cfg;
}
