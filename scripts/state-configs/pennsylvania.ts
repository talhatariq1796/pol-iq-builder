/**
 * Pennsylvania build config.
 *
 * Data notes:
 *  - All files already organized into precincts/ districts/ block-groups/ etc.
 *  - 2020: pa_2020_presidential.geojson (WGS84, UNIQUE_ID already present)
 *  - 2022: pa_2022_precinct.geojson (WGS84, DEM_VOTES / REP_VOTES)
 *  - 2024: pa_2024_precincts_with_votes.geojson (WGS84, dem_votes / rep_votes)
 *  - Demographics: PA_Demographics_2025 (Esri ACS, EPSG:3857)
 *  - Districts: mix of EPSG:3857 (DCED layers) and WGS84 (TIGER/Census)
 *
 * organizeSteps: left empty — PA data is already in the app folder structure.
 * Run the build scripts directly.
 */

import type { StateBuildConfig } from '../types/state-build-config';

const DATA_DIR = 'public/data/political/pensylvania'; // typo preserved — matches folder

export const pennsylvaniaConfig: StateBuildConfig = {
  stateAbbr: 'PA',
  stateName: 'Pennsylvania',
  dataDir: DATA_DIR,

  // Data is already organised — no organize steps needed.
  organizeSteps: [],

  precincts: {
    file: 'precincts/pa_2020_presidential.geojson',
    uniqueIdField: 'UNIQUE_ID',
    countyFipsField: 'COUNTYFP',
    vtdstField: 'VTDST',
    nameField: 'NAME',
  },

  elections: [
    {
      year: '2020',
      date: '2020-11-03',
      type: 'general',
      office: 'President',
      file: 'precincts/pa_2020_presidential.geojson',
      demField: 'G20PREDBID',
      repField: 'G20PRERTRU',
      registeredDemField: 'G20AUDDAHM',
      registeredRepField: 'G20AUDRDEF',
      countyField: 'COUNTYFP',
      precinctField: 'VTDST',
    },
    {
      year: '2022',
      date: '2022-11-08',
      type: 'midterm',
      office: 'Governor',
      file: 'precincts/pa_2022_precinct.geojson',
      demField: 'DEM_VOTES',
      repField: 'REP_VOTES',
      countyField: 'COUNTYFP20',
      precinctField: 'VTDST20',
    },
    {
      year: '2024',
      date: '2024-11-05',
      type: 'general',
      office: 'President',
      file: 'precincts/pa_2024_precincts_with_votes.geojson',
      demField: 'dem_votes',
      repField: 'rep_votes',
      countyField: 'COUNTYFP20',
      precinctField: 'VTDST20',
    },
  ],

  demographics: {
    dir: 'demographics/PA_Demographics_2025/PA_Demographics_2025',
    files: {
      totalPopulation: null, // separate file: demographics/pa_total_population_2025.geojson
      educBase:        '2025 Educational Attainment Base.geojson',
      hs:              '2025 Pop Age 25+ High School Diploma.geojson',
      someCollege:     '2025 Pop Age 25+ Some College No Degree.geojson',
      bach:            "2025 Pop Age 25+ Bachelor's Degree.geojson",
      grad:            '2025 Pop Age 25+ Grad Professional Degree.geojson',
      medianIncome:    '2025MedianHouseholdIncome.geojson',
      medianHomeValue: '2025MedianHomeValue.geojson',
      medianAge:       '../../pa_median_age.geojson', // relative to demographics.dir
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

  districts: {
    stateHouse: {
      file: 'districts/PaHouse2026_01.geojson',
      idField: 'LEG_DISTRI',
      slugPrefix: 'pa-house',
      crs: '3857',
    },
    stateSenate: {
      file: 'districts/PaSenate2026_01_w_senators.geojson',
      idField: 'SLDUST',
      slugPrefix: 'pa-senate',
      crs: 'wgs84',
    },
    congressional: {
      file: 'districts/PaCongressional2026_01.geojson',
      idField: 'LEG_DISTRI',
      slugPrefix: 'pa-congress',
      padWidth: 2,
      crs: '3857',
    },
    municipality: {
      file: 'districts/PaMunicipalities2026_01.geojson',
      nameField: 'MUNICIPAL1',
      countyField: 'FIPS_COUNT',
      typeField: 'CLASS_OF_M',
      crs: '3857',
    },
    schoolDistrict: {
      file: 'districts/pa_school_districts.geojson',
      idField: 'AUN_NUM',
      nameField: 'SCHOOL_DIS',
      slugPrefix: 'pa-sd',
      crs: 'wgs84',
    },
    zipCode: {
      file: 'districts/pa_zip_codes.geojson',
      idField: 'ZIP_CODE',
      slugPrefix: 'pa-zip',
      crs: 'wgs84',
    },
  },

  outputFiles: {
    targetingScores:   'precincts/precinct_targeting_scores.json',
    electionHistory:   'precincts/pa_precinct_election_history.json',
    demographics:      'precincts/pa_precinct_demographics.json',
    districtCrosswalk: 'precincts/pa_precinct_district_crosswalk.json',
    h3Json:            'precincts/pa_h3_aggregates.json',
    h3GeoJSON:         'precincts/pa_h3_aggregates.geojson',
  },
};
