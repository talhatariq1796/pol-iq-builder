/**
 * Pennsylvania boundary layers for the Select tab (precincts, districts, etc.).
 * All paths are under /public/data/political/pensylvania/.
 */

import type { BoundaryLayerConfig, BoundaryLayerType } from '@/types/political';

const PA = '/data/political/pensylvania';

export const BOUNDARY_LAYERS: Record<BoundaryLayerType, BoundaryLayerConfig> = {
  precinct: {
    type: 'precinct',
    displayName: 'Precinct',
    pluralName: 'Precincts',
    source: 'Pennsylvania election results (2020 presidential)',
    idField: 'UNIQUE_ID',
    nameField: 'NAME',
    dataPath: `${PA}/pa_2020_presidential.geojson`,
    color: '#6366f1',
    hasData: true,
  },
  'zip-code': {
    type: 'zip-code',
    displayName: 'ZIP Code',
    pluralName: 'ZIP Codes',
    source: 'U.S. Census Bureau / PA GIS',
    idField: 'ZIP_CODE',
    nameField: 'ZIP_CODE',
    dataPath: `${PA}/pa_zip_codes.geojson`,
    color: '#8b5cf6',
    hasData: true,
  },
  'block-group': {
    type: 'block-group',
    displayName: 'Block Group',
    pluralName: 'Block Groups',
    source: 'U.S. Census Bureau',
    idField: 'GEOID',
    nameField: 'NAMELSAD',
    dataPath: `${PA}/pa_block_groups.part000.geojson`,
    dataPaths: [
      `${PA}/pa_block_groups.part000.geojson`,
      `${PA}/pa_block_groups.part001.geojson`,
    ],
    color: '#06b6d4',
    hasData: true,
  },
  'census-tract': {
    type: 'census-tract',
    displayName: 'Census Tract',
    pluralName: 'Census Tracts',
    source: 'U.S. Census Bureau',
    idField: 'GEOID',
    nameField: 'NAMELSAD',
    dataPath: `${PA}/pa_census_tracts.geojson`,
    color: '#14b8a6',
    hasData: true,
  },
  'state-house': {
    type: 'state-house',
    displayName: 'State House District',
    pluralName: 'State House Districts',
    source: 'Pennsylvania legislative boundaries',
    idField: 'LEG_DISTRI',
    nameField: 'LEG_DISTRI',
    dataPath: `${PA}/pa_state_house.geojson`,
    color: '#f59e0b',
    hasData: true,
  },
  'state-senate': {
    type: 'state-senate',
    displayName: 'State Senate District',
    pluralName: 'State Senate Districts',
    source: 'Pennsylvania legislative boundaries',
    idField: 'LEG_DISTRI',
    nameField: 'LEG_DISTRI',
    dataPath: `${PA}/pa_state_senate.geojson`,
    color: '#ef4444',
    hasData: true,
  },
  congressional: {
    type: 'congressional',
    displayName: 'Congressional District',
    pluralName: 'Congressional Districts',
    source: 'U.S. Census Bureau / PA congressional boundaries',
    idField: 'LEG_DISTRI',
    nameField: 'LEG_DISTRI',
    dataPath: `${PA}/pa_congressional.geojson`,
    color: '#3b82f6',
    hasData: true,
  },
  municipality: {
    type: 'municipality',
    displayName: 'Municipality',
    pluralName: 'Municipalities',
    source: 'PA DCED / municipal GIS',
    idField: 'GEOID',
    nameField: 'MUNICIPAL1',
    dataPath: `${PA}/pa_municipalities.geojson`,
    color: '#22c55e',
    hasData: true,
  },
  township: {
    type: 'township',
    displayName: 'Township/City',
    pluralName: 'Townships & Cities',
    source: 'PA DCED / municipal GIS',
    idField: 'GEOID',
    nameField: 'MUNICIPAL1',
    dataPath: `${PA}/pa_municipalities.geojson`,
    color: '#84cc16',
    hasData: false,
  },
  'school-district': {
    type: 'school-district',
    displayName: 'School District',
    pluralName: 'School Districts',
    source: 'Pennsylvania Department of Education / GIS',
    idField: 'AUN_NUM',
    nameField: 'SCHOOL_NAM',
    dataPath: `${PA}/pa_school_districts.geojson`,
    color: '#f97316',
    hasData: true,
  },
};

export const AVAILABLE_BOUNDARY_TYPES = Object.values(BOUNDARY_LAYERS)
  .filter((layer) => layer.hasData)
  .map((layer) => layer.type);
