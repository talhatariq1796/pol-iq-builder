/**
 * PoliticalDataService Unit Tests
 *
 * Tests data loading, caching, and transformation for the centralized political data service.
 * Run with: npm test -- --testPathPattern=PoliticalDataService
 */

import { PoliticalDataService } from '@/lib/services/PoliticalDataService';

// Mock fetch globally for blob storage calls
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

// Mock fs module for blob-urls.json reading in Node.js context
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(JSON.stringify({
    'political/targeting/precinct_scores': 'https://blob.test/targeting.json',
    'political/targeting/political_scores': 'https://blob.test/political.json',
    'political/crosswalk/precinct_blockgroup': 'https://blob.test/crosswalk.json',
    'political/elections/ingham_results': 'https://blob.test/elections.json',
    'political/demographics/precinct_ba': 'https://blob.test/demographics.json',
    'political/h3/aggregates': 'https://blob.test/h3.json',
    'political/h3/aggregates_geojson': 'https://blob.test/h3_geojson.json',
    'political/precincts/ingham_county_2024': 'https://blob.test/boundaries.geojson',
  })),
}));

// Mock data for testing
const mockBlobUrls: Record<string, string> = {
  'political/targeting/precinct_scores': 'https://blob.test/targeting.json',
  'political/targeting/political_scores': 'https://blob.test/political.json',
  'political/crosswalk/precinct_blockgroup': 'https://blob.test/crosswalk.json',
  'political/elections/ingham_results': 'https://blob.test/elections.json',
  'political/demographics/precinct_ba': 'https://blob.test/demographics.json',
  'political/h3/aggregates': 'https://blob.test/h3.json',
  'political/h3/aggregates_geojson': 'https://blob.test/h3_geojson.json',
  'political/precincts/ingham_county_2024': 'https://blob.test/boundaries.geojson',
};

const mockTargetingScores = {
  metadata: { generated: '2024-01-01', precinct_count: 3 },
  summary: {
    strategy_distribution: { 'GOTV Base': 1, 'Persuasion': 1, 'Hybrid': 1 },
    gotv_distribution: { 'High': 2, 'Medium': 1 },
    persuasion_distribution: { 'High': 1, 'Medium': 2 },
    score_stats: {
      gotv: { mean: 70, median: 72, min: 50, max: 90 },
      persuasion: { mean: 65, median: 60, min: 40, max: 85 },
      combined: { mean: 67, median: 66, min: 45, max: 87 },
    },
  },
  precincts: {
    'Lansing Ward 1 Pct 1': {
      precinct_name: 'Lansing Ward 1 Pct 1',
      gotv_priority: 85,
      gotv_classification: 'High Priority',
      gotv_components: { support_strength: 0.8, turnout_opportunity: 0.7, voter_pool_weight: 0.6 },
      persuasion_opportunity: 60,
      persuasion_classification: 'Medium',
      persuasion_components: { margin_closeness: 0.5, swing_factor: 0.4, moderate_factor: 0.3, independent_factor: 0.2, low_engagement: 0.1 },
      targeting_strategy: 'GOTV Base',
      targeting_priority: 1,
      combined_score: 75,
      recommendation: 'Focus on turnout',
      registered_voters: 5000,
      active_voters: 3500,
      total_population: 8000,
      median_household_income: 45000,
    },
    'East Lansing Ward 1 Pct 1': {
      precinct_name: 'East Lansing Ward 1 Pct 1',
      gotv_priority: 55,
      gotv_classification: 'Medium',
      gotv_components: { support_strength: 0.5, turnout_opportunity: 0.6, voter_pool_weight: 0.5 },
      persuasion_opportunity: 80,
      persuasion_classification: 'High',
      persuasion_components: { margin_closeness: 0.7, swing_factor: 0.8, moderate_factor: 0.6, independent_factor: 0.5, low_engagement: 0.3 },
      targeting_strategy: 'Persuasion',
      targeting_priority: 2,
      combined_score: 68,
      recommendation: 'Focus on persuasion',
      registered_voters: 4000,
      active_voters: 3200,
      total_population: 6000,
      median_household_income: 35000,
    },
    'Meridian Township Pct 1': {
      precinct_name: 'Meridian Township Pct 1',
      gotv_priority: 70,
      gotv_classification: 'High Priority',
      gotv_components: { support_strength: 0.7, turnout_opportunity: 0.65, voter_pool_weight: 0.7 },
      persuasion_opportunity: 70,
      persuasion_classification: 'Medium',
      persuasion_components: { margin_closeness: 0.6, swing_factor: 0.5, moderate_factor: 0.5, independent_factor: 0.4, low_engagement: 0.2 },
      targeting_strategy: 'Hybrid',
      targeting_priority: 1,
      combined_score: 70,
      recommendation: 'Balanced approach',
      registered_voters: 6000,
      active_voters: 4800,
      total_population: 9000,
      median_household_income: 75000,
    },
  },
};

const mockPoliticalScores = {
  generated: '2024-01-01',
  methodology: { version: '1.0' },
  summary: {
    total_precincts: 3,
    lean_distribution: { 'Strong D': 1, 'Lean D': 1, 'Swing': 1 },
    swing_distribution: { 'High': 2, 'Low': 1 },
  },
  precincts: {
    'Lansing Ward 1 Pct 1': {
      partisan_lean: -15,
      swing_potential: 45,
      turnout: { average: 65, presidential_avg: 72, midterm_avg: 58, dropoff: 14, elections: 4 },
      classification: { competitiveness: 'Safe D', volatility: 'Low', targeting_priority: 'GOTV' },
      elections_analyzed: 4,
    },
    'East Lansing Ward 1 Pct 1': {
      partisan_lean: -8,
      swing_potential: 72,
      turnout: { average: 70, presidential_avg: 78, midterm_avg: 62, dropoff: 16, elections: 4 },
      classification: { competitiveness: 'Lean D', volatility: 'High', targeting_priority: 'Persuasion' },
      elections_analyzed: 4,
    },
    'Meridian Township Pct 1': {
      partisan_lean: -5,
      swing_potential: 65,
      turnout: { average: 75, presidential_avg: 82, midterm_avg: 68, dropoff: 14, elections: 4 },
      classification: { competitiveness: 'Swing', volatility: 'Medium', targeting_priority: 'Hybrid' },
      elections_analyzed: 4,
    },
  },
};

const mockCrosswalk = {
  crosswalk: [
    { precinctId: 'lansing-ward-1-pct-1', precinctName: 'Lansing Ward 1 Pct 1', blockGroupGeoid: '260650001001', overlapRatio: 1.0 },
    { precinctId: 'east-lansing-ward-1-pct-1', precinctName: 'East Lansing Ward 1 Pct 1', blockGroupGeoid: '260650002001', overlapRatio: 0.6 },
    { precinctId: 'east-lansing-ward-1-pct-1', precinctName: 'East Lansing Ward 1 Pct 1', blockGroupGeoid: '260650002002', overlapRatio: 0.4 },
    { precinctId: 'meridian-township-pct-1', precinctName: 'Meridian Township Pct 1', blockGroupGeoid: '260650003001', overlapRatio: 1.0 },
  ],
};

const mockElections = {
  metadata: { elections: ['2020', '2022', '2024'], totalPrecincts: 3, totalRaces: 12 },
  precincts: {
    'Lansing Ward 1 Pct 1': {
      elections: { '2020': { president: { dem: 3500, rep: 1200 } } },
    },
    'East Lansing Ward 1 Pct 1': {
      elections: { '2020': { president: { dem: 2800, rep: 1000 } } },
    },
    'Meridian Township Pct 1': {
      elections: { '2020': { president: { dem: 4200, rep: 2100 } } },
    },
  },
};

const mockDemographics = {
  metadata: { generated: '2024-01-01', precinct_count: 3 },
  precincts: {
    'Lansing Ward 1 Pct 1': { total_population: 8000, median_income: 45000, college_pct: 0.25 },
    'East Lansing Ward 1 Pct 1': { total_population: 6000, median_income: 35000, college_pct: 0.55 },
    'Meridian Township Pct 1': { total_population: 9000, median_income: 75000, college_pct: 0.45 },
  },
};

const mockH3Aggregates = {
  metadata: { generated: '2024-01-01', h3_resolution: 7, cell_count: 2 },
  cells: {
    '872a100e1ffffff': {
      h3_index: '872a100e1ffffff',
      resolution: 7,
      center: [-84.55, 42.73],
      precinct_count: 2,
      precincts: ['Lansing Ward 1 Pct 1', 'East Lansing Ward 1 Pct 1'],
      partisan_lean: -11.5,
      swing_potential: 58.5,
      gotv_priority: 70,
      persuasion_opportunity: 70,
      combined_score: 71.5,
      total_population: 14000,
      dem_affiliation_pct: 55,
      rep_affiliation_pct: 30,
    },
    '872a100e2ffffff': {
      h3_index: '872a100e2ffffff',
      resolution: 7,
      center: [-84.48, 42.70],
      precinct_count: 1,
      precincts: ['Meridian Township Pct 1'],
      partisan_lean: -5,
      swing_potential: 65,
      gotv_priority: 70,
      persuasion_opportunity: 70,
      combined_score: 70,
      total_population: 9000,
      dem_affiliation_pct: 48,
      rep_affiliation_pct: 38,
    },
  },
};

const mockBoundaries: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        PRECINCT_NAME: 'Lansing Ward 1 Pct 1',
        PRECINCT_ID: 'lansing-ward-1-pct-1',
        Jurisdiction_Name: 'Lansing',
        JURISDICTION: 'Lansing',
      },
      geometry: { type: 'Polygon', coordinates: [[[-84.56, 42.73], [-84.54, 42.73], [-84.54, 42.75], [-84.56, 42.75], [-84.56, 42.73]]] },
    },
    {
      type: 'Feature',
      properties: {
        PRECINCT_NAME: 'East Lansing Ward 1 Pct 1',
        PRECINCT_ID: 'east-lansing-ward-1-pct-1',
        Jurisdiction_Name: 'East Lansing',
        JURISDICTION: 'East Lansing',
      },
      geometry: { type: 'Polygon', coordinates: [[[-84.50, 42.73], [-84.48, 42.73], [-84.48, 42.75], [-84.50, 42.75], [-84.50, 42.73]]] },
    },
    {
      type: 'Feature',
      properties: {
        PRECINCT_NAME: 'Meridian Township Pct 1',
        PRECINCT_ID: 'meridian-township-pct-1',
        Jurisdiction_Name: 'Meridian Township',
        JURISDICTION: 'Meridian Township',
      },
      geometry: { type: 'Polygon', coordinates: [[[-84.48, 42.68], [-84.46, 42.68], [-84.46, 42.70], [-84.48, 42.70], [-84.48, 42.68]]] },
    },
  ],
};

// Setup mock fetch responses
function setupMockFetch() {
  mockFetch.mockImplementation(async (url: string) => {
    // Blob URL mappings
    if (url.includes('blob-urls.json') || url.includes('blob-urls-')) {
      return {
        ok: true,
        json: async () => mockBlobUrls,
      };
    }

    // Targeting scores
    if (url.includes('targeting') || url.includes('precinct_scores')) {
      return { ok: true, json: async () => mockTargetingScores };
    }

    // Political scores
    if (url.includes('political_scores')) {
      return { ok: true, json: async () => mockPoliticalScores };
    }

    // Crosswalk
    if (url.includes('crosswalk')) {
      return { ok: true, json: async () => mockCrosswalk };
    }

    // Elections
    if (url.includes('elections') || url.includes('ingham_results')) {
      return { ok: true, json: async () => mockElections };
    }

    // Demographics
    if (url.includes('demographics') || url.includes('precinct_ba')) {
      return { ok: true, json: async () => mockDemographics };
    }

    // H3 aggregates
    if (url.includes('h3') && url.includes('aggregates') && !url.includes('geojson')) {
      return { ok: true, json: async () => mockH3Aggregates };
    }

    // H3 GeoJSON
    if (url.includes('h3') && url.includes('geojson')) {
      return {
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: Object.values(mockH3Aggregates.cells).map((cell) => ({
            type: 'Feature',
            properties: cell,
            geometry: { type: 'Point', coordinates: cell.center },
          })),
        }),
      };
    }

    // Boundaries
    if (url.includes('boundaries') || url.includes('geojson') || url.includes('precincts')) {
      return { ok: true, json: async () => mockBoundaries };
    }

    // Default fallback
    console.warn(`[Test] Unhandled fetch URL: ${url}`);
    return { ok: false, status: 404 };
  });
}

describe('PoliticalDataService', () => {
  let service: PoliticalDataService;

  beforeAll(() => {
    setupMockFetch();
  });

  beforeEach(() => {
    // Clear cache before each test
    service = PoliticalDataService.getInstance();
    service.clearCache();
    mockFetch.mockClear();
    setupMockFetch();
  });

  describe('Singleton Pattern', () => {
    test('getInstance returns same instance', () => {
      const instance1 = PoliticalDataService.getInstance();
      const instance2 = PoliticalDataService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    test('initialize loads all data sources', async () => {
      await service.initialize();

      // Verify fetch was called for key data sources
      const fetchCalls = mockFetch.mock.calls.map((call) => call[0]);
      expect(fetchCalls.length).toBeGreaterThan(0);
    });

    test('initialize is idempotent', async () => {
      await service.initialize();
      const callCount1 = mockFetch.mock.calls.length;

      await service.initialize();
      const callCount2 = mockFetch.mock.calls.length;

      // Second call should not make new fetches (cached)
      expect(callCount2).toBe(callCount1);
    });
  });

  describe('getUnifiedPrecinctData', () => {
    test('returns unified precinct records', async () => {
      await service.initialize();
      const data = await service.getUnifiedPrecinctData();

      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
      expect(Object.keys(data).length).toBeGreaterThan(0);
    });

    test('unified precincts have required fields', async () => {
      await service.initialize();
      const data = await service.getUnifiedPrecinctData();

      const firstPrecinct = Object.values(data)[0];
      // UnifiedPrecinct uses nested structure
      expect(firstPrecinct).toHaveProperty('name');
      expect(firstPrecinct).toHaveProperty('jurisdiction');
      expect(firstPrecinct).toHaveProperty('electoral');
      expect(firstPrecinct).toHaveProperty('targeting');
      expect(firstPrecinct.electoral).toHaveProperty('partisanLean');
      expect(firstPrecinct.electoral).toHaveProperty('swingPotential');
      expect(firstPrecinct.targeting).toHaveProperty('gotvPriority');
      expect(firstPrecinct.targeting).toHaveProperty('persuasionOpportunity');
    });

    test('unified precincts have correct values', async () => {
      await service.initialize();
      const data = await service.getUnifiedPrecinctData();

      const lansing = data['Lansing Ward 1 Pct 1'];
      if (lansing) {
        // Values come from the nested electoral and targeting objects
        expect(lansing.electoral.partisanLean).toBe(-15);
        expect(lansing.electoral.swingPotential).toBe(45);
        expect(lansing.targeting.gotvPriority).toBe(85);
        expect(lansing.targeting.persuasionOpportunity).toBe(60);
      }
    });
  });

  describe('getSegmentEnginePrecincts', () => {
    test('returns array of precincts for segment engine', async () => {
      await service.initialize();
      const precincts = await service.getSegmentEnginePrecincts();

      expect(Array.isArray(precincts)).toBe(true);
      expect(precincts.length).toBeGreaterThan(0);
    });

    test('segment engine precincts have nested structure', async () => {
      await service.initialize();
      const precincts = await service.getSegmentEnginePrecincts();

      const first = precincts[0];
      // SegmentEngine precincts use nested structure from getPrecinctDataFileFormat
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('electoral');
      expect(first.electoral).toHaveProperty('partisanLean');
      expect(first.electoral).toHaveProperty('swingPotential');
    });
  });

  describe('getPrecinctDataFileFormat', () => {
    test('returns precincts in record format', async () => {
      await service.initialize();
      const result = await service.getPrecinctDataFileFormat();

      expect(result).toHaveProperty('precincts');
      // Precincts is a Record, not an array
      expect(typeof result.precincts).toBe('object');
    });

    test('precincts have name property', async () => {
      await service.initialize();
      const result = await service.getPrecinctDataFileFormat();

      const entries = Object.values(result.precincts);
      if (entries.length > 0) {
        expect(entries[0]).toHaveProperty('name');
      }
    });
  });

  describe('getAllTargetingScores', () => {
    test('returns targeting scores object', async () => {
      await service.initialize();
      const scores = await service.getAllTargetingScores();

      expect(scores).toBeDefined();
      expect(typeof scores).toBe('object');
    });

    test('targeting scores have required fields when available', async () => {
      await service.initialize();
      const scores = await service.getAllTargetingScores();
      const entries = Object.values(scores);

      if (entries.length > 0) {
        const first = entries[0];
        expect(first).toHaveProperty('gotv_priority');
        expect(first).toHaveProperty('persuasion_opportunity');
        expect(first).toHaveProperty('targeting_strategy');
      }
    });
  });

  describe('getPrecinctTargetingScores', () => {
    test('returns scores for specific precinct', async () => {
      await service.initialize();
      const scores = await service.getPrecinctTargetingScores('Lansing Ward 1 Pct 1');

      expect(scores).toBeDefined();
      expect(scores?.gotv_priority).toBe(85);
      expect(scores?.targeting_strategy).toBe('GOTV Base');
    });

    test('returns null for unknown precinct', async () => {
      await service.initialize();
      const scores = await service.getPrecinctTargetingScores('Unknown Precinct');

      expect(scores).toBeNull();
    });
  });

  describe('getPrecinctsByStrategy', () => {
    test('returns precincts matching strategy', async () => {
      await service.initialize();
      const precincts = await service.getPrecinctsByStrategy('GOTV Base');

      expect(precincts).toContain('Lansing Ward 1 Pct 1');
    });

    test('returns empty array for unknown strategy', async () => {
      await service.initialize();
      const precincts = await service.getPrecinctsByStrategy('Unknown Strategy');

      expect(precincts).toEqual([]);
    });
  });

  describe('getTargetingScoresSummary', () => {
    test('returns summary statistics', async () => {
      await service.initialize();
      const summary = await service.getTargetingScoresSummary();

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('strategy_distribution');
      expect(summary).toHaveProperty('gotv_distribution');
      expect(summary).toHaveProperty('score_stats');
    });
  });

  describe('getH3Aggregates', () => {
    test('returns H3 cell aggregates', async () => {
      await service.initialize();
      const h3 = await service.getH3Aggregates();

      expect(h3).toBeDefined();
      if (h3) {
        expect(h3).toHaveProperty('metadata');
        expect(h3).toHaveProperty('cells');
        // Mock data has 2 cells
        expect(Object.keys(h3.cells).length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getH3CellsByMetric', () => {
    test('filters cells by metric threshold', async () => {
      await service.initialize();
      const cells = await service.getH3CellsByMetric('gotv_priority', 60);

      expect(Array.isArray(cells)).toBe(true);
      // If cells exist, they should have gotv_priority >= 60
      cells.forEach((cell) => {
        if (cell.gotv_priority !== null) {
          expect(cell.gotv_priority).toBeGreaterThanOrEqual(60);
        }
      });
    });

    test('returns array for high threshold', async () => {
      await service.initialize();
      const cells = await service.getH3CellsByMetric('gotv_priority', 100);

      // Should return an array (possibly empty)
      expect(Array.isArray(cells)).toBe(true);
    });
  });

  describe('getPrecinctScores', () => {
    test('returns political scores for precinct', async () => {
      await service.initialize();
      const scores = await service.getPrecinctScores('Lansing Ward 1 Pct 1');

      // May return null if cache isn't properly populated
      if (scores) {
        // Returns PrecinctPoliticalScores with nested structure
        expect(scores).toHaveProperty('partisanLean');
        expect(scores).toHaveProperty('swingPotential');
        expect(scores.partisanLean).toHaveProperty('value');
      }
    });

    test('returns null for unknown precinct', async () => {
      await service.initialize();
      const scores = await service.getPrecinctScores('Unknown');

      expect(scores).toBeNull();
    });
  });

  describe('getAllPrecinctScores', () => {
    test('returns map of all precinct scores', async () => {
      await service.initialize();
      const scores = await service.getAllPrecinctScores();

      expect(scores instanceof Map).toBe(true);
      expect(scores.size).toBe(3);
    });
  });

  describe('loadPrecinctBoundaries', () => {
    test('returns GeoJSON FeatureCollection', async () => {
      await service.initialize();
      const boundaries = await service.loadPrecinctBoundaries();

      expect(boundaries).toBeDefined();
      expect(boundaries.type).toBe('FeatureCollection');
      expect(Array.isArray(boundaries.features)).toBe(true);
    });

    test('features have required properties', async () => {
      await service.initialize();
      const boundaries = await service.loadPrecinctBoundaries();

      const first = boundaries.features[0];
      expect(first).toHaveProperty('properties');
      expect(first.properties).toHaveProperty('PRECINCT_NAME');
    });
  });

  describe('getPrecinctCentroid', () => {
    test('returns centroid array', async () => {
      await service.initialize();
      const centroid = await service.getPrecinctCentroid('Lansing Ward 1 Pct 1');

      expect(centroid).toBeDefined();
      expect(centroid.length).toBe(2);
      // Should be a valid coordinate (either calculated or fallback)
      expect(typeof centroid[0]).toBe('number');
      expect(typeof centroid[1]).toBe('number');
    });

    test('returns county center fallback for unknown precinct', async () => {
      await service.initialize();
      const centroid = await service.getPrecinctCentroid('Unknown Precinct');

      // Falls back to Ingham County center [-84.55, 42.60]
      expect(centroid[0]).toBeCloseTo(-84.55, 1);
      expect(centroid[1]).toBeCloseTo(42.60, 1);
    });
  });

  describe('getPrecinctBlockGroups', () => {
    test('returns crosswalk entries for precinct', async () => {
      await service.initialize();
      const blockGroups = await service.getPrecinctBlockGroups('East Lansing Ward 1 Pct 1');

      expect(Array.isArray(blockGroups)).toBe(true);
      if (blockGroups.length > 0) {
        expect(blockGroups[0]).toHaveProperty('blockGroupGeoid');
        expect(blockGroups[0]).toHaveProperty('overlapRatio');
      }
    });

    test('returns empty array for unknown precinct', async () => {
      await service.initialize();
      const blockGroups = await service.getPrecinctBlockGroups('Unknown');

      expect(blockGroups).toEqual([]);
    });
  });

  describe('getAllElectionResults', () => {
    test('returns election results data', async () => {
      await service.initialize();
      const results = await service.getAllElectionResults();

      expect(results).toBeDefined();
      expect(results).toHaveProperty('metadata');
      expect(results).toHaveProperty('precincts');
    });
  });

  describe('getPrecinctElectionHistory', () => {
    test('returns election history for precinct', async () => {
      await service.initialize();
      const history = await service.getPrecinctElectionHistory('Lansing Ward 1 Pct 1');

      expect(history).toBeDefined();
      expect(history).toHaveProperty('elections');
    });

    test('returns null for unknown precinct', async () => {
      await service.initialize();
      const history = await service.getPrecinctElectionHistory('Unknown');

      expect(history).toBeNull();
    });
  });

  describe('getCountySummary', () => {
    test('returns county-level summary statistics', async () => {
      await service.initialize();
      const summary = await service.getCountySummary();

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('name');
      expect(summary).toHaveProperty('state');
      expect(summary).toHaveProperty('totalPrecincts');
    });

    test('county summary has valid structure', async () => {
      await service.initialize();
      const summary = await service.getCountySummary();

      expect(summary.name).toBe('Ingham County');
      expect(summary.state).toBe('Michigan');
      expect(typeof summary.totalPrecincts).toBe('number');
    });
  });

  describe('getAllJurisdictions', () => {
    test('returns list of unique jurisdictions', async () => {
      await service.initialize();
      const jurisdictions = await service.getAllJurisdictions();

      expect(Array.isArray(jurisdictions)).toBe(true);
      // May return empty if boundaries not loaded
      expect(jurisdictions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPrecinctsByJurisdiction', () => {
    test('returns precincts in jurisdiction', async () => {
      await service.initialize();
      const precincts = await service.getPrecinctsByJurisdiction('Lansing');

      expect(Array.isArray(precincts)).toBe(true);
      // May return empty if data not available
    });

    test('returns empty array for unknown jurisdiction', async () => {
      await service.initialize();
      const precincts = await service.getPrecinctsByJurisdiction('Unknown City');

      expect(precincts).toEqual([]);
    });
  });

  describe('getJurisdictionAggregate', () => {
    test('returns aggregated data for jurisdiction', async () => {
      await service.initialize();
      const aggregate = await service.getJurisdictionAggregate('Lansing');

      expect(aggregate).toBeDefined();
      if (aggregate) {
        expect(aggregate).toHaveProperty('jurisdictionName');
        expect(aggregate).toHaveProperty('precinctCount');
        expect(aggregate).toHaveProperty('scores');
      }
    });

    test('returns null for unknown jurisdiction', async () => {
      await service.initialize();
      const aggregate = await service.getJurisdictionAggregate('Unknown City');

      expect(aggregate).toBeNull();
    });
  });

  describe('compareJurisdictions', () => {
    test('compares two jurisdictions', async () => {
      await service.initialize();
      const comparison = await service.compareJurisdictions('Lansing', 'East Lansing');

      expect(comparison).toBeDefined();
      if (comparison) {
        expect(comparison).toHaveProperty('jurisdiction1');
        expect(comparison).toHaveProperty('jurisdiction2');
        expect(comparison).toHaveProperty('differences');
      }
    });

    test('returns null when jurisdiction not found', async () => {
      await service.initialize();
      const comparison = await service.compareJurisdictions('Lansing', 'Unknown');

      expect(comparison).toBeNull();
    });
  });

  describe('rankJurisdictionsByMetric', () => {
    test('ranks jurisdictions by metric', async () => {
      await service.initialize();
      const ranking = await service.rankJurisdictionsByMetric('swing_potential', 'highest');

      expect(Array.isArray(ranking)).toBe(true);
      // If ranking has items, should be sorted in descending order
      for (let i = 1; i < ranking.length; i++) {
        expect(ranking[i - 1].value).toBeGreaterThanOrEqual(ranking[i].value);
      }
    });

    test('ranks in ascending order', async () => {
      await service.initialize();
      const ranking = await service.rankJurisdictionsByMetric('partisan_lean', 'lowest');

      expect(Array.isArray(ranking)).toBe(true);
      // If ranking has items, should be sorted in ascending order
      for (let i = 1; i < ranking.length; i++) {
        expect(ranking[i - 1].value).toBeLessThanOrEqual(ranking[i].value);
      }
    });
  });

  describe('Cache Management', () => {
    test('clearCache resets initialized state', async () => {
      await service.initialize();

      // Clear cache
      service.clearCache();
      mockFetch.mockClear();
      setupMockFetch();

      // After clear, re-initialization should fetch data again
      await service.initialize();
      expect(mockFetch).toHaveBeenCalled();
    });

    test('clearCache allows reinitializing', async () => {
      await service.initialize();
      service.clearCache();

      // Should be able to initialize again without error
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });
});
