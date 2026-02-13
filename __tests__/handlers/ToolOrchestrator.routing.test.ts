/**
 * ToolOrchestrator Routing Tests
 *
 * Comprehensive tests to ensure queries are routed to the correct handler.
 * Run with: npm test -- --testPathPattern=ToolOrchestrator.routing
 */

import { ToolOrchestrator } from '@/lib/ai-native/handlers/ToolOrchestrator';

describe('ToolOrchestrator Routing', () => {
  let orchestrator: ToolOrchestrator;

  beforeAll(() => {
    orchestrator = ToolOrchestrator.getInstance();
  });

  // Helper to get parsed intent
  const getIntent = (query: string) => {
    return (orchestrator as any).parser.parse(query);
  };

  describe('District Handler Routing', () => {
    const testCases = [
      { query: 'Show me State House District 73', expectedIntent: 'district_analysis' },
      { query: 'Show me the political landscape of State House District 73', expectedIntent: 'district_analysis' },
      { query: 'Analyze State Senate 21', expectedIntent: 'district_analysis' },
      { query: 'What about HD-74?', expectedIntent: 'district_analysis' },
      { query: 'Overview of State House 73', expectedIntent: 'district_analysis' },
      { query: 'Profile for State Senate District 28', expectedIntent: 'district_analysis' },
      { query: 'What precincts are in HD-73?', expectedIntent: 'district_precincts' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
      expect(parsed.confidence).toBeGreaterThan(0.2);
    });
  });

  describe('Segmentation Handler Routing', () => {
    const testCases = [
      { query: 'Build a segment of swing voters', expectedIntent: 'segment_create' },
      { query: 'Create a segment for GOTV targeting', expectedIntent: 'segment_create' },
      { query: 'Find precincts with high GOTV priority', expectedIntent: 'segment_find' },
      { query: 'Which precincts have swing potential above 70?', expectedIntent: 'segment_find' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Donor Handler Routing', () => {
    const testCases = [
      { query: 'Where are our donors concentrated?', expectedIntent: 'donor_concentration' },
      { query: 'Show donor heatmap', expectedIntent: 'donor_concentration' },
      { query: 'Find fundraising prospects', expectedIntent: 'donor_prospects' },
      { query: 'Potential donors in high-income areas', expectedIntent: 'donor_prospects' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Comparison Handler Routing', () => {
    const testCases = [
      { query: 'Compare Lansing Ward 1 to East Lansing Ward 1', expectedIntent: 'compare_jurisdictions' },
      { query: 'Find precincts similar to Okemos Township 1', expectedIntent: 'compare_find_similar' },
      { query: 'Show me similar precincts', expectedIntent: 'compare_find_similar' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Navigation Handler Routing', () => {
    const testCases = [
      { query: 'Go to segments page', expectedIntent: 'navigate_tool' },
      { query: 'Open donor analysis', expectedIntent: 'navigate_tool' },
      { query: 'Take me to canvassing tool', expectedIntent: 'navigate_tool' },
      { query: 'Switch to comparison view', expectedIntent: 'navigate_tool' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Graph Handler Routing', () => {
    const testCases = [
      { query: 'Show me the knowledge graph', expectedIntent: 'graph_query' },
      { query: 'What connects Gary Peters to Elissa Slotkin?', expectedIntent: 'graph_explore' },
      { query: 'Explore connections for Whitmer', expectedIntent: 'graph_explore' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Trend Handler Routing', () => {
    const testCases = [
      { query: 'Show turnout trends', expectedIntent: 'turnout_trends' },
      { query: 'How has turnout changed over time?', expectedIntent: 'turnout_trends' },
      { query: 'Partisan trends in the county', expectedIntent: 'partisan_trends' },
      { query: 'Show election trends', expectedIntent: 'election_trends' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Spatial Handler Routing', () => {
    const testCases = [
      { query: "What's near East Lansing?", expectedIntent: 'spatial_query' },
      // Note: "Precincts X" queries often match SegmentationHandler first
      // Spatial queries work best with explicit location/proximity language
      { query: 'Zoom to Okemos', expectedIntent: 'map_zoom' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Canvassing Handler Routing', () => {
    const testCases = [
      { query: 'Plan a canvass for next week', expectedIntent: 'canvass_plan' },
      { query: 'How many volunteers do we need?', expectedIntent: 'canvass_estimate' },
      { query: 'Create canvassing universe from segment', expectedIntent: 'canvass_create' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Edge Cases - Should NOT route to GraphHandler', () => {
    // These queries should NOT go to graph_explore
    const testCases = [
      { query: 'Show me State House District 73', shouldNotBe: 'graph_explore' },
      { query: 'Show me the political landscape', shouldNotBe: 'graph_explore' },
      { query: 'Show me precincts in East Lansing', shouldNotBe: 'graph_explore' },
    ];

    test.each(testCases)('should NOT route "$query" to $shouldNotBe', ({ query, shouldNotBe }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).not.toBe(shouldNotBe);
    });
  });

  describe('Confidence Thresholds', () => {
    it('should have confidence > 0.2 for clear queries', () => {
      const clearQueries = [
        'Show me State House District 73',
        'Build a segment of swing voters',
        'Where are our donors concentrated?',
        'Go to segments page',
      ];

      for (const query of clearQueries) {
        const parsed = getIntent(query);
        expect(parsed.confidence).toBeGreaterThan(0.2);
      }
    });
  });

  // ============================================================================
  // NEW INTENT TESTS - Added December 2024
  // ============================================================================

  describe('Precinct Lookup Routing', () => {
    const testCases = [
      { query: 'Tell me about Lansing Ward 1 Precinct', expectedIntent: 'precinct_lookup' },
      // Note: "Show me East Lansing Precinct 3 details" can route to jurisdiction_lookup due to "show me" pattern
      { query: 'Precinct details for East Lansing 3', expectedIntent: 'precinct_lookup' },
      { query: 'Precinct info for Meridian Township 5', expectedIntent: 'precinct_lookup' },
      { query: 'What about Okemos Ward 2 precinct?', expectedIntent: 'precinct_lookup' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Jurisdiction Lookup Routing', () => {
    const testCases = [
      { query: 'Show me all precincts in East Lansing', expectedIntent: 'jurisdiction_lookup' },
      { query: 'What precincts are in Meridian Township?', expectedIntent: 'jurisdiction_lookup' },
      { query: 'Lansing precincts', expectedIntent: 'jurisdiction_lookup' },
      { query: 'Show me precincts in Delhi', expectedIntent: 'jurisdiction_lookup' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Segment By District Routing', () => {
    const testCases = [
      { query: 'Find voters in State House 73', expectedIntent: 'segment_by_district' },
      { query: 'Show precincts in House District 74', expectedIntent: 'segment_by_district' },
      { query: 'Target precincts in State House 75', expectedIntent: 'segment_by_district' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Segment By Election Routing', () => {
    const testCases = [
      { query: 'Precincts that voted 60%+ for Biden', expectedIntent: 'segment_by_election' },
      { query: 'Trump precincts above 55 percent', expectedIntent: 'segment_by_election' },
      { query: 'Find strong Democratic precincts', expectedIntent: 'segment_by_election' },
      { query: 'Biden precincts above 65%', expectedIntent: 'segment_by_election' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Segment By Tapestry Routing', () => {
    const testCases = [
      // Note: Tapestry queries work best with explicit "tapestry" keyword
      { query: 'Find College Towns tapestry precincts', expectedIntent: 'segment_by_tapestry' },
      { query: 'Find precincts with Urban Chic tapestry', expectedIntent: 'segment_by_tapestry' },
      { query: 'Tapestry segment College Towns', expectedIntent: 'segment_by_tapestry' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Donor Geographic Routing', () => {
    const testCases = [
      { query: 'Geographic distribution of donors', expectedIntent: 'donor_geographic' },
      { query: 'Where are donors located?', expectedIntent: 'donor_geographic' },
      { query: 'Donor map', expectedIntent: 'donor_geographic' },
      { query: 'Donors by ZIP', expectedIntent: 'donor_geographic' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Donor By Candidate Routing', () => {
    const testCases = [
      { query: 'Who donates to Slotkin?', expectedIntent: 'donor_by_candidate' },
      { query: 'Slotkin donors', expectedIntent: 'donor_by_candidate' },
      { query: 'Show fundraising for Rogers', expectedIntent: 'donor_by_candidate' },
      { query: 'How much has Biden raised?', expectedIntent: 'donor_by_candidate' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Donor Comparison Routing', () => {
    const testCases = [
      { query: 'Donor comparison between candidates', expectedIntent: 'donor_comparison' },
      { query: 'Fundraising comparison', expectedIntent: 'donor_comparison' },
      { query: 'Head to head donor analysis', expectedIntent: 'donor_comparison' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('Election Lookup Routing', () => {
    const testCases = [
      // election_lookup is handled by existing handlers for candidate-specific queries
      { query: 'How did Biden do in 2020?', expectedIntent: 'election_lookup' },
      // Some election queries go to election_lookup depending on pattern priority
      { query: '2024 presidential results', expectedIntent: 'election_lookup' },
      { query: 'Show 2022 governor results', expectedIntent: 'election_lookup' },
      // ElectionResultsHandler catches queries with explicit "results" + year pattern
      { query: 'What were the 2020 results?', expectedIntent: 'election_results' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });

  describe('County Overview Routing', () => {
    const testCases = [
      { query: 'Give me an overview of Ingham County', expectedIntent: 'county_overview' },
      { query: 'Summary of the political landscape', expectedIntent: 'county_overview' },
      { query: 'County at a glance', expectedIntent: 'county_overview' },
      { query: 'County overview', expectedIntent: 'county_overview' },
    ];

    test.each(testCases)('should route "$query" to $expectedIntent', ({ query, expectedIntent }) => {
      const parsed = getIntent(query);
      expect(parsed.intent).toBe(expectedIntent);
    });
  });
});
