/**
 * Boundary type definitions and metadata
 * for split screen comparison tool
 */

import type { BoundaryTypeInfo } from './types';

/**
 * Available boundary types for comparison
 *
 * Available types have data loaded and ready to use.
 * Unavailable types are shown but disabled with "Data coming soon" message.
 */
export const BOUNDARY_TYPES: BoundaryTypeInfo[] = [
  {
    value: 'precincts',
    label: 'Precincts',
    description: 'Voting precincts - finest electoral geography (77 precincts)',
    entityType: 'precinct',
    available: true,
    dataSource: 'ingham_precincts.json',
  },
  {
    value: 'municipalities',
    label: 'Municipalities',
    description: 'Cities and townships (21 jurisdictions)',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'ingham_municipalities.json',
  },
  {
    value: 'state_house',
    label: 'State House Districts',
    description: 'Michigan State House districts (5 districts in Ingham)',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'ingham_state_house.json',
  },
  {
    value: 'state_senate',
    label: 'State Senate Districts',
    description: 'Michigan State Senate districts (24th district)',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'ingham_state_senate.json',
  },
  {
    value: 'congressional',
    label: 'Congressional Districts',
    description: 'U.S. Congressional districts (MI-7)',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'ingham_congressional.json',
  },
  {
    value: 'school_districts',
    label: 'School Districts',
    description: 'K-12 school district boundaries',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'ingham_school_districts.geojson',
  },
  {
    value: 'county',
    label: 'Counties',
    description: 'County boundaries (Ingham County)',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'ingham_county.json',
  },
  {
    value: 'zip_codes',
    label: 'ZIP Codes',
    description: 'U.S. Postal Service ZIP code areas',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'ingham_zip_codes.json',
  },
];

/**
 * Get boundary type info by value
 */
export function getBoundaryTypeInfo(value: string): BoundaryTypeInfo | undefined {
  return BOUNDARY_TYPES.find((type) => type.value === value);
}

/**
 * Get available boundary types only
 */
export function getAvailableBoundaryTypes(): BoundaryTypeInfo[] {
  return BOUNDARY_TYPES.filter((type) => type.available);
}

/**
 * Check if a boundary type is available
 */
export function isBoundaryTypeAvailable(value: string): boolean {
  const type = getBoundaryTypeInfo(value);
  return type?.available ?? false;
}
