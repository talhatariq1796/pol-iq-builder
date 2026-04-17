/**
 * State Build Config — build-time interface for generating political data assets.
 *
 * Runtime app config (map center, county FIPS, elections schedule) stays in
 * lib/config/states/<state>.ts.  This interface covers only the things the
 * data pipeline scripts need: where raw files live, what field names to use,
 * how to build UNIQUE_IDs.
 *
 * To add a new state:
 *   1. Create scripts/state-configs/<state>.ts implementing StateBuildConfig
 *   2. Register it in scripts/lib/load-state-config.ts
 *   3. Run:  npm run organize:data -- --state=<state>
 *            npm run build:targeting -- --state=<state>
 *            npm run build:demographics -- --state=<state>
 *            npm run build:district-crosswalk -- --state=<state>
 *            npm run build:h3 -- --state=<state>
 */

// ---------------------------------------------------------------------------
// Organize step
// ---------------------------------------------------------------------------

export type CRS = 'wgs84' | '3857' | '4269';

/** Copy a file as-is. */
export interface OrganizeCopy {
  type: 'copy';
  src: string; // relative to state dataDir
  dst: string; // relative to state dataDir
}

/**
 * Reproject a GeoJSON from the given CRS to WGS84 and optionally inject
 * computed fields into every feature's properties.
 */
export interface OrganizeReproject {
  type: 'reproject';
  src: string;
  dst: string;
  srcCrs: '3857' | '4269';
  /** Return extra properties to merge into each feature (e.g. UNIQUE_ID). */
  addFields?: (props: Record<string, unknown>) => Record<string, unknown>;
}

/** Filter a GeoJSON to only features matching a predicate, then write. */
export interface OrganizeFilter {
  type: 'filter';
  src: string;
  dst: string;
  /** Return true to keep the feature. */
  keep: (props: Record<string, unknown>) => boolean;
}

/**
 * Copy every file from a source dir matching an optional glob to a dest dir.
 * Uses a simple prefix match (no recursive glob support needed here).
 */
export interface OrganizeDirCopy {
  type: 'dir-copy';
  srcDir: string;  // relative to state dataDir
  dstDir: string;  // relative to state dataDir
  /** Optional filename prefix filter, e.g. 'CA_2025_' */
  prefix?: string;
}

export type OrganizeOperation =
  | OrganizeCopy
  | OrganizeReproject
  | OrganizeFilter
  | OrganizeDirCopy;

// ---------------------------------------------------------------------------
// Election sources
// ---------------------------------------------------------------------------

export interface ElectionSource {
  year: string;
  date: string;
  type: 'general' | 'midterm';
  office: string;

  /** Path relative to state dataDir. Must exist after the organize step. */
  file: string;
  demField: string;
  repField: string;
  registeredDemField?: string;
  registeredRepField?: string;

  /**
   * Fields used to build the internal join key (county + precinct).
   * The join key is: `${pad(county, countyPad)}_${pad(precinct, precinctPad)}`.
   * Leave undefined if this election's file IS the primary geometry file
   * (the script will use precincts.countyFipsField + precincts.vtdstField).
   */
  countyField?: string;
  precinctField?: string;
  countyPad?: number;    // default 3
  precinctPad?: number;  // default 6
}

// ---------------------------------------------------------------------------
// Precinct config
// ---------------------------------------------------------------------------

export interface PrecinctConfig {
  /** Primary geometry file (relative to dataDir). Must exist after organize. */
  file: string;
  /** Field containing the pre-built UNIQUE_ID string. */
  uniqueIdField: string;
  /** 3-digit county FIPS field (added by organize step if needed). */
  countyFipsField: string;
  /** Precinct code field (used for join key generation). */
  vtdstField: string;
  /** Precinct name field (for display). */
  nameField?: string;
}

// ---------------------------------------------------------------------------
// Demographics config
// ---------------------------------------------------------------------------

export interface DemographicsConfig {
  /**
   * Directory containing demographic layer files (relative to dataDir).
   * For Esri-style ACS layers in EPSG:3857.
   */
  dir: string;

  /**
   * Files within `dir`. Null = file not available (metric will be skipped / 0).
   * Paths are relative to `dir`.
   */
  files: {
    totalPopulation: string | null;
    educBase: string | null;
    hs: string | null;
    someCollege: string | null;
    bach: string | null;
    grad: string | null;
    medianIncome: string | null;
    medianHomeValue: string | null;
    medianAge: string | null;  // separate WGS84 layer; null = skip
    tapestrySegment?: string | null;
    tapestryLifeMode?: string | null;
    tapestryUrbanicity?: string | null;
  };

  /** Field names within each demographic layer (usually identical across states). */
  fields: {
    geoid: string;
    totalPop: string;
    educBase: string;
    hs: string;
    someCollege: string;
    bach: string;
    grad: string;
    medianIncome: string;
    medianHomeValue: string;
    medianAge: string;
    tapestryValue?: string;
  };
}

// ---------------------------------------------------------------------------
// District layers config
// ---------------------------------------------------------------------------

export interface DistrictLayer {
  file: string;        // relative to dataDir
  idField: string;     // the district number / ID field
  nameField?: string;  // display name field
  slugPrefix: string;  // e.g. 'ca-assembly' → slug = 'ca-assembly-32'
  padWidth?: number;   // zero-pad the district number, e.g. 2 → 'ca-congress-07'
  crs?: CRS;           // default wgs84
}

export interface MunicipalityLayer {
  file: string;
  nameField: string;   // field containing city/place name
  geoidField?: string; // GEOID field (used as fallback slug)
  countyField?: string;
  typeField?: string;  // PA: CLASS_OF_M
  crs?: CRS;
}

export interface SchoolDistrictLayer {
  file: string;
  idField: string;     // unique identifier field (e.g. AUN_NUM, GEOID, UNSDLEA)
  nameField: string;
  slugPrefix: string;
  crs?: CRS;
}

export interface ZipCodeLayer {
  file: string;
  idField: string;     // e.g. ZCTA5CE20, ZIP_CODE
  slugPrefix: string;
  crs?: CRS;
}

// ---------------------------------------------------------------------------
// Top-level config
// ---------------------------------------------------------------------------

export interface StateBuildConfig {
  stateAbbr: string;
  stateName: string;
  /** Path from project root, e.g. 'public/data/political/california'. */
  dataDir: string;

  /**
   * Steps executed by `organize-state-data.ts`.
   * Run these ONCE to transform raw client data into the app's expected layout.
   */
  organizeSteps: OrganizeOperation[];

  precincts: PrecinctConfig;
  elections: ElectionSource[];
  demographics: DemographicsConfig;

  districts: {
    stateHouse?: DistrictLayer;
    stateSenate?: DistrictLayer;
    congressional?: DistrictLayer;
    municipality?: MunicipalityLayer;
    schoolDistrict?: SchoolDistrictLayer;
    zipCode?: ZipCodeLayer;
  };

  outputFiles: {
    targetingScores: string;     // relative to dataDir
    electionHistory: string;
    demographics: string;
    districtCrosswalk: string;
    h3Json: string;
    h3GeoJSON: string;
  };
}
