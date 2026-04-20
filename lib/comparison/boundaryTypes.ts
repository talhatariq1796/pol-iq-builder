/**
 * Boundary type definitions and metadata
 * for split screen comparison tool.
 */

import { activeState } from '@/lib/config/activeState';
import type { BoundaryTypeInfo } from './types';

const stateName = activeState.name;
const stateAbbr = activeState.abbreviation;
const lowerChamberLabel = activeState.display.stateLowerChamberLabel;

if (!lowerChamberLabel) {
  throw new Error(
    `Missing display.stateLowerChamberLabel in active state config for ${stateName}`,
  );
}

/**
 * Available boundary types for comparison.
 */
export const BOUNDARY_TYPES: BoundaryTypeInfo[] = [
  {
    value: 'precincts',
    label: 'Precincts',
    description: `${stateName} voting precincts - statewide unified targeting and election history`,
    entityType: 'precinct',
    available: true,
    dataSource: `PoliticalDataService (${stateAbbr} precincts)`,
  },
  {
    value: 'municipalities',
    label: 'Municipalities',
    description: `${stateName} cities and municipalities aggregated from precinct jurisdictions`,
    entityType: 'jurisdiction',
    available: true,
    dataSource: `PoliticalDataService (${stateAbbr} municipalities)`,
  },
  {
    value: 'state_house',
    label: lowerChamberLabel,
    description: `${stateName} state lower chamber districts aggregated from precincts and district crosswalk`,
    entityType: 'jurisdiction',
    available: true,
    dataSource: `PoliticalDataService + ${stateAbbr} precinct-district crosswalk`,
  },
  {
    value: 'state_senate',
    label: 'State Senate Districts',
    description: `${stateName} State Senate districts aggregated from precincts and district crosswalk`,
    entityType: 'jurisdiction',
    available: true,
    dataSource: `PoliticalDataService + ${stateAbbr} precinct-district crosswalk`,
  },
  {
    value: 'congressional',
    label: 'Congressional Districts',
    description: `U.S. House districts in ${stateName} aggregated from precincts and district crosswalk`,
    entityType: 'jurisdiction',
    available: true,
    dataSource: `PoliticalDataService + ${stateAbbr} precinct-district crosswalk`,
  },
  {
    value: 'school_districts',
    label: 'School Districts',
    description: `${stateName} K-12 school districts aggregated from precincts and district crosswalk`,
    entityType: 'jurisdiction',
    available: true,
    dataSource: `PoliticalDataService + ${stateAbbr} precinct-district crosswalk`,
  },
  {
    value: 'county',
    label: 'Counties',
    description: `${stateName} counties aggregated from precinct county FIPS`,
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'PoliticalDataService (COUNTYFP from precinct key)',
  },
  {
    value: 'zip_codes',
    label: 'ZIP Codes',
    description: `${stateName} ZCTA / ZIP areas aggregated from precincts and district crosswalk`,
    entityType: 'jurisdiction',
    available: true,
    dataSource: `PoliticalDataService + ${stateAbbr} precinct-district crosswalk`,
  },
];

/**
 * Get boundary type info by value.
 */
export function getBoundaryTypeInfo(value: string): BoundaryTypeInfo | undefined {
  return BOUNDARY_TYPES.find((type) => type.value === value);
}

/**
 * Get available boundary types only.
 */
export function getAvailableBoundaryTypes(): BoundaryTypeInfo[] {
  return BOUNDARY_TYPES.filter((type) => type.available);
}

/**
 * Check if a boundary type is available.
 */
export function isBoundaryTypeAvailable(value: string): boolean {
  const type = getBoundaryTypeInfo(value);
  return type?.available ?? false;
}
