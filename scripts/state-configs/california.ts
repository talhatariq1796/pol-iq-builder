/**
 * California build config.
 *
 * Current app-ready layout, April 2026:
 * - 2020 presidential vote data lives in precincts/ca_precincts.part*.geojson
 *   fields G20PREDBID (Biden) and G20PRERTRU (Trump). 2020 registration was
 *   not delivered, so 2020 turnout is intentionally unavailable.
 * - 2024 presidential VBM/turnout data has been merged into
 *   precincts/ca_precinct_election_history.json from CA_2024_VBM_Analysis.
 * - mprec_state_g22_v01_shp and mprec_state_g24_v01_shp were delivered as
 *   boundary/identifier-only shapefiles; they do not contain vote totals.
 * - The repo now stores app-ready public/data/political/california outputs.
 *
 * UNIQUE_ID format: "<countyFP3>-:-<srprec>"
 *   e.g. "001-:-481430" (Alameda county, precinct 481430)
 */

import type { StateBuildConfig } from '../types/state-build-config';

const DATA_DIR = 'public/data/political/california';

export const californiaConfig: StateBuildConfig = {
  stateAbbr: 'CA',
  stateName: 'California',
  dataDir: DATA_DIR,

  // Current CA data is already organized in public/data/political/california.
  // No raw import step is needed for the current app-ready CA workspace.
  organizeSteps: [],

  // -------------------------------------------------------------------------
  // Primary precinct geometry
  // -------------------------------------------------------------------------
  precincts: {
    file: 'precincts/ca_precincts.manifest.json',
    uniqueIdField: 'UNIQUE_ID',
    countyFipsField: 'COUNTYFP',
    vtdstField: 'VTDST',
    nameField: 'NAME',
  },

  // -------------------------------------------------------------------------
  // Election data sources
  // -------------------------------------------------------------------------
  // The live app reads precincts/ca_precinct_election_history.json. This entry
  // documents the source fields used for 2020 vote conversion.
  elections: [
    {
      year: '2020',
      date: '2020-11-03',
      type: 'general',
      office: 'President',
      file: 'precincts/ca_precincts.manifest.json',
      demField: 'G20PREDBID',
      repField: 'G20PRERTRU',
    },
  ],

  // -------------------------------------------------------------------------
  // Demographics (Esri ACS 2025 layers already copied into app layout)
  // -------------------------------------------------------------------------
  demographics: {
    dir: 'demographics/CA_Demographics_2025',
    files: {
      totalPopulation: 'CA_2025_Total_Population.geojson',
      educBase: 'CA_2025_Educational_Attainment_Base.geojson',
      hs: 'CA_2025_Pop_Age_25__High_School_Diploma.geojson',
      someCollege: null,
      bach: 'CA_2025_Pop_Age_25__Bachelor_s_Degree____.geojson',
      grad: 'CA_2025_Pop_Age_25__Grad_Professional_Degree____.geojson',
      medianIncome: 'CA_2025_Median_Household_Income.geojson',
      medianHomeValue: 'CA_2025_Median_Home_Value.geojson',
      medianAge: null,
      tapestrySegment: 'CA_2025_Dom_Tapestry_Segment_Name.geojson',
      tapestryLifeMode: 'CA_2025_Dominant_LifeMode_Grp_Code.geojson',
      tapestryUrbanicity: 'CA_2025_Dominant_Urbancity_Type_Name.geojson',
    },
    fields: {
      geoid: 'ID',
      totalPop: 'TOTPOP_CY',
      educBase: 'EDUCBASECY',
      hs: 'HSGRAD_CY',
      someCollege: 'SMCOLL_CY',
      bach: 'BACHDEG_CY',
      grad: 'GRADDEG_CY',
      medianIncome: 'MEDHINC_CY',
      medianHomeValue: 'MEDVAL_CY',
      medianAge: 'MEDAGE_CY',
      tapestryValue: 'thematic_value',
    },
  },

  // -------------------------------------------------------------------------
  // District layers for crosswalk
  // -------------------------------------------------------------------------
  districts: {
    stateHouse: {
      file: 'districts/ca_state_assembly.geojson',
      idField: 'SLDLST',
      nameField: 'NAMELSAD',
      slugPrefix: 'ca-assembly',
      crs: 'wgs84',
    },
    stateSenate: {
      file: 'districts/ca_state_senate.geojson',
      idField: 'SLDUST',
      nameField: 'NAMELSAD',
      slugPrefix: 'ca-senate',
      crs: 'wgs84',
    },
    congressional: {
      file: 'districts/ca_congressional.geojson',
      idField: 'CD118FP',
      nameField: 'NAMELSAD20',
      slugPrefix: 'ca-congress',
      padWidth: 2,
      crs: 'wgs84',
    },
    municipality: {
      file: 'districts/ca_municipalities.geojson',
      nameField: 'NAME',
      geoidField: 'GEOID',
      crs: 'wgs84',
    },
    schoolDistrict: {
      file: 'districts/ca_school_districts.geojson',
      idField: 'UNSDLEA',
      nameField: 'NAME',
      slugPrefix: 'ca-sd',
      crs: 'wgs84',
    },
    zipCode: {
      file: 'districts/ca_zip_codes.geojson',
      idField: 'ZCTA5CE20',
      slugPrefix: 'ca-zip',
      crs: 'wgs84',
    },
  },

  // -------------------------------------------------------------------------
  // Output file paths (relative to dataDir)
  // -------------------------------------------------------------------------
  outputFiles: {
    targetingScores: 'precincts/precinct_targeting_scores.json',
    electionHistory: 'precincts/ca_precinct_election_history.json',
    demographics: 'precincts/ca_precinct_demographics.json',
    districtCrosswalk: 'precincts/ca_precinct_district_crosswalk.json',
    h3Json: 'precincts/ca_h3_aggregates.json',
    h3GeoJSON: 'precincts/ca_h3_aggregates.geojson',
  },
};
