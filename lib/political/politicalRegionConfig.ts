/**
 * Default region labels for political data / PDF when not overridden by env.
 * PA-only deployment: set POLITICAL_REPORT_* in .env for other states.
 */

export function getPoliticalRegionEnv(): {
  state: string;
  county: string;
  stateFips: string;
  /** Display name for county summary (e.g. "Pennsylvania" when statewide). */
  summaryAreaName: string;
} {
  return {
    state: process.env.POLITICAL_REPORT_STATE || 'Pennsylvania',
    county: process.env.POLITICAL_REPORT_COUNTY || 'Statewide',
    stateFips: process.env.POLITICAL_STATE_FIPS || '42',
    summaryAreaName: process.env.POLITICAL_SUMMARY_AREA_NAME || 'Pennsylvania',
  };
}
