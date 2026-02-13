/**
 * Constants for donor analysis module
 */

/**
 * Ingham County, Michigan ZIP codes
 * These are the ZIP codes included in the MVP study area
 */
export const INGHAM_COUNTY_ZIPS = [
  '48821', // Bath
  '48823', // East Lansing
  '48824', // East Lansing (MSU)
  '48825', // East Lansing
  '48826', // East Lansing
  '48837', // Grand Ledge
  '48840', // Haslett
  '48842', // Holt
  '48854', // Mason
  '48864', // Okemos
  '48895', // Williamston
  '48906', // Lansing
  '48910', // Lansing
  '48911', // Lansing
  '48912', // Lansing
  '48915', // Lansing
  '48917', // Lansing
  '48921', // Lansing
  '48922', // Lansing
  '48924', // Lansing
  '48929', // Lansing
  '48930', // Lansing
  '48933', // Lansing
  '48937', // Lansing
  '48951', // Lansing
  '48956', // Lansing
] as const;

/**
 * Election cycles for filtering
 */
export const ELECTION_CYCLES = [
  '2024',
  '2022',
  '2020',
  '2018',
  '2016',
] as const;

/**
 * Default filter values
 */
export const DEFAULT_FILTERS = {
  cycle: '2024',
  party: 'all' as const,
  view: 'table' as const,
  minAmount: 0,
  maxAmount: Infinity,
};
