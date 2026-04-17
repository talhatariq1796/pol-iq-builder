/**
 * California build config.
 *
 * Data notes (from client delivery, April 2026):
 *  - 2020 election data: ca_2020.geojson (EPSG:3857, VEST format)
 *    Fields: COUNTY, CNTY_CODE, FIPS_CODE (4-digit: "6001" = state 6 + county 001),
 *            SRPREC_KEY, SRPREC, G20PREDBID (Biden), G20PRERTRU (Trump)
 *  - 2022/2024 shapefiles: geometry + identifiers only — NO vote data
 *  - All TIGER boundary layers: EPSG:4269 (≈ WGS84 for PIP purposes)
 *  - Demographics: Esri ACS 2025 layers (EPSG:3857) in ca_layers_geojson/
 *
 * UNIQUE_ID format: "<countyFP3>-:-<srprec>"
 *   e.g. "001-:-481430"  (Alameda county, precinct 481430)
 */

import type { StateBuildConfig } from '../types/state-build-config';

const DATA_DIR = 'public/data/political/california';
const RAW = `${DATA_DIR}/CA_GIS_Data`;

/** Build UNIQUE_ID from ca_2020 feature properties. */
function buildCaUniqueId(props: Record<string, unknown>): string {
  // FIPS_CODE is 4-digit (e.g. "6001" = CA state 6 + county "001")
  const fips = String(props.FIPS_CODE ?? '').padStart(5, '0');
  const countyFp = fips.slice(2); // "001"
  const srprec = String(props.SRPREC ?? '');
  return `${countyFp}-:-${srprec}`;
}

export const californiaConfig: StateBuildConfig = {
  stateAbbr: 'CA',
  stateName: 'California',
  dataDir: DATA_DIR,

  // -------------------------------------------------------------------------
  // Organize steps: run once to transform raw data → app folder structure
  // -------------------------------------------------------------------------
  organizeSteps: [
    // Primary precinct file: reproject 2020 VEST data from 3857 → WGS84
    // and inject UNIQUE_ID / COUNTYFP / VTDST for downstream compatibility
    {
      type: 'reproject',
      src: 'CA_GIS_Data/ca_2020_geojson/ca_2020.geojson',
      dst: 'precincts/ca_precincts.geojson',
      srcCrs: '3857',
      addFields: (props) => {
        const fips = String(props.FIPS_CODE ?? '').padStart(5, '0');
        const countyFp = fips.slice(2);
        const srprec = String(props.SRPREC ?? '');
        return {
          UNIQUE_ID: `${countyFp}-:-${srprec}`,
          COUNTYFP: countyFp,
          VTDST: srprec,
          NAME: `${props.COUNTY ?? ''} - ${srprec}`,
        };
      },
    },

    // District boundary layers (Census TIGER, already WGS84/NAD83)
    { type: 'copy', src: 'CA_GIS_Data/CA_Assembly_geojson/tl_2022_06_sldl.geojson',       dst: 'districts/ca_state_assembly.geojson' },
    { type: 'copy', src: 'CA_GIS_Data/CA_Senate_geojson/tl_2022_06_sldu.geojson',          dst: 'districts/ca_state_senate.geojson' },
    { type: 'copy', src: 'CA_GIS_Data/CA_Congressional_geojson/tl_2022_06_cd118.geojson', dst: 'districts/ca_congressional.geojson' },
    { type: 'copy', src: 'CA_GIS_Data/CA_Municipalities_geojson/tl_2022_06_place.geojson', dst: 'districts/ca_municipalities.geojson' },
    { type: 'copy', src: 'CA_GIS_Data/CA_SchoolDistricts_geojson/tl_2022_06_unsd.geojson', dst: 'districts/ca_school_districts.geojson' },
    { type: 'copy', src: 'CA_GIS_Data/CA_Tracts_geojson/tl_2022_06_tract.geojson',         dst: 'census-tracts/ca_census_tracts.geojson' },

    // ZIP codes: filter national ZCTA file to CA-only (90001–96162)
    {
      type: 'filter',
      src: 'CA_GIS_Data/ca_zcta_geojson/tl_2022_us_zcta520.geojson',
      dst: 'districts/ca_zip_codes.geojson',
      keep: (props) => {
        const code = parseInt(String(props.ZCTA5CE20 ?? ''), 10);
        return code >= 90001 && code <= 96162;
      },
    },

    // Block groups: copy to block-groups/ for the split script to operate on
    // After this step, run: npm run split-geojson -- public/data/political/california/block-groups/ca_block_groups.geojson --max-mb=95
    { type: 'copy', src: 'CA_GIS_Data/CA_BlockGroups_geojson/tl_2022_06_bg.geojson', dst: 'block-groups/ca_block_groups.geojson' },

    // Demographics: copy Esri ACS 2025 layers to expected directory
    {
      type: 'dir-copy',
      srcDir: 'CA_GIS_Data/ca_layers_geojson',
      dstDir: 'demographics/CA_Demographics_2025',
      prefix: 'CA_2025_',
    },
    {
      type: 'dir-copy',
      srcDir: 'CA_GIS_Data/ca_layers_geojson',
      dstDir: 'demographics/CA_Demographics_2025',
      prefix: 'CA_2023_',
    },
  ],

  // -------------------------------------------------------------------------
  // Primary precinct geometry (after organize step)
  // -------------------------------------------------------------------------
  precincts: {
    file: 'precincts/ca_precincts.geojson',
    uniqueIdField: 'UNIQUE_ID',
    countyFipsField: 'COUNTYFP',
    vtdstField: 'VTDST',
    nameField: 'NAME',
  },

  // -------------------------------------------------------------------------
  // Election data sources
  // Note: only 2020 has vote data in the delivered files. The 2022/2024
  // shapefiles contain geometry+identifiers only; add supplemental CSVs
  // here if vote data becomes available later.
  // -------------------------------------------------------------------------
  elections: [
    {
      year: '2020',
      date: '2020-11-03',
      type: 'general',
      office: 'President',
      // The primary precinct file IS the 2020 election data (same source)
      file: 'precincts/ca_precincts.geojson',
      demField: 'G20PREDBID',
      repField: 'G20PRERTRU',
      // countyField / precinctField not needed: this file IS the primary
    },
  ],

  // -------------------------------------------------------------------------
  // Demographics (Esri ACS 2025, EPSG:3857)
  // -------------------------------------------------------------------------
  demographics: {
    dir: 'demographics/CA_Demographics_2025',
    files: {
      totalPopulation: 'CA_2025_Total_Population.geojson',
      educBase:        'CA_2025_Educational_Attainment_Base.geojson',
      hs:              'CA_2025_Pop_Age_25__High_School_Diploma.geojson',
      someCollege:     null, // delivered file was empty
      bach:            'CA_2025_Pop_Age_25__Bachelor_s_Degree____.geojson',
      grad:            'CA_2025_Pop_Age_25__Grad_Professional_Degree____.geojson',
      medianIncome:    'CA_2025_Median_Household_Income.geojson',
      medianHomeValue: 'CA_2025_Median_Home_Value.geojson',
      medianAge:       null, // no dedicated median age layer delivered
    },
    fields: {
      geoid:          'ID',
      totalPop:       'TOTPOP_CY',
      educBase:       'EDUCBASECY',
      hs:             'HSGRAD_CY',
      someCollege:    'SMCOLL_CY',
      bach:           'BACHDEG_CY',
      grad:           'GRADDEG_CY',
      medianIncome:   'MEDHINC_CY',
      medianHomeValue:'MEDVAL_CY',
      medianAge:      'MEDAGE_CY',
    },
  },

  // -------------------------------------------------------------------------
  // District layers for crosswalk (all Census TIGER, EPSG:4269 ≈ WGS84)
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
    demographics:    'precincts/ca_precinct_demographics.json',
    districtCrosswalk: 'precincts/ca_precinct_district_crosswalk.json',
    h3Json:          'precincts/ca_h3_aggregates.json',
    h3GeoJSON:       'precincts/ca_h3_aggregates.geojson',
  },
};
