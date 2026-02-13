/**
 * Political Data Service
 *
 * Centralized service for loading and combining political analysis data:
 * - Precinct boundaries (GeoJSON)
 * - Election results (processed JSON)
 * - Political scores (partisan lean, swing potential)
 * - Crosswalk data (precinct-to-block-group)
 * - Business Analyst data (when available via feature service)
 *
 * Implements caching and lazy loading for performance.
 */

import type {
  PrecinctPoliticalScores,
  CrosswalkEntry,
  AnalysisUnit,
  DemographicSummary,
  PoliticalAttitudes,
  PoliticalEngagement,
  PsychographicProfile,
  CompetitivenessRating,
  VolatilityRating,
  TargetingPriority,
  PoliticalFilters,
  CountySummary,
  UnifiedPrecinct,
} from '@/types/political';

// ============================================================================
// Configuration
// ============================================================================

// Blob URL keys (loaded from /data/blob-urls.json)
const BLOB_KEYS = {
  precinctBoundaries: 'political/precincts/ingham_county_2024',
  electionResults: 'political/elections/ingham_results',
  targetingScores: 'political/targeting/precinct_scores',
  politicalScores: 'political/targeting/political_scores',
  demographics: 'political/demographics/precinct_ba',
  crosswalk: 'political/crosswalk/precinct_blockgroup',
  h3Aggregates: 'political/h3/aggregates',
  h3GeoJSON: 'political/h3/aggregates_geojson',
  modelRegistry: 'political/models/registry',
};

// Fallback local paths (for development)
const LOCAL_PATHS = {
  precinctBoundaries: '/data/political/ingham_precincts.geojson',
  electionResults: '/data/political/election-history.json',
  targetingScores: '/data/processed/precinct_targeting_scores.json',
  politicalScores: '/data/processed/precinct_political_scores.json',
  demographics: '/data/processed/precinct_ba_demographics.json',
  crosswalk: '/data/processed/precinct_blockgroup_crosswalk.json',
  h3Aggregates: '/data/processed/h3_aggregates.json',
  h3GeoJSON: '/data/processed/h3_aggregates.geojson',
};

// Blob URL mappings (loaded once)
let blobUrlMappings: Record<string, string> | null = null;

// Business Analyst feature service URL (legacy - now using blob storage)
let BA_FEATURE_SERVICE_URL: string | null = null;

// ============================================================================
// Cache Storage
// ============================================================================

interface DataCache {
  precinctBoundaries: GeoJSON.FeatureCollection | null;
  blockGroupBoundaries: GeoJSON.FeatureCollection | null;
  electionResults: ElectionResultsData | null;
  politicalScores: PoliticalScoresData | null;
  targetingScores: TargetingScoresData | null;
  demographics: DemographicsData | null;
  crosswalk: CrosswalkEntry[] | null;
  h3Aggregates: H3AggregatesData | null;
  h3GeoJSON: GeoJSON.FeatureCollection | null;
  baData: Map<string, BABlockGroupData> | null;
  analysisUnits: Map<string, AnalysisUnit> | null;
}

interface TargetingScoresData {
  metadata: {
    generated: string;
    precinct_count: number;
  };
  summary: {
    strategy_distribution: Record<string, number>;
    gotv_distribution: Record<string, number>;
    persuasion_distribution: Record<string, number>;
    score_stats: {
      gotv: { mean: number; median: number; min: number; max: number };
      persuasion: { mean: number; median: number; min: number; max: number };
      combined: { mean: number; median: number; min: number; max: number };
    };
  };
  precincts: Record<string, TargetingScoresPrecinct>;
}

interface TargetingScoresPrecinct {
  precinct_id?: string;
  precinct_name?: string;
  short_name?: string;  // Friendly short name like "East Lansing 3"
  jurisdiction?: string;
  registered_voters?: number;
  active_voters?: number;
  gotv_priority: number;
  gotv_classification: string;
  gotv_components: {
    support_strength: number;
    turnout_opportunity: number;
    voter_pool_weight: number;
  };
  persuasion_opportunity: number;
  persuasion_classification: string;
  persuasion_components: {
    margin_closeness: number;
    swing_factor: number;
    moderate_factor: number;
    independent_factor: number;
    low_engagement: number;
  };
  targeting_strategy: string;
  targeting_priority: number;
  combined_score: number;
  recommendation: string;
  political_scores?: {
    partisan_lean: number;
    swing_potential: number;
  };
  // BA demographics
  total_population?: number;
  population_age_18up?: number;
  median_household_income?: number;
  dem_affiliation_pct?: number;
  rep_affiliation_pct?: number;
  ind_affiliation_pct?: number;
  liberal_pct?: number;
  moderate_pct?: number;
  conservative_pct?: number;
  college_pct?: number;
  diversity_index?: number;
}

interface DemographicsData {
  metadata: {
    generated: string;
    precinct_count: number;
  };
  precincts: Record<string, any>;
}

interface H3AggregatesData {
  metadata: {
    generated: string;
    h3_resolution: number;
    cell_count: number;
  };
  cells: Record<string, H3Cell>;
}

interface H3Cell {
  h3_index: string;
  resolution: number;
  center: [number, number];
  precinct_count: number;
  precincts: string[];
  partisan_lean: number | null;
  swing_potential: number | null;
  gotv_priority: number | null;
  persuasion_opportunity: number | null;
  combined_score: number | null;
  total_population: number | null;
  dem_affiliation_pct: number | null;
  rep_affiliation_pct: number | null;
}

interface ElectionResultsData {
  // Support both formats: legacy 'precincts' and current 'precinctHistory'
  precincts?: Record<string, any>;
  precinctHistory?: Record<string, Record<string, {
    turnout: number;
    demVoteShare: number;
    repVoteShare: number;
    margin: number;
  }>>;
  metadata: {
    elections: Array<{ year: number; type: string; date: string }> | string[];
    totalPrecincts?: number;
    totalRaces?: number;
  };
}

interface PoliticalScoresData {
  generated: string;
  methodology: any;
  summary: {
    total_precincts: number;
    lean_distribution: Record<string, number>;
    swing_distribution: Record<string, number>;
  };
  precincts: Record<string, RawPrecinctScore>;
}

interface RawPrecinctScore {
  partisan_lean: number | null;
  swing_potential: number | null;
  turnout: {
    average: number;
    presidential_avg: number | null;
    midterm_avg: number | null;
    dropoff: number | null;
    elections: number;
  } | null;
  classification: {
    competitiveness: string;
    volatility: string;
    targeting_priority: string;
  };
  elections_analyzed: number;
}

// Jurisdiction aggregation types (Phase 4: Natural Language Geo-Awareness)
interface JurisdictionAggregate {
  jurisdictionName: string;
  precinctCount: number;
  precinctNames: string[];
  totalPopulation: number;
  estimatedVoters: number;
  scores: {
    partisanLean: number;
    swingPotential: number;
    gotvPriority: number;
    persuasionOpportunity: number;
    averageTurnout: number;
  };
  demographics: {
    medianIncome: number;
    demAffiliation: number;
    repAffiliation: number;
    indAffiliation: number;
  };
  dominantCompetitiveness: string;
  dominantStrategy: string;
  strategyDistribution: Record<string, number>;
  competitivenessDistribution: Record<string, number>;
}

interface JurisdictionComparison {
  jurisdiction1: JurisdictionAggregate;
  jurisdiction2: JurisdictionAggregate;
  differences: {
    partisanLean: number;
    swingPotential: number;
    gotvPriority: number;
    persuasionOpportunity: number;
    turnout: number;
  };
  summary: string;
}

interface JurisdictionRanking {
  jurisdictionName: string;
  value: number;
  precinctCount: number;
  dominantStrategy: string;
}

interface PrecinctRanking {
  precinctName: string;
  value: number;
  strategy: string;
  competitiveness: string;
}

interface BABlockGroupData {
  geoid: string;
  // Political attitudes
  veryLiberal?: number;
  somewhatLiberal?: number;
  middleOfRoad?: number;
  somewhatConservative?: number;
  veryConservative?: number;
  registeredDemocrat?: number;
  registeredRepublican?: number;
  registeredIndependent?: number;
  likelyVoters?: number;
  // Engagement
  politicalPodcast?: number;
  politicalContributor?: number;
  wroteCalledPolitician?: number;
  cashGiftsPolitical?: number;
  followsPoliticians?: number;
  followsPoliticalGroups?: number;
  votedLastElection?: number;
  alwaysVotes?: number;
  // Demographics
  totalPopulation?: number;
  votingAgePopulation?: number;
  medianAge?: number;
  medianIncome?: number;
  educationBachelorsPlus?: number;
  ownerOccupied?: number;
  renterOccupied?: number;
  // Psychographics
  tapestrySegment?: string;
  tapestryCode?: string;
}

const cache: DataCache = {
  precinctBoundaries: null,
  blockGroupBoundaries: null,
  electionResults: null,
  politicalScores: null,
  targetingScores: null,
  demographics: null,
  crosswalk: null,
  h3Aggregates: null,
  h3GeoJSON: null,
  baData: null,
  analysisUnits: null,
};

// Track deployment version to invalidate cache on new deployments
// Vercel serverless functions stay "warm" and cache persists across requests
// This ensures fresh data is loaded after each deployment
let cachedDeploymentVersion: string | null = null;
// Use a static fallback 'development' for local dev to avoid hydration mismatches
// In production, VERCEL_GIT_COMMIT_SHA will always be set
const CURRENT_DEPLOYMENT_VERSION = process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  'development';

// Centroid cache (computed from geometry)
const centroidCache: Map<string, [number, number]> = new Map();

/**
 * Calculate centroid of a polygon geometry
 */
function calculatePolygonCentroid(coordinates: number[][][]): [number, number] {
  // For simple polygons, use the first ring (outer boundary)
  const ring = coordinates[0];
  if (!ring || ring.length === 0) return [0, 0];

  let sumX = 0;
  let sumY = 0;
  let area = 0;

  for (let i = 0; i < ring.length - 1; i++) {
    const x0 = ring[i][0];
    const y0 = ring[i][1];
    const x1 = ring[i + 1][0];
    const y1 = ring[i + 1][1];

    const cross = x0 * y1 - x1 * y0;
    area += cross;
    sumX += (x0 + x1) * cross;
    sumY += (y0 + y1) * cross;
  }

  area /= 2;
  if (Math.abs(area) < 1e-10) {
    // Fallback to simple average for degenerate polygons
    const avgX = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
    const avgY = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
    return [avgX, avgY];
  }

  return [sumX / (6 * area), sumY / (6 * area)];
}

// ============================================================================
// Blob URL Loading
// ============================================================================

/**
 * Check if we're in Node.js server runtime (not edge, not browser)
 * Edge runtime has no `process.versions.node`
 */
function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null;
}

/**
 * Load blob URL mappings from the static JSON file
 *
 * Works in:
 * - Browser: fetch from /data/blob-urls.json
 * - Edge runtime: fetch from absolute URL (needs NEXT_PUBLIC_BASE_URL)
 * - Node.js server: read from file system
 */
async function loadBlobUrlMappings(): Promise<Record<string, string>> {
  if (blobUrlMappings !== null) {
    return blobUrlMappings;
  }

  try {
    // Browser context - fetch from public path
    if (typeof window !== 'undefined') {
      const response = await fetch('/data/blob-urls.json');
      if (response.ok) {
        blobUrlMappings = await response.json();
        return blobUrlMappings!;
      }
    }
    // Edge runtime - use fetch with absolute URL
    // Edge runtime has `fetch` but no Node.js modules
    else if (!isNodeRuntime()) {
      // In edge runtime, we need to use fetch
      // Try the blob storage URL directly since we can't read local files
      // Fallback: Return empty and let fetchFromBlobOrLocal handle it
      console.log('[PoliticalDataService] Running in edge runtime, using hardcoded blob URL for mappings');
      const response = await fetch('""');
      if (response.ok) {
        blobUrlMappings = await response.json();
        return blobUrlMappings!;
      }
    }
    // Node.js server context - load directly from file system
    else {
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public/data/blob-urls.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      blobUrlMappings = JSON.parse(fileContent);
      return blobUrlMappings!;
    }
  } catch (error) {
    console.warn('[PoliticalDataService] Failed to load blob URL mappings:', error);
  }

  blobUrlMappings = {};
  return blobUrlMappings;
}

/**
 * Fetch data from blob storage with fallback to local files
 */
async function fetchFromBlobOrLocal<T>(blobKey: string, localPath: string): Promise<T> {
  const urlMappings = await loadBlobUrlMappings();
  const blobUrl = urlMappings[blobKey];

  // Try blob storage first
  if (blobUrl) {
    try {
      // Simple fetch - blob storage has proper CORS headers (access-control-allow-origin: *)
      // Don't use cache: 'no-store' as it can cause issues in some browser contexts
      // Blob URLs include unique hashes, so caching is safe and beneficial
      const response = await fetch(blobUrl);
      if (response.ok) {
        console.log(`[PoliticalDataService] Loaded ${blobKey} from blob storage`);
        return await response.json();
      }
    } catch (error) {
      console.warn(`[PoliticalDataService] Blob fetch failed for ${blobKey}:`, error);
    }
  }

  // Fallback to local file
  console.log(`[PoliticalDataService] Loading ${blobKey} from local path: ${localPath}`);
  const response = await fetch(localPath);
  if (!response.ok) {
    throw new Error(`Failed to load ${blobKey} from ${localPath}: ${response.status}`);
  }
  return await response.json();
}

// ============================================================================
// Core Service Class
// ============================================================================

export class PoliticalDataService {
  private static instance: PoliticalDataService;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): PoliticalDataService {
    if (!PoliticalDataService.instance) {
      PoliticalDataService.instance = new PoliticalDataService();
    }
    return PoliticalDataService.instance;
  }

  /**
   * Configure Business Analyst feature service URL (legacy)
   */
  static setBAFeatureServiceURL(url: string): void {
    BA_FEATURE_SERVICE_URL = url;
    // Clear BA cache when URL changes
    cache.baData = null;
    cache.analysisUnits = null;
  }

  /**
   * Initialize service - load all data from blob storage
   * Automatically invalidates cache on new deployments (detected via VERCEL_GIT_COMMIT_SHA)
   */
  async initialize(): Promise<void> {
    // Check if deployment version changed (new deployment on Vercel)
    // This ensures stale data from warm serverless functions is cleared
    if (cachedDeploymentVersion && cachedDeploymentVersion !== CURRENT_DEPLOYMENT_VERSION) {
      console.log(`[PoliticalDataService] Deployment version changed (${cachedDeploymentVersion} -> ${CURRENT_DEPLOYMENT_VERSION}), clearing cache...`);
      this.clearCache();
    }

    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    // Track current deployment version
    cachedDeploymentVersion = CURRENT_DEPLOYMENT_VERSION;

    this.initPromise = this._doInitialize();
    await this.initPromise;
    this.initialized = true;
  }

  private async _doInitialize(): Promise<void> {
    console.log('[PoliticalDataService] Initializing from Vercel Blob Storage...');

    try {
      // Load all data in parallel from blob storage
      const [targetingScores, politicalScores, crosswalk, elections, demographics] = await Promise.all([
        this.loadTargetingScores(),
        this.loadPoliticalScores(),
        this.loadCrosswalk(),
        this.loadElectionResults(),
        this.loadDemographics(),
      ]);

      console.log(`[PoliticalDataService] Loaded ${Object.keys(targetingScores.precincts).length} precinct targeting scores`);
      console.log(`[PoliticalDataService] Loaded ${Object.keys(politicalScores.precincts).length} precinct political scores`);
      console.log(`[PoliticalDataService] Loaded ${crosswalk.length} crosswalk entries`);
      console.log(`[PoliticalDataService] Loaded ${Object.keys(elections.precincts || elections.precinctHistory || {}).length} precinct election records`);
      console.log(`[PoliticalDataService] Loaded ${Object.keys(demographics.precincts).length} precinct demographics`);

      // Load H3 aggregates (for heatmaps)
      const h3 = await this.loadH3Aggregates();
      console.log(`[PoliticalDataService] Loaded ${Object.keys(h3.cells).length} H3 cells`);

      console.log('[PoliticalDataService] Initialization complete');
    } catch (error) {
      console.error('[PoliticalDataService] Initialization error:', error);
      throw error;
    }
  }

  // ============================================================================
  // Data Loading Methods
  // ============================================================================

  /**
   * Load targeting scores (GOTV Priority, Persuasion Opportunity) from blob storage
   */
  private async loadTargetingScores(): Promise<TargetingScoresData> {
    if (cache.targetingScores) return cache.targetingScores;

    cache.targetingScores = await fetchFromBlobOrLocal<TargetingScoresData>(
      BLOB_KEYS.targetingScores,
      LOCAL_PATHS.targetingScores
    );
    return cache.targetingScores!;
  }

  /**
   * Load political scores (Partisan Lean, Swing Potential) from blob storage
   */
  private async loadPoliticalScores(): Promise<PoliticalScoresData> {
    if (cache.politicalScores) return cache.politicalScores;

    cache.politicalScores = await fetchFromBlobOrLocal<PoliticalScoresData>(
      BLOB_KEYS.politicalScores,
      LOCAL_PATHS.politicalScores
    );
    return cache.politicalScores!;
  }

  /**
   * Load demographics (BA data joined to precincts) from blob storage
   */
  private async loadDemographics(): Promise<DemographicsData> {
    if (cache.demographics) return cache.demographics;

    cache.demographics = await fetchFromBlobOrLocal<DemographicsData>(
      BLOB_KEYS.demographics,
      LOCAL_PATHS.demographics
    );
    return cache.demographics!;
  }

  /**
   * Load precinct-to-block-group crosswalk from blob storage
   */
  private async loadCrosswalk(): Promise<CrosswalkEntry[]> {
    if (cache.crosswalk) return cache.crosswalk;

    const data = await fetchFromBlobOrLocal<{ crosswalk?: CrosswalkEntry[] }>(
      BLOB_KEYS.crosswalk,
      LOCAL_PATHS.crosswalk
    );
    cache.crosswalk = data.crosswalk || (data as unknown as CrosswalkEntry[]);
    return cache.crosswalk!;
  }

  /**
   * Load election results from blob storage
   */
  private async loadElectionResults(): Promise<ElectionResultsData> {
    if (cache.electionResults) return cache.electionResults;

    cache.electionResults = await fetchFromBlobOrLocal<ElectionResultsData>(
      BLOB_KEYS.electionResults,
      LOCAL_PATHS.electionResults
    );
    return cache.electionResults!;
  }

  /**
   * Load H3 hexagonal aggregates from blob storage
   */
  private async loadH3Aggregates(): Promise<H3AggregatesData> {
    if (cache.h3Aggregates) return cache.h3Aggregates;

    cache.h3Aggregates = await fetchFromBlobOrLocal<H3AggregatesData>(
      BLOB_KEYS.h3Aggregates,
      LOCAL_PATHS.h3Aggregates
    );
    return cache.h3Aggregates!;
  }

  /**
   * Load H3 GeoJSON for map visualization
   */
  async loadH3GeoJSON(): Promise<GeoJSON.FeatureCollection> {
    if (cache.h3GeoJSON) return cache.h3GeoJSON;

    cache.h3GeoJSON = await fetchFromBlobOrLocal<GeoJSON.FeatureCollection>(
      BLOB_KEYS.h3GeoJSON,
      LOCAL_PATHS.h3GeoJSON
    );
    return cache.h3GeoJSON!;
  }

  /**
   * Load precinct boundaries GeoJSON from blob storage
   */
  async loadPrecinctBoundaries(): Promise<GeoJSON.FeatureCollection> {
    if (cache.precinctBoundaries) return cache.precinctBoundaries;

    cache.precinctBoundaries = await fetchFromBlobOrLocal<GeoJSON.FeatureCollection>(
      BLOB_KEYS.precinctBoundaries,
      LOCAL_PATHS.precinctBoundaries
    );
    return cache.precinctBoundaries!;
  }

  /**
   * Get centroid for a precinct from its geometry
   * Loads the GeoJSON precinct boundaries and calculates/caches centroids
   */
  async getPrecinctCentroid(precinctId: string): Promise<[number, number]> {
    // Check cache first
    const normalizedId = precinctId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (centroidCache.has(normalizedId)) {
      return centroidCache.get(normalizedId)!;
    }

    // Try to load from local GeoJSON first (faster)
    try {
      const response = await fetch('/data/political/ingham_precincts.geojson');
      if (response.ok) {
        const geojson = await response.json() as GeoJSON.FeatureCollection;

        // Build centroids for all precincts
        for (const feature of geojson.features) {
          const id = (feature.properties?.PRECINCT_ID || feature.properties?.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (feature.geometry?.type === 'Polygon') {
            const centroid = calculatePolygonCentroid((feature.geometry as GeoJSON.Polygon).coordinates);
            centroidCache.set(id, centroid);
          } else if (feature.geometry?.type === 'MultiPolygon') {
            // For MultiPolygon, use the largest polygon's centroid
            const multiCoords = (feature.geometry as GeoJSON.MultiPolygon).coordinates;
            const centroid = calculatePolygonCentroid(multiCoords[0]);
            centroidCache.set(id, centroid);
          }
        }

        // Return the requested centroid
        if (centroidCache.has(normalizedId)) {
          return centroidCache.get(normalizedId)!;
        }
      }
    } catch (error) {
      console.warn('[PoliticalDataService] Failed to load precinct GeoJSON for centroids:', error);
    }

    // Fallback: Use Ingham County center
    return [-84.55, 42.60];
  }

  /**
   * Load Business Analyst data from feature service (legacy - now use loadDemographics)
   */
  private async loadBAData(): Promise<void> {
    if (!BA_FEATURE_SERVICE_URL) {
      console.log('[PoliticalDataService] No BA feature service URL configured');
      return;
    }

    console.log('[PoliticalDataService] Loading BA data from feature service...');

    try {
      // Query the feature service
      const queryUrl = `${BA_FEATURE_SERVICE_URL}/query?where=1=1&outFields=*&f=json`;
      const response = await fetch(queryUrl);

      if (!response.ok) {
        throw new Error(`BA feature service error: ${response.status}`);
      }

      const data = await response.json();
      cache.baData = new Map();

      for (const feature of data.features || []) {
        const attrs = feature.attributes;
        const geoid = attrs.GEOID || attrs.geoid || attrs.GEOID20;

        if (geoid) {
          cache.baData.set(geoid, this.mapBAAttributes(attrs));
        }
      }

      console.log(`[PoliticalDataService] Loaded BA data for ${cache.baData.size} block groups`);
    } catch (error) {
      console.error('[PoliticalDataService] Error loading BA data:', error);
      // Continue without BA data - it's optional
    }
  }

  /**
   * Map BA feature service attributes to our interface
   */
  private mapBAAttributes(attrs: any): BABlockGroupData {
    return {
      geoid: attrs.GEOID || attrs.geoid || attrs.GEOID20,
      // Political attitudes (BA variable names)
      veryLiberal: attrs.POLOLKVLIB,
      somewhatLiberal: attrs.POLOLKLEAN,
      middleOfRoad: attrs.POLOLKMID,
      somewhatConservative: attrs.POLOLKCONS,
      veryConservative: attrs.POLOLKVCON,
      registeredDemocrat: attrs.POLAFFDEM,
      registeredRepublican: attrs.POLAFFREP,
      registeredIndependent: attrs.POLAFFIND,
      likelyVoters: attrs.POLLKELVOTE,
      // Engagement
      politicalPodcast: attrs.POLPODCAST,
      politicalContributor: attrs.POLCONTRIB,
      wroteCalledPolitician: attrs.POLWROTECALL,
      cashGiftsPolitical: attrs.POLCASHGIFT,
      followsPoliticians: attrs.SMFOLPOL,
      followsPoliticalGroups: attrs.SMFOLPOLGRP,
      votedLastElection: attrs.POLVOTEDLST,
      alwaysVotes: attrs.POLVOTEFRE1,
      // Demographics
      totalPopulation: attrs.TOTPOP || attrs.B01001_001E,
      votingAgePopulation: attrs.POPVOTAGE || attrs.VAP,
      medianAge: attrs.MEDAGE || attrs.B01002_001E,
      medianIncome: attrs.MEDHHINC || attrs.B19013_001E,
      educationBachelorsPlus: attrs.EDUBACHPCT,
      ownerOccupied: attrs.OWNOCCPCT,
      renterOccupied: attrs.RNTOCCPCT,
      // Psychographics
      tapestrySegment: attrs.TAPSEGNAM,
      tapestryCode: attrs.TAPSEGCODE,
    };
  }

  // ============================================================================
  // Public Data Access Methods
  // ============================================================================

  /**
   * Get targeting scores (GOTV Priority, Persuasion Opportunity) for a precinct
   */
  async getPrecinctTargetingScores(precinctName: string): Promise<TargetingScoresPrecinct | null> {
    await this.initialize();
    return cache.targetingScores?.precincts[precinctName] || null;
  }

  /**
   * Get all precinct targeting scores
   */
  async getAllTargetingScores(): Promise<Record<string, TargetingScoresPrecinct>> {
    await this.initialize();
    return cache.targetingScores?.precincts || {};
  }

  /**
   * Get targeting scores summary statistics
   */
  async getTargetingScoresSummary(): Promise<TargetingScoresData['summary'] | null> {
    await this.initialize();
    return cache.targetingScores?.summary || null;
  }

  /**
   * Get precincts by targeting strategy
   */
  async getPrecinctsByStrategy(strategy: string): Promise<string[]> {
    await this.initialize();

    const results: string[] = [];
    for (const [name, scores] of Object.entries(cache.targetingScores?.precincts || {})) {
      if (scores.targeting_strategy === strategy) {
        results.push(name);
      }
    }
    return results;
  }

  /**
   * Get H3 aggregates for heatmap visualization
   */
  async getH3Aggregates(): Promise<H3AggregatesData> {
    await this.initialize();
    return cache.h3Aggregates!;
  }

  /**
   * Get H3 cells filtered by metric value
   */
  async getH3CellsByMetric(
    metric: 'partisan_lean' | 'gotv_priority' | 'persuasion_opportunity' | 'combined_score',
    minValue?: number,
    maxValue?: number
  ): Promise<H3Cell[]> {
    await this.initialize();

    const cells = Object.values(cache.h3Aggregates?.cells || {});
    return cells.filter(cell => {
      const value = cell[metric];
      if (value === null) return false;
      if (minValue !== undefined && value < minValue) return false;
      if (maxValue !== undefined && value > maxValue) return false;
      return true;
    });
  }

  /**
   * Get political scores for a specific precinct
   */
  async getPrecinctScores(precinctName: string): Promise<PrecinctPoliticalScores | null> {
    await this.initialize();

    const raw = cache.politicalScores?.precincts[precinctName];
    if (!raw) return null;

    return this.transformRawScores(precinctName, raw);
  }

  /**
   * Get all precinct scores
   */
  async getAllPrecinctScores(): Promise<Map<string, PrecinctPoliticalScores>> {
    await this.initialize();

    const result = new Map<string, PrecinctPoliticalScores>();

    for (const [name, raw] of Object.entries(cache.politicalScores?.precincts || {})) {
      const scores = this.transformRawScores(name, raw);
      if (scores) {
        result.set(name, scores);
      }
    }

    return result;
  }

  // ============================================================================
  // Unified Precinct Data (Data Consolidation - Single Source of Truth)
  // ============================================================================

  /**
   * Get unified precinct data combining targeting and political scores.
   *
   * This is the SINGLE SOURCE OF TRUTH for precinct data across the application.
   * All components should use this method instead of loading local JSON files directly.
   *
   * @returns Record of precinct name -> UnifiedPrecinct data
   */
  async getUnifiedPrecinctData(): Promise<Record<string, UnifiedPrecinct>> {
    await this.initialize();

    const targeting = cache.targetingScores?.precincts || {};
    const political = cache.politicalScores?.precincts || {};

    // Build a union of all precinct names from both sources
    const allPrecinctNames = new Set<string>([
      ...Object.keys(targeting),
      ...Object.keys(political),
    ]);

    const unified: Record<string, UnifiedPrecinct> = {};

    for (const name of allPrecinctNames) {
      const targetingData = targeting[name];
      const politicalData = political[name];

      // Skip if no data from either source
      if (!targetingData && !politicalData) continue;

      // Create unified precinct entry
      unified[name] = {
        // Core identifiers
        id: targetingData?.precinct_id || name.replace(/[^a-zA-Z0-9]/g, '_'),
        name: targetingData?.precinct_name || name,
        jurisdiction: this.extractJurisdiction(name),

        // Demographics (from targeting scores / BA data)
        demographics: {
          totalPopulation: targetingData?.total_population || 0,
          population18up: targetingData?.population_age_18up || 0,
          registeredVoters: targetingData?.registered_voters,  // From election data
          medianHHI: targetingData?.median_household_income || 0,
          collegePct: targetingData?.college_pct || 0,
          diversityIndex: targetingData?.diversity_index || 0,
          populationDensity: undefined, // Not available in current data
        },

        // Political affiliation (from targeting scores / BA data)
        political: {
          demAffiliationPct: targetingData?.dem_affiliation_pct || 0,
          repAffiliationPct: targetingData?.rep_affiliation_pct || 0,
          independentPct: targetingData?.ind_affiliation_pct || 0,
          liberalPct: targetingData?.liberal_pct || 0,
          moderatePct: targetingData?.moderate_pct || 0,
          conservativePct: targetingData?.conservative_pct || 0,
        },

        // Electoral scores - prefer political_scores, fallback to targeting embedded scores
        electoral: {
          partisanLean:
            politicalData?.partisan_lean ??
            targetingData?.political_scores?.partisan_lean ??
            0,
          swingPotential:
            politicalData?.swing_potential ??
            targetingData?.political_scores?.swing_potential ??
            0,
          avgTurnout: politicalData?.turnout?.average ?? 0,
          competitiveness:
            politicalData?.classification?.competitiveness ?? 'Unknown',
          volatility: politicalData?.classification?.volatility ?? 'Unknown',
        },

        // Targeting scores (from targeting scores)
        targeting: {
          gotvPriority: targetingData?.gotv_priority ?? 0,
          persuasionOpportunity: targetingData?.persuasion_opportunity ?? 0,
          combinedScore: targetingData?.combined_score ?? 0,
          strategy: targetingData?.targeting_strategy ?? 'Unknown',
          priority: targetingData?.targeting_priority ?? 5,
          recommendation: targetingData?.recommendation ?? '',
        },

        // Components (for detailed analysis)
        gotvComponents: targetingData?.gotv_components
          ? {
              supportStrength: targetingData.gotv_components.support_strength,
              turnoutOpportunity: targetingData.gotv_components.turnout_opportunity,
              voterPoolWeight: targetingData.gotv_components.voter_pool_weight,
            }
          : undefined,

        persuasionComponents: targetingData?.persuasion_components
          ? {
              marginCloseness: targetingData.persuasion_components.margin_closeness,
              swingFactor: targetingData.persuasion_components.swing_factor,
              moderateFactor: targetingData.persuasion_components.moderate_factor,
              independentFactor: targetingData.persuasion_components.independent_factor,
              lowEngagement: targetingData.persuasion_components.low_engagement,
            }
          : undefined,
      };
    }

    console.log(
      `[PoliticalDataService] getUnifiedPrecinctData: Merged ${Object.keys(unified).length} precincts from targeting (${Object.keys(targeting).length}) and political (${Object.keys(political).length}) sources`
    );

    return unified;
  }

  /**
   * Get unified data for a single precinct by name
   *
   * @param precinctName - The name of the precinct (supports fuzzy matching and short_name)
   * @returns UnifiedPrecinct or null if not found
   */
  async getUnifiedPrecinct(precinctName: string): Promise<UnifiedPrecinct | null> {
    const allData = await this.getUnifiedPrecinctData();

    // Try exact match first
    if (allData[precinctName]) {
      return allData[precinctName];
    }

    // Try case-insensitive match on key
    const lowerName = precinctName.toLowerCase();
    for (const [key, value] of Object.entries(allData)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }

    // Try matching by short_name from raw targeting data
    // e.g., "East Lansing 3" matches "City of East Lansing, Precinct 3"
    const targeting = cache.targetingScores?.precincts || {};
    for (const [key, value] of Object.entries(allData)) {
      const targetingData = targeting[key];
      const shortName = targetingData?.short_name;
      if (shortName && shortName.toLowerCase() === lowerName) {
        return value;
      }
    }

    // Try partial match on key (for searches like "Ingham Precinct 1")
    for (const [key, value] of Object.entries(allData)) {
      if (
        key.toLowerCase().includes(lowerName) ||
        lowerName.includes(key.toLowerCase())
      ) {
        return value;
      }
    }

    // Try partial match on short_name
    for (const [key, value] of Object.entries(allData)) {
      const targetingData = targeting[key];
      const shortName = targetingData?.short_name?.toLowerCase();
      if (shortName && (shortName.includes(lowerName) || lowerName.includes(shortName))) {
        return value;
      }
    }

    return null;
  }

  /**
   * Get multiple precincts by name list
   *
   * @param precinctNames - Array of precinct names
   * @returns Array of UnifiedPrecinct (excludes nulls)
   */
  async getUnifiedPrecincts(precinctNames: string[]): Promise<UnifiedPrecinct[]> {
    const allData = await this.getUnifiedPrecinctData();
    const results: UnifiedPrecinct[] = [];

    for (const name of precinctNames) {
      // Try exact match first
      if (allData[name]) {
        results.push(allData[name]);
        continue;
      }

      // Try case-insensitive match
      const lowerName = name.toLowerCase();
      for (const [key, value] of Object.entries(allData)) {
        if (key.toLowerCase() === lowerName) {
          results.push(value);
          break;
        }
      }
    }

    return results;
  }

  /**
   * Get precinct data in the format expected by ComparisonEngine
   *
   * This method provides compatibility with existing comparison tools while
   * using the unified data from blob storage as the source of truth.
   *
   * @returns PrecinctDataFile compatible object
   */
  async getPrecinctDataFileFormat(): Promise<{
    metadata: {
      county: string;
      state: string;
      created: string;
      precinctCount: number;
      dataYear: number;
      description: string;
      sources: string[];
    };
    jurisdictions: Array<{
      id: string;
      name: string;
      type: 'city' | 'township';
      precinctIds: string[];
    }>;
    precincts: Record<string, {
      id: string;
      name: string;
      jurisdiction: string;
      jurisdictionType: 'city' | 'township';
      demographics: {
        totalPopulation: number;
        population18up: number;
        medianAge: number;
        medianHHI: number;
        collegePct: number;
        homeownerPct: number;
        diversityIndex: number;
        populationDensity: number;
      };
      political: {
        demAffiliationPct: number;
        repAffiliationPct: number;
        independentPct: number;
        liberalPct: number;
        moderatePct: number;
        conservativePct: number;
      };
      electoral: {
        partisanLean: number;
        swingPotential: number;
        competitiveness: string;
        avgTurnout: number;
        turnoutDropoff: number;
      };
      targeting: {
        gotvPriority: number;
        persuasionOpportunity: number;
        combinedScore: number;
        strategy: string;
      };
      elections: Record<string, {
        demPct: number;
        repPct: number;
        margin: number;
        turnout: number;
        ballotsCast: number;
      }>;
    }>;
  }> {
    const unifiedPrecincts = await this.getUnifiedPrecinctData();

    // Build jurisdictions map
    const jurisdictionsMap = new Map<string, { name: string; type: 'city' | 'township'; precinctIds: string[] }>();
    for (const [name, p] of Object.entries(unifiedPrecincts)) {
      const jurisdiction = p.jurisdiction;
      if (jurisdiction) {
        const existing = jurisdictionsMap.get(jurisdiction);
        const type: 'city' | 'township' = jurisdiction.toLowerCase().includes('township') ? 'township' : 'city';
        if (existing) {
          existing.precinctIds.push(p.id);
        } else {
          jurisdictionsMap.set(jurisdiction, {
            name: jurisdiction,
            type,
            precinctIds: [p.id],
          });
        }
      }
    }

    // Build precincts in expected format
    const precincts: Record<string, any> = {};
    for (const [name, p] of Object.entries(unifiedPrecincts)) {
      const jurisdiction = p.jurisdiction;
      const type: 'city' | 'township' = jurisdiction.toLowerCase().includes('township') ? 'township' : 'city';

      precincts[name] = {
        id: p.id,
        name: p.name,
        jurisdiction: jurisdiction,
        jurisdictionType: type,
        demographics: {
          totalPopulation: p.demographics.totalPopulation,
          population18up: p.demographics.population18up,
          medianAge: 35, // Not available in unified data, use default
          medianHHI: p.demographics.medianHHI,
          collegePct: p.demographics.collegePct,
          homeownerPct: 0, // Not available in unified data
          diversityIndex: p.demographics.diversityIndex,
          populationDensity: p.demographics.populationDensity || 0,
        },
        political: {
          demAffiliationPct: p.political.demAffiliationPct,
          repAffiliationPct: p.political.repAffiliationPct,
          independentPct: p.political.independentPct,
          liberalPct: p.political.liberalPct,
          moderatePct: p.political.moderatePct,
          conservativePct: p.political.conservativePct,
        },
        electoral: {
          partisanLean: p.electoral.partisanLean,
          swingPotential: p.electoral.swingPotential,
          competitiveness: p.electoral.competitiveness,
          avgTurnout: p.electoral.avgTurnout,
          turnoutDropoff: 0, // Not available in unified data
        },
        targeting: {
          gotvPriority: p.targeting.gotvPriority,
          persuasionOpportunity: p.targeting.persuasionOpportunity,
          combinedScore: p.targeting.combinedScore,
          strategy: p.targeting.strategy,
        },
        elections: {}, // Election history not included in unified format
      };
    }

    // Build jurisdictions array
    const jurisdictions = Array.from(jurisdictionsMap.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));

    console.log(
      `[PoliticalDataService] getPrecinctDataFileFormat: Built ${Object.keys(precincts).length} precincts, ${jurisdictions.length} jurisdictions`
    );

    return {
      metadata: {
        county: 'Ingham',
        state: 'Michigan',
        created: new Date().toISOString(),
        precinctCount: Object.keys(precincts).length,
        dataYear: 2024,
        description: 'Unified precinct data from blob storage',
        sources: ['Vercel Blob Storage - targeting_scores', 'Vercel Blob Storage - political_scores'],
      },
      jurisdictions,
      precincts,
    };
  }

  /**
   * Get precincts formatted for SegmentEngine
   *
   * Returns an array of precincts in the format expected by SegmentEngine.
   * This is a convenience method that converts the Record format to an array.
   *
   * Note: engagement field may be incomplete or missing depending on data source
   *
   * @returns Array of precinct data objects compatible with SegmentEngine
   */
  async getSegmentEnginePrecincts(): Promise<any> {
    const data = await this.getPrecinctDataFileFormat();

    // Convert Record to array, casting competitiveness to the expected union type
    // Remove engagement field if it doesn't have all required properties
    const precincts = Object.values(data.precincts).map((p: any) => {
      const result: any = {
        ...p,
        electoral: {
          ...p.electoral,
          competitiveness: p.electoral.competitiveness as 'safe_d' | 'likely_d' | 'lean_d' | 'toss_up' | 'lean_r' | 'likely_r' | 'safe_r',
        },
      };

      // Check if engagement has all required fields
      const hasCompleteEngagement = p.engagement &&
        'activistPct' in p.engagement &&
        'facebookPct' in p.engagement &&
        'youtubePct' in p.engagement;

      // Remove incomplete engagement data
      if (!hasCompleteEngagement) {
        delete result.engagement;
      }

      return result;
    });

    console.log(`[PoliticalDataService] getSegmentEnginePrecincts: Returning ${precincts.length} precincts`);

    // Type assertion needed because engagement field may be incomplete or missing
    return precincts as any;
  }

  /**
   * Helper to extract jurisdiction from precinct name
   * e.g., "Ingham Township Precinct 1" -> "Ingham Township"
   */
  private extractJurisdiction(precinctName: string): string {
    // Pattern: Remove "Precinct X" suffix
    const match = precinctName.match(/^(.+?)\s+Precinct\s+\d+$/i);
    if (match) {
      return match[1].trim();
    }

    // Pattern: Remove "P#" or "Pct #" suffix
    const shortMatch = precinctName.match(/^(.+?)\s+(P\d+|Pct\s*\d+)$/i);
    if (shortMatch) {
      return shortMatch[1].trim();
    }

    // Fallback: return as-is (might already be a jurisdiction name)
    return precinctName;
  }

  /**
   * Get election history for a precinct
   * Supports both 'precincts' (blob storage) and 'precinctHistory' (local) formats
   */
  async getPrecinctElectionHistory(precinctName: string): Promise<any | null> {
    await this.initialize();
    // Check both formats - blob uses 'precincts', local uses 'precinctHistory'
    return cache.electionResults?.precincts?.[precinctName]
      || cache.electionResults?.precinctHistory?.[precinctName]
      || null;
  }

  /**
   * Get all election results data
   * Returns the full election results data structure for trend analysis
   */
  async getAllElectionResults(): Promise<ElectionResultsData | null> {
    await this.initialize();
    return cache.electionResults;
  }

  /**
   * Get block groups associated with a precinct via crosswalk
   */
  async getPrecinctBlockGroups(precinctName: string): Promise<CrosswalkEntry[]> {
    await this.initialize();
    return cache.crosswalk?.filter(entry => entry.precinctName === precinctName) || [];
  }

  /**
   * Get interpolated demographics for a precinct
   * Uses area-weighted interpolation from block group data
   */
  async getPrecinctDemographics(precinctName: string): Promise<DemographicSummary | null> {
    await this.initialize();

    const blockGroups = await this.getPrecinctBlockGroups(precinctName);
    if (blockGroups.length === 0) return null;

    if (!cache.baData || cache.baData.size === 0) {
      // Return placeholder if no BA data
      return {
        totalPopulation: 0,
        votingAgePopulation: 0,
        registeredVoters: 0,
        medianAge: 0,
        medianHouseholdIncome: 0,
        educationBachelorsPlus: 0,
        ownerOccupied: 0,
        renterOccupied: 0,
        urbanRural: 'suburban',
      };
    }

    // Area-weighted interpolation
    let totalWeight = 0;
    let weightedPop = 0;
    let weightedVAP = 0;
    let weightedAge = 0;
    let weightedIncome = 0;
    let weightedEdu = 0;
    let weightedOwner = 0;
    let weightedRenter = 0;

    for (const entry of blockGroups) {
      const bgData = cache.baData.get(entry.blockGroupGeoid);
      if (!bgData) continue;

      const weight = entry.overlapRatio;
      totalWeight += weight;

      weightedPop += (bgData.totalPopulation || 0) * weight;
      weightedVAP += (bgData.votingAgePopulation || 0) * weight;
      weightedAge += (bgData.medianAge || 0) * weight;
      weightedIncome += (bgData.medianIncome || 0) * weight;
      weightedEdu += (bgData.educationBachelorsPlus || 0) * weight;
      weightedOwner += (bgData.ownerOccupied || 0) * weight;
      weightedRenter += (bgData.renterOccupied || 0) * weight;
    }

    if (totalWeight === 0) return null;

    return {
      totalPopulation: Math.round(weightedPop),
      votingAgePopulation: Math.round(weightedVAP),
      registeredVoters: 0, // From election data, not BA
      medianAge: weightedAge / totalWeight,
      medianHouseholdIncome: weightedIncome / totalWeight,
      educationBachelorsPlus: weightedEdu / totalWeight,
      ownerOccupied: weightedOwner / totalWeight,
      renterOccupied: weightedRenter / totalWeight,
      urbanRural: this.classifyUrbanRural(weightedPop),
    };
  }

  /**
   * Get interpolated political attitudes for a precinct
   */
  async getPrecinctPoliticalAttitudes(precinctName: string): Promise<PoliticalAttitudes | null> {
    await this.initialize();

    const blockGroups = await this.getPrecinctBlockGroups(precinctName);
    if (blockGroups.length === 0 || !cache.baData) return null;

    let totalWeight = 0;
    const weighted = {
      veryLiberal: 0,
      somewhatLiberal: 0,
      middleOfRoad: 0,
      somewhatConservative: 0,
      veryConservative: 0,
      registeredDemocrat: 0,
      registeredRepublican: 0,
      registeredIndependent: 0,
      registeredOther: 0,
      likelyVoters: 0,
    };

    for (const entry of blockGroups) {
      const bgData = cache.baData.get(entry.blockGroupGeoid);
      if (!bgData) continue;

      const weight = entry.overlapRatio;
      totalWeight += weight;

      weighted.veryLiberal += (bgData.veryLiberal || 0) * weight;
      weighted.somewhatLiberal += (bgData.somewhatLiberal || 0) * weight;
      weighted.middleOfRoad += (bgData.middleOfRoad || 0) * weight;
      weighted.somewhatConservative += (bgData.somewhatConservative || 0) * weight;
      weighted.veryConservative += (bgData.veryConservative || 0) * weight;
      weighted.registeredDemocrat += (bgData.registeredDemocrat || 0) * weight;
      weighted.registeredRepublican += (bgData.registeredRepublican || 0) * weight;
      weighted.registeredIndependent += (bgData.registeredIndependent || 0) * weight;
      weighted.likelyVoters += (bgData.likelyVoters || 0) * weight;
    }

    if (totalWeight === 0) return null;

    return {
      veryLiberal: weighted.veryLiberal / totalWeight,
      somewhatLiberal: weighted.somewhatLiberal / totalWeight,
      middleOfRoad: weighted.middleOfRoad / totalWeight,
      somewhatConservative: weighted.somewhatConservative / totalWeight,
      veryConservative: weighted.veryConservative / totalWeight,
      registeredDemocrat: weighted.registeredDemocrat / totalWeight,
      registeredRepublican: weighted.registeredRepublican / totalWeight,
      registeredIndependent: weighted.registeredIndependent / totalWeight,
      registeredOther: weighted.registeredOther / totalWeight,
      likelyVoters: weighted.likelyVoters / totalWeight,
    };
  }

  /**
   * Get interpolated engagement metrics for a precinct
   */
  async getPrecinctEngagement(precinctName: string): Promise<PoliticalEngagement | null> {
    await this.initialize();

    const blockGroups = await this.getPrecinctBlockGroups(precinctName);
    if (blockGroups.length === 0 || !cache.baData) return null;

    let totalWeight = 0;
    const weighted = {
      politicalPodcastListeners: 0,
      politicalContributors: 0,
      wroteCalledPolitician: 0,
      cashGiftsToPolitical: 0,
      followsPoliticiansOnSocial: 0,
      followsPoliticalGroups: 0,
      votedLastElection: 0,
      alwaysVotes: 0,
    };

    for (const entry of blockGroups) {
      const bgData = cache.baData.get(entry.blockGroupGeoid);
      if (!bgData) continue;

      const weight = entry.overlapRatio;
      totalWeight += weight;

      weighted.politicalPodcastListeners += (bgData.politicalPodcast || 0) * weight;
      weighted.politicalContributors += (bgData.politicalContributor || 0) * weight;
      weighted.wroteCalledPolitician += (bgData.wroteCalledPolitician || 0) * weight;
      weighted.cashGiftsToPolitical += (bgData.cashGiftsPolitical || 0) * weight;
      weighted.followsPoliticiansOnSocial += (bgData.followsPoliticians || 0) * weight;
      weighted.followsPoliticalGroups += (bgData.followsPoliticalGroups || 0) * weight;
      weighted.votedLastElection += (bgData.votedLastElection || 0) * weight;
      weighted.alwaysVotes += (bgData.alwaysVotes || 0) * weight;
    }

    if (totalWeight === 0) return null;

    return {
      politicalPodcastListeners: weighted.politicalPodcastListeners / totalWeight,
      politicalContributors: weighted.politicalContributors / totalWeight,
      wroteCalledPolitician: weighted.wroteCalledPolitician / totalWeight,
      cashGiftsToPolitical: weighted.cashGiftsToPolitical / totalWeight,
      followsPoliticiansOnSocial: weighted.followsPoliticiansOnSocial / totalWeight,
      followsPoliticalGroups: weighted.followsPoliticalGroups / totalWeight,
      votedLastElection: weighted.votedLastElection / totalWeight,
      alwaysVotes: weighted.alwaysVotes / totalWeight,
    };
  }

  /**
   * Get complete analysis unit for a precinct
   */
  async getAnalysisUnit(precinctName: string): Promise<AnalysisUnit | null> {
    await this.initialize();

    // Check cache first
    if (cache.analysisUnits?.has(precinctName)) {
      return cache.analysisUnits.get(precinctName)!;
    }

    const [scores, demographics, attitudes, engagement, elections, centroid] = await Promise.all([
      this.getPrecinctScores(precinctName),
      this.getPrecinctDemographics(precinctName),
      this.getPrecinctPoliticalAttitudes(precinctName),
      this.getPrecinctEngagement(precinctName),
      this.getPrecinctElectionHistory(precinctName),
      this.getPrecinctCentroid(precinctName),
    ]);

    if (!scores) return null;

    // Get registered voters from election data
    const latestElection = elections?.elections
      ? Object.values(elections.elections).sort((a: any, b: any) =>
          b.date?.localeCompare(a.date || '')
        )[0]
      : null;

    const registeredVoters = (latestElection as any)?.registered_voters || 0;

    const unit: AnalysisUnit = {
      precinctId: precinctName.replace(/[^a-zA-Z0-9]/g, '_'),
      precinctName,
      centroid,
      politicalScores: scores,
      demographics: demographics || {
        totalPopulation: 0,
        votingAgePopulation: 0,
        registeredVoters,
        medianAge: 0,
        medianHouseholdIncome: 0,
        educationBachelorsPlus: 0,
        ownerOccupied: 0,
        renterOccupied: 0,
        urbanRural: 'suburban',
      },
      politicalAttitudes: attitudes || {
        veryLiberal: 0,
        somewhatLiberal: 0,
        middleOfRoad: 0,
        somewhatConservative: 0,
        veryConservative: 0,
        registeredDemocrat: 0,
        registeredRepublican: 0,
        registeredIndependent: 0,
        registeredOther: 0,
        likelyVoters: 0,
      },
      engagement: engagement || {
        politicalPodcastListeners: 0,
        politicalContributors: 0,
        wroteCalledPolitician: 0,
        cashGiftsToPolitical: 0,
        followsPoliticiansOnSocial: 0,
        followsPoliticalGroups: 0,
        votedLastElection: 0,
        alwaysVotes: 0,
      },
      psychographics: {
        primarySegment: 'Unknown',
        primarySegmentCode: '',
        communityInvolvement: 0,
        religiousAttendance: 0,
        unionMembership: 0,
      },
      derivedScores: {
        turnoutPropensity: scores.turnout.averageTurnout,
        gotvPriority: this.calculateGOTVPriority(scores),
        persuadability: scores.swingPotential.value,
        outcomeConfidence: scores.partisanLean.confidence,
      },
    };

    // Cache the result
    if (!cache.analysisUnits) {
      cache.analysisUnits = new Map();
    }
    cache.analysisUnits.set(precinctName, unit);

    return unit;
  }

  /**
   * Filter precincts by criteria
   */
  async filterPrecincts(filters: PoliticalFilters): Promise<string[]> {
    await this.initialize();

    const allScores = await this.getAllPrecinctScores();
    const results: string[] = [];

    for (const [name, scores] of allScores) {
      if (this.matchesFilters(scores, filters)) {
        results.push(name);
      }
    }

    return results;
  }

  /**
   * Get county summary statistics
   */
  async getCountySummary(): Promise<CountySummary> {
    await this.initialize();

    const allScores = await this.getAllPrecinctScores();
    const leans: number[] = [];
    const swings: number[] = [];
    const turnouts: number[] = [];
    let totalVoters = 0;

    for (const scores of allScores.values()) {
      leans.push(scores.partisanLean.value);
      swings.push(scores.swingPotential.value);
      turnouts.push(scores.turnout.averageTurnout);
    }

    return {
      name: 'Ingham County',
      state: 'Michigan',
      fips: '26065',
      totalPrecincts: allScores.size,
      totalRegisteredVoters: totalVoters,
      overallLean: this.mean(leans),
      overallTurnout: this.mean(turnouts),
      scoreRanges: {
        partisan_lean: this.calculateRange(leans),
        swing_potential: this.calculateRange(swings),
        turnout_avg: this.calculateRange(turnouts),
        gotv_priority: { min: 0, max: 100, mean: 50, median: 50, stdDev: 25 },
        persuadability: this.calculateRange(swings),
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private transformRawScores(precinctName: string, raw: RawPrecinctScore): PrecinctPoliticalScores | null {
    if (raw.partisan_lean === null) return null;

    return {
      precinctId: precinctName.replace(/[^a-zA-Z0-9]/g, '_'),
      precinctName,
      partisanLean: {
        value: raw.partisan_lean,
        classification: raw.classification.competitiveness as CompetitivenessRating,
        electionsAnalyzed: raw.elections_analyzed,
        confidence: raw.elections_analyzed >= 3 ? 0.9 : raw.elections_analyzed >= 2 ? 0.7 : 0.5,
      },
      swingPotential: {
        value: raw.swing_potential || 0,
        classification: raw.classification.volatility as VolatilityRating,
        components: {
          marginStdDev: 0,
          avgElectionSwing: 0,
          ticketSplitting: 0,
        },
      },
      turnout: {
        averageTurnout: raw.turnout?.average || 0,
        presidentialAvg: raw.turnout?.presidential_avg || null,
        midtermAvg: raw.turnout?.midterm_avg || null,
        dropoff: raw.turnout?.dropoff || null,
        trend: 'stable',
        electionsAnalyzed: raw.turnout?.elections || 0,
      },
      targetingPriority: raw.classification.targeting_priority as TargetingPriority,
      lastUpdated: cache.politicalScores?.generated || new Date().toISOString(),
    };
  }

  private matchesFilters(scores: PrecinctPoliticalScores, filters: PoliticalFilters): boolean {
    // Partisan lean range
    if (filters.partisanLeanMin !== undefined && scores.partisanLean.value < filters.partisanLeanMin) {
      return false;
    }
    if (filters.partisanLeanMax !== undefined && scores.partisanLean.value > filters.partisanLeanMax) {
      return false;
    }

    // Swing potential range
    if (filters.swingPotentialMin !== undefined && scores.swingPotential.value < filters.swingPotentialMin) {
      return false;
    }
    if (filters.swingPotentialMax !== undefined && scores.swingPotential.value > filters.swingPotentialMax) {
      return false;
    }

    // Turnout range
    if (filters.turnoutMin !== undefined && scores.turnout.averageTurnout < filters.turnoutMin) {
      return false;
    }
    if (filters.turnoutMax !== undefined && scores.turnout.averageTurnout > filters.turnoutMax) {
      return false;
    }

    // Categorical filters
    if (filters.competitiveness?.length && !filters.competitiveness.includes(scores.partisanLean.classification)) {
      return false;
    }
    if (filters.volatility?.length && !filters.volatility.includes(scores.swingPotential.classification)) {
      return false;
    }
    if (filters.targetingPriority?.length && !filters.targetingPriority.includes(scores.targetingPriority)) {
      return false;
    }

    return true;
  }

  private calculateGOTVPriority(scores: PrecinctPoliticalScores): number {
    // GOTV priority based on:
    // - Turnout potential (inverse of current turnout)
    // - Partisan alignment (higher for aligned precincts)
    // - Dropoff (higher dropoff = more potential)

    let priority = 50; // Base

    // Lower turnout = higher GOTV priority
    if (scores.turnout.averageTurnout < 60) priority += 20;
    else if (scores.turnout.averageTurnout < 70) priority += 10;
    else if (scores.turnout.averageTurnout > 80) priority -= 10;

    // High dropoff = higher priority
    if (scores.turnout.dropoff && scores.turnout.dropoff > 15) priority += 15;
    else if (scores.turnout.dropoff && scores.turnout.dropoff > 10) priority += 10;

    return Math.max(0, Math.min(100, priority));
  }

  private classifyUrbanRural(population: number): 'urban' | 'suburban' | 'rural' {
    // Simple classification based on precinct population
    if (population > 5000) return 'urban';
    if (population > 1500) return 'suburban';
    return 'rural';
  }

  private mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private stdDev(arr: number[]): number {
    if (arr.length === 0) return 0;
    const m = this.mean(arr);
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  private calculateRange(arr: number[]): { min: number; max: number; mean: number; median: number; stdDev: number } {
    if (arr.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };
    }
    return {
      min: Math.min(...arr),
      max: Math.max(...arr),
      mean: this.mean(arr),
      median: this.median(arr),
      stdDev: this.stdDev(arr),
    };
  }

  // ============================================================================
  // Jurisdiction Aggregation Methods (Phase 4: Natural Language Geo-Awareness)
  // ============================================================================

  /**
   * Aggregate scores for all precincts in a jurisdiction
   * Uses voter-weighted averaging for accuracy
   */
  async getJurisdictionAggregate(jurisdictionName: string): Promise<JurisdictionAggregate | null> {
    await this.initialize();

    // Find all precincts in this jurisdiction
    const precincts = await this.getPrecinctsByJurisdiction(jurisdictionName);
    if (precincts.length === 0) return null;

    // Get scores for each precinct
    const targetingData = cache.targetingScores?.precincts || {};
    const politicalData = cache.politicalScores?.precincts || {};

    let totalVoters = 0;
    let weightedLean = 0;
    let weightedSwing = 0;
    let weightedGotv = 0;
    let weightedPersuasion = 0;
    let weightedTurnout = 0;
    let weightedPopulation = 0;
    let weightedIncome = 0;
    let weightedDem = 0;
    let weightedRep = 0;
    let weightedInd = 0;

    const strategies: Record<string, number> = {};
    const competitivenessCount: Record<string, number> = {};

    for (const precinctName of precincts) {
      const targeting = targetingData[precinctName];
      const political = politicalData[precinctName];

      if (!targeting && !political) continue;

      // Use registered voters as weight (from targeting data or default)
      const voters = targeting?.total_population || 1000;
      totalVoters += voters;

      // Political scores
      if (political?.partisan_lean !== null && political?.partisan_lean !== undefined) {
        weightedLean += political.partisan_lean * voters;
      }
      if (political?.swing_potential !== null && political?.swing_potential !== undefined) {
        weightedSwing += political.swing_potential * voters;
      }
      if (political?.turnout?.average) {
        weightedTurnout += political.turnout.average * voters;
      }

      // Track competitiveness
      if (political?.classification?.competitiveness) {
        const comp = political.classification.competitiveness;
        competitivenessCount[comp] = (competitivenessCount[comp] || 0) + 1;
      }

      // Targeting scores
      if (targeting) {
        weightedGotv += (targeting.gotv_priority || 0) * voters;
        weightedPersuasion += (targeting.persuasion_opportunity || 0) * voters;
        weightedPopulation += (targeting.total_population || 0);
        weightedIncome += (targeting.median_household_income || 0) * voters;
        weightedDem += (targeting.dem_affiliation_pct || 0) * voters;
        weightedRep += (targeting.rep_affiliation_pct || 0) * voters;
        weightedInd += (targeting.ind_affiliation_pct || 0) * voters;

        // Track strategies
        if (targeting.targeting_strategy) {
          strategies[targeting.targeting_strategy] = (strategies[targeting.targeting_strategy] || 0) + 1;
        }
      }
    }

    if (totalVoters === 0) return null;

    // Calculate dominant competitiveness
    const dominantCompetitiveness = Object.entries(competitivenessCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    // Calculate dominant strategy
    const dominantStrategy = Object.entries(strategies)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    return {
      jurisdictionName,
      precinctCount: precincts.length,
      precinctNames: precincts,
      totalPopulation: Math.round(weightedPopulation),
      estimatedVoters: totalVoters,
      scores: {
        partisanLean: weightedLean / totalVoters,
        swingPotential: weightedSwing / totalVoters,
        gotvPriority: weightedGotv / totalVoters,
        persuasionOpportunity: weightedPersuasion / totalVoters,
        averageTurnout: weightedTurnout / totalVoters,
      },
      demographics: {
        medianIncome: weightedIncome / totalVoters,
        demAffiliation: weightedDem / totalVoters,
        repAffiliation: weightedRep / totalVoters,
        indAffiliation: weightedInd / totalVoters,
      },
      dominantCompetitiveness,
      dominantStrategy,
      strategyDistribution: strategies,
      competitivenessDistribution: competitivenessCount,
    };
  }

  /**
   * Get all precincts in a jurisdiction
   */
  async getPrecinctsByJurisdiction(jurisdictionName: string): Promise<string[]> {
    await this.initialize();

    // Normalize jurisdiction name for matching
    const normalized = jurisdictionName.toLowerCase().trim();

    // Get precinct boundaries to find jurisdiction mappings
    const boundaries = await this.loadPrecinctBoundaries();
    const precincts: string[] = [];

    for (const feature of boundaries.features) {
      const props = feature.properties as Record<string, any>;
      const featureJurisdiction = (props.Jurisdiction_Name || '').toLowerCase().trim();

      // Match jurisdiction name (exact or partial)
      if (
        featureJurisdiction === normalized ||
        featureJurisdiction.includes(normalized) ||
        normalized.includes(featureJurisdiction)
      ) {
        const precinctName = props.Precinct_Long_Name || props.Precinct_Short_Name || props.NAME;
        if (precinctName) {
          precincts.push(precinctName);
        }
      }
    }

    return precincts;
  }

  /**
   * Get all unique jurisdictions in the dataset
   */
  async getAllJurisdictions(): Promise<string[]> {
    await this.initialize();

    const boundaries = await this.loadPrecinctBoundaries();
    const jurisdictions = new Set<string>();

    for (const feature of boundaries.features) {
      const props = feature.properties as Record<string, any>;
      if (props.Jurisdiction_Name) {
        jurisdictions.add(props.Jurisdiction_Name);
      }
    }

    return Array.from(jurisdictions).sort();
  }

  /**
   * Compare two jurisdictions
   */
  async compareJurisdictions(
    jurisdiction1: string,
    jurisdiction2: string
  ): Promise<JurisdictionComparison | null> {
    const [agg1, agg2] = await Promise.all([
      this.getJurisdictionAggregate(jurisdiction1),
      this.getJurisdictionAggregate(jurisdiction2),
    ]);

    if (!agg1 || !agg2) return null;

    return {
      jurisdiction1: agg1,
      jurisdiction2: agg2,
      differences: {
        partisanLean: agg1.scores.partisanLean - agg2.scores.partisanLean,
        swingPotential: agg1.scores.swingPotential - agg2.scores.swingPotential,
        gotvPriority: agg1.scores.gotvPriority - agg2.scores.gotvPriority,
        persuasionOpportunity: agg1.scores.persuasionOpportunity - agg2.scores.persuasionOpportunity,
        turnout: agg1.scores.averageTurnout - agg2.scores.averageTurnout,
      },
      summary: this.generateComparisonSummary(agg1, agg2),
    };
  }

  /**
   * Rank jurisdictions by a specific metric
   */
  async rankJurisdictionsByMetric(
    metric: 'partisan_lean' | 'swing_potential' | 'gotv_priority' | 'persuasion_opportunity' | 'turnout',
    order: 'highest' | 'lowest' = 'highest',
    limit?: number
  ): Promise<JurisdictionRanking[]> {
    await this.initialize();

    const jurisdictions = await this.getAllJurisdictions();
    const rankings: JurisdictionRanking[] = [];

    for (const jurisdiction of jurisdictions) {
      const agg = await this.getJurisdictionAggregate(jurisdiction);
      if (!agg) continue;

      let value: number;
      switch (metric) {
        case 'partisan_lean':
          value = agg.scores.partisanLean;
          break;
        case 'swing_potential':
          value = agg.scores.swingPotential;
          break;
        case 'gotv_priority':
          value = agg.scores.gotvPriority;
          break;
        case 'persuasion_opportunity':
          value = agg.scores.persuasionOpportunity;
          break;
        case 'turnout':
          value = agg.scores.averageTurnout;
          break;
        default:
          value = 0;
      }

      rankings.push({
        jurisdictionName: jurisdiction,
        value,
        precinctCount: agg.precinctCount,
        dominantStrategy: agg.dominantStrategy,
      });
    }

    // Sort by value
    rankings.sort((a, b) => (order === 'highest' ? b.value - a.value : a.value - b.value));

    return limit ? rankings.slice(0, limit) : rankings;
  }

  /**
   * Get precincts within a jurisdiction ranked by metric
   */
  async rankPrecinctsInJurisdiction(
    jurisdictionName: string,
    metric: 'partisan_lean' | 'swing_potential' | 'gotv_priority' | 'persuasion_opportunity' | 'turnout',
    order: 'highest' | 'lowest' = 'highest',
    limit?: number
  ): Promise<PrecinctRanking[]> {
    await this.initialize();

    const precincts = await this.getPrecinctsByJurisdiction(jurisdictionName);
    const targetingData = cache.targetingScores?.precincts || {};
    const politicalData = cache.politicalScores?.precincts || {};
    const rankings: PrecinctRanking[] = [];

    for (const precinctName of precincts) {
      const targeting = targetingData[precinctName];
      const political = politicalData[precinctName];

      let value: number | null = null;
      switch (metric) {
        case 'partisan_lean':
          value = political?.partisan_lean ?? null;
          break;
        case 'swing_potential':
          value = political?.swing_potential ?? null;
          break;
        case 'gotv_priority':
          value = targeting?.gotv_priority ?? null;
          break;
        case 'persuasion_opportunity':
          value = targeting?.persuasion_opportunity ?? null;
          break;
        case 'turnout':
          value = political?.turnout?.average ?? null;
          break;
      }

      if (value !== null) {
        rankings.push({
          precinctName,
          value,
          strategy: targeting?.targeting_strategy || 'Unknown',
          competitiveness: political?.classification?.competitiveness || 'Unknown',
        });
      }
    }

    // Sort by value
    rankings.sort((a, b) => (order === 'highest' ? b.value - a.value : a.value - b.value));

    return limit ? rankings.slice(0, limit) : rankings;
  }

  private generateComparisonSummary(agg1: JurisdictionAggregate, agg2: JurisdictionAggregate): string {
    const leanDiff = agg1.scores.partisanLean - agg2.scores.partisanLean;
    const swingDiff = agg1.scores.swingPotential - agg2.scores.swingPotential;
    const turnoutDiff = agg1.scores.averageTurnout - agg2.scores.averageTurnout;

    const parts: string[] = [];

    // Partisan lean comparison
    if (Math.abs(leanDiff) < 5) {
      parts.push(`${agg1.jurisdictionName} and ${agg2.jurisdictionName} have similar partisan leans`);
    } else if (leanDiff > 0) {
      parts.push(`${agg1.jurisdictionName} leans ${Math.abs(leanDiff).toFixed(1)} points more Democratic`);
    } else {
      parts.push(`${agg2.jurisdictionName} leans ${Math.abs(leanDiff).toFixed(1)} points more Democratic`);
    }

    // Swing potential comparison
    if (swingDiff > 10) {
      parts.push(`${agg1.jurisdictionName} has higher swing potential`);
    } else if (swingDiff < -10) {
      parts.push(`${agg2.jurisdictionName} has higher swing potential`);
    }

    // Turnout comparison
    if (Math.abs(turnoutDiff) > 5) {
      const higher = turnoutDiff > 0 ? agg1.jurisdictionName : agg2.jurisdictionName;
      parts.push(`${higher} has higher turnout (${Math.abs(turnoutDiff).toFixed(1)}% difference)`);
    }

    return parts.join('. ') + '.';
  }

// ============================================================================
  // District Crosswalk Methods (Multi-Level Election Support)
  // ============================================================================

  /**
   * District crosswalk cache
   */
  private districtCrosswalk: Record<string, {
    precinctId: string;
    precinctName: string;
    congressional: string | null;
    stateSenate: string | null;
    stateHouse: string | null;
    municipality: string | null;
    schoolDistrict: string | null;
  }> | null = null;

  /**
   * Load the precinct-to-district crosswalk
   * Maps each precinct to all containing districts (Congressional, State Senate, State House, etc.)
   */
  async loadDistrictCrosswalk(): Promise<Record<string, any>> {
    if (this.districtCrosswalk) return this.districtCrosswalk;

    try {
      // Use the same fetchFromBlobOrLocal pattern for consistency
      // Browser context - use relative URL
      if (typeof window !== 'undefined') {
        const response = await fetch('/data/political/precinct_crosswalk_complete.json');
        if (response.ok) {
          const data = await response.json();
          this.districtCrosswalk = data.precincts || {};
          console.log(`[PoliticalDataService] Loaded district crosswalk for ${Object.keys(this.districtCrosswalk!).length} precincts`);
          return this.districtCrosswalk!;
        }
      }
      // Server/Node context - use filesystem
      else {
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'public/data/political/precinct_crosswalk_complete.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        this.districtCrosswalk = data.precincts || {};
        console.log(`[PoliticalDataService] Loaded district crosswalk for ${Object.keys(this.districtCrosswalk!).length} precincts`);
        return this.districtCrosswalk!;
      }
    } catch (error) {
      console.warn('[PoliticalDataService] Failed to load district crosswalk:', error);
    }

    this.districtCrosswalk = {};
    return this.districtCrosswalk;
  }

  /**
   * Get precincts by state house district
   * @param districtId - e.g., "mi-house-73" or just "73"
   */
  async getPrecinctsByStateHouseDistrict(districtId: string): Promise<UnifiedPrecinct[]> {
    await this.initialize();
    const crosswalk = await this.loadDistrictCrosswalk();
    const unified = await this.getUnifiedPrecinctData();

    // Normalize district ID (handle "73" or "mi-house-73")
    const normalizedId = districtId.startsWith('mi-house-')
      ? districtId
      : `mi-house-${districtId}`;

    const matchingPrecincts: UnifiedPrecinct[] = [];

    for (const [precinctName, assignment] of Object.entries(crosswalk)) {
      if (assignment.stateHouse === normalizedId) {
        const precinct = unified[precinctName];
        if (precinct) {
          matchingPrecincts.push(precinct);
        }
      }
    }

    console.log(`[PoliticalDataService] Found ${matchingPrecincts.length} precincts in ${normalizedId}`);
    return matchingPrecincts;
  }

  /**
   * Get precincts by state senate district
   * @param districtId - e.g., "mi-senate-21" or just "21"
   */
  async getPrecinctsByStateSenateDistrict(districtId: string): Promise<UnifiedPrecinct[]> {
    await this.initialize();
    const crosswalk = await this.loadDistrictCrosswalk();
    const unified = await this.getUnifiedPrecinctData();

    // Normalize district ID
    const normalizedId = districtId.startsWith('mi-senate-')
      ? districtId
      : `mi-senate-${districtId}`;

    const matchingPrecincts: UnifiedPrecinct[] = [];

    for (const [precinctName, assignment] of Object.entries(crosswalk)) {
      if (assignment.stateSenate === normalizedId) {
        const precinct = unified[precinctName];
        if (precinct) {
          matchingPrecincts.push(precinct);
        }
      }
    }

    console.log(`[PoliticalDataService] Found ${matchingPrecincts.length} precincts in ${normalizedId}`);
    return matchingPrecincts;
  }

  /**
   * Get precincts by congressional district
   * @param districtId - e.g., "mi-07" or just "7"
   */
  async getPrecinctsByCongressionalDistrict(districtId: string): Promise<UnifiedPrecinct[]> {
    await this.initialize();
    const crosswalk = await this.loadDistrictCrosswalk();
    const unified = await this.getUnifiedPrecinctData();

    // Normalize district ID
    let normalizedId: string;
    if (districtId.startsWith('mi-')) {
      normalizedId = districtId;
    } else {
      const num = parseInt(districtId, 10);
      normalizedId = `mi-${num.toString().padStart(2, '0')}`;
    }

    const matchingPrecincts: UnifiedPrecinct[] = [];

    for (const [precinctName, assignment] of Object.entries(crosswalk)) {
      if (assignment.congressional === normalizedId) {
        const precinct = unified[precinctName];
        if (precinct) {
          matchingPrecincts.push(precinct);
        }
      }
    }

    console.log(`[PoliticalDataService] Found ${matchingPrecincts.length} precincts in ${normalizedId}`);
    return matchingPrecincts;
  }

  /**
   * Get precincts by school district
   * @param districtId - e.g., "lansing-public-schools" or partial name
   */
  async getPrecinctsBySchoolDistrict(districtId: string): Promise<UnifiedPrecinct[]> {
    await this.initialize();
    const crosswalk = await this.loadDistrictCrosswalk();
    const unified = await this.getUnifiedPrecinctData();

    // Normalize for matching (case-insensitive partial match)
    const normalizedSearch = districtId.toLowerCase().replace(/\s+/g, '-');

    const matchingPrecincts: UnifiedPrecinct[] = [];

    for (const [precinctName, assignment] of Object.entries(crosswalk)) {
      const schoolDistrict = assignment.schoolDistrict || '';
      if (schoolDistrict.toLowerCase().includes(normalizedSearch) ||
          normalizedSearch.includes(schoolDistrict.toLowerCase())) {
        const precinct = unified[precinctName];
        if (precinct) {
          matchingPrecincts.push(precinct);
        }
      }
    }

    console.log(`[PoliticalDataService] Found ${matchingPrecincts.length} precincts in school district matching "${districtId}"`);
    return matchingPrecincts;
  }

  /**
   * Get district assignment for a specific precinct
   */
  async getPrecinctDistrictAssignment(precinctName: string): Promise<{
    congressional: string | null;
    stateSenate: string | null;
    stateHouse: string | null;
    municipality: string | null;
    schoolDistrict: string | null;
  } | null> {
    const crosswalk = await this.loadDistrictCrosswalk();

    // Try exact match first
    if (crosswalk[precinctName]) {
      return crosswalk[precinctName];
    }

    // Try case-insensitive match
    const lowerName = precinctName.toLowerCase();
    for (const [key, value] of Object.entries(crosswalk)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }

    return null;
  }

  /**
   * Get aggregate statistics for a district
   * Works for any district type (state house, state senate, congressional)
   */
  async getDistrictAggregate(
    districtType: 'stateHouse' | 'stateSenate' | 'congressional' | 'schoolDistrict',
    districtId: string
  ): Promise<{
    districtId: string;
    districtType: string;
    precinctCount: number;
    precinctNames: string[];
    totalPopulation: number;
    registeredVoters: number;
    scores: {
      partisanLean: number;
      swingPotential: number;
      gotvPriority: number;
      persuasionOpportunity: number;
      avgTurnout: number;
    };
    competitivenessDistribution: Record<string, number>;
    strategyDistribution: Record<string, number>;
  } | null> {
    let precincts: UnifiedPrecinct[];

    switch (districtType) {
      case 'stateHouse':
        precincts = await this.getPrecinctsByStateHouseDistrict(districtId);
        break;
      case 'stateSenate':
        precincts = await this.getPrecinctsByStateSenateDistrict(districtId);
        break;
      case 'congressional':
        precincts = await this.getPrecinctsByCongressionalDistrict(districtId);
        break;
      case 'schoolDistrict':
        precincts = await this.getPrecinctsBySchoolDistrict(districtId);
        break;
      default:
        return null;
    }

    if (precincts.length === 0) return null;

    // Calculate weighted aggregates
    let totalPopulation = 0;
    let totalVoters = 0;
    let weightedLean = 0;
    let weightedSwing = 0;
    let weightedGotv = 0;
    let weightedPersuasion = 0;
    let weightedTurnout = 0;

    const competitivenessCount: Record<string, number> = {};
    const strategyCount: Record<string, number> = {};

    for (const precinct of precincts) {
      const pop = precinct.demographics.totalPopulation || 1000;
      totalPopulation += pop;
      totalVoters += precinct.demographics.registeredVoters || 0;

      weightedLean += (precinct.electoral.partisanLean || 0) * pop;
      weightedSwing += (precinct.electoral.swingPotential || 0) * pop;
      weightedGotv += (precinct.targeting.gotvPriority || 0) * pop;
      weightedPersuasion += (precinct.targeting.persuasionOpportunity || 0) * pop;
      weightedTurnout += (precinct.electoral.avgTurnout || 0) * pop;

      // Track distributions
      const comp = precinct.electoral.competitiveness || 'Unknown';
      competitivenessCount[comp] = (competitivenessCount[comp] || 0) + 1;

      const strat = precinct.targeting.strategy || 'Unknown';
      strategyCount[strat] = (strategyCount[strat] || 0) + 1;
    }

    return {
      districtId,
      districtType,
      precinctCount: precincts.length,
      precinctNames: precincts.map(p => p.name),
      totalPopulation,
      registeredVoters: totalVoters,
      scores: {
        partisanLean: totalPopulation > 0 ? weightedLean / totalPopulation : 0,
        swingPotential: totalPopulation > 0 ? weightedSwing / totalPopulation : 0,
        gotvPriority: totalPopulation > 0 ? weightedGotv / totalPopulation : 0,
        persuasionOpportunity: totalPopulation > 0 ? weightedPersuasion / totalPopulation : 0,
        avgTurnout: totalPopulation > 0 ? weightedTurnout / totalPopulation : 0,
      },
      competitivenessDistribution: competitivenessCount,
      strategyDistribution: strategyCount,
    };
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    cache.precinctBoundaries = null;
    cache.blockGroupBoundaries = null;
    cache.electionResults = null;
    cache.politicalScores = null;
    cache.targetingScores = null;
    cache.demographics = null;
    cache.crosswalk = null;
    cache.h3Aggregates = null;
    cache.h3GeoJSON = null;
    cache.baData = null;
    cache.analysisUnits = null;
    blobUrlMappings = null;
    this.districtCrosswalk = null;
    this.initialized = false;
    this.initPromise = null;
  }
}

// Export singleton instance
export const politicalDataService = PoliticalDataService.getInstance();
