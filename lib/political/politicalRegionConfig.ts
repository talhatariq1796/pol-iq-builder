/**
 * Default region labels for political data / PDF.
 * Values come from the active state config; individual env vars still work as overrides.
 */

import { activeState } from '@/lib/config/activeState';

export function getPoliticalRegionEnv(): {
  state: string;
  county: string;
  stateFips: string;
  /** Display name for county summary (e.g. "Pennsylvania" when statewide). */
  summaryAreaName: string;
} {
  return {
    state: process.env.POLITICAL_REPORT_STATE || activeState.name,
    county: process.env.POLITICAL_REPORT_COUNTY || activeState.defaultCounty,
    stateFips: process.env.POLITICAL_STATE_FIPS || activeState.fips,
    summaryAreaName: process.env.POLITICAL_SUMMARY_AREA_NAME || activeState.summaryAreaName,
  };
}

/**
 * Default jurisdiction label for AI/spatial fallbacks when no place is parsed.
 * Uses county from env when set; otherwise statewide summary name (e.g. Pennsylvania).
 */
export function getDefaultPoliticalJurisdictionLabel(): string {
  const { county, state, summaryAreaName } = getPoliticalRegionEnv();
  if (county && county !== 'Statewide' && county.trim() !== '') {
    return `${county} County, ${state}`;
  }
  return summaryAreaName || state;
}

/**
 * One-line location for precinct cards when not using PA-specific formatting.
 */
export function formatPrecinctLocationFallback(countyName?: string | null): string {
  const r = getPoliticalRegionEnv();
  const c = countyName?.trim();
  if (c) return `${c}, ${r.state}`;
  return getDefaultPoliticalJurisdictionLabel();
}
