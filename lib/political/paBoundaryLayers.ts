/**
 * Boundary layers shim — re-exports from the active state config.
 * All boundary layer data now lives in lib/config/states/<state>.ts.
 */

import { activeState } from '@/lib/config/activeState';

export const BOUNDARY_LAYERS = activeState.boundaryLayers;

export const AVAILABLE_BOUNDARY_TYPES = Object.values(BOUNDARY_LAYERS)
  .filter((layer) => layer.hasData)
  .map((layer) => layer.type);
