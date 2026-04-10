/**
 * County FIPS utilities — reads from the active state config.
 * All county data now lives in lib/config/states/<state>.ts.
 */

import { activeState } from '@/lib/config/activeState';

/** County FIPS map for the active state (3-digit suffix → county name). */
export const PA_COUNTY_FP_TO_NAME: Record<string, string> = activeState.countyFips;

/** County FIPS (3 digits) from canonical precinct key `CCC-:-NAME`. */
export function parsePaCountyFpFromPrecinctKey(canonicalKey: string): string | null {
  const m = /^(\d{3})-:-/.exec(canonicalKey);
  return m ? m[1] : null;
}

/** Format a county name from precinct attributes using the active state's county FIPS map. */
export function formatPaPrecinctLocation(
  attrs: Record<string, unknown> | undefined | null,
): string {
  if (!attrs) return activeState.name;
  const raw = attrs.COUNTYFP;
  if (raw == null || raw === '') return activeState.name;
  const fp = String(raw).padStart(3, '0');
  const name = activeState.countyFips[fp];
  return name ? `${name} County, ${activeState.name}` : activeState.name;
}

/** Returns true if the given attributes belong to the active state's precincts. */
export function isPaPrecinctAttributes(
  attrs: Record<string, unknown> | undefined | null,
): boolean {
  if (!attrs) return false;
  if (attrs.STATEFP === activeState.fips || attrs.STATEFP === Number(activeState.fips)) return true;
  const uid = attrs.UNIQUE_ID;
  if (typeof uid === 'string' && uid.includes('-:-')) return true;
  return false;
}
