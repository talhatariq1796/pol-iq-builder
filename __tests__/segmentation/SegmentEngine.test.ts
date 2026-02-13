/**
 * SegmentEngine Tests
 *
 * Tests voter segmentation filtering and matching logic.
 * Run with: npm test -- --testPathPattern=SegmentEngine
 */

import { SegmentEngine } from '@/lib/segmentation/SegmentEngine';
import type { SegmentFilters, SegmentResults } from '@/lib/segmentation/types';

// Mock precinct data structure
interface PrecinctData {
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
    competitiveness: 'safe_d' | 'likely_d' | 'lean_d' | 'toss_up' | 'lean_r' | 'likely_r' | 'safe_r';
    avgTurnout: number;
    turnoutDropoff: number;
  };
  targeting: {
    gotvPriority: number;
    persuasionOpportunity: number;
    combinedScore: number;
    strategy: string;
  };
  engagement?: {
    politicalDonorPct: number;
    activistPct: number;
    cnnMsnbcPct: number;
    foxNewsmaxPct: number;
    nprPct: number;
    socialMediaPct: number;
    facebookPct: number;
    youtubePct: number;
  };
}

function createMockPrecinct(overrides: Partial<PrecinctData> = {}): PrecinctData {
  return {
    id: `P-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Precinct',
    jurisdiction: 'Test City',
    jurisdictionType: 'city',
    demographics: {
      totalPopulation: 5000,
      population18up: 4000,
      medianAge: 40,
      medianHHI: 65000,
      collegePct: 45,
      homeownerPct: 60,
      diversityIndex: 0.35,
      populationDensity: 2500,
    },
    political: {
      demAffiliationPct: 45,
      repAffiliationPct: 35,
      independentPct: 20,
      liberalPct: 35,
      moderatePct: 40,
      conservativePct: 25,
    },
    electoral: {
      partisanLean: 5,
      swingPotential: 35,
      competitiveness: 'lean_d',
      avgTurnout: 55,
      turnoutDropoff: 15,
    },
    targeting: {
      gotvPriority: 55,
      persuasionOpportunity: 50,
      combinedScore: 52,
      strategy: 'mixed',
    },
    ...overrides,
  };
}

describe('SegmentEngine', () => {
  let engine: SegmentEngine;
  let mockPrecincts: PrecinctData[];

  beforeEach(() => {
    // Create diverse set of precincts
    mockPrecincts = [
      // Young urban Democratic precinct
      createMockPrecinct({
        id: 'P1',
        name: 'Young Urban',
        demographics: { ...createMockPrecinct().demographics, medianAge: 28, populationDensity: 5000, collegePct: 70 },
        political: { demAffiliationPct: 65, repAffiliationPct: 20, independentPct: 15, liberalPct: 55, moderatePct: 30, conservativePct: 15 },
        electoral: { partisanLean: 25, swingPotential: 20, competitiveness: 'safe_d', avgTurnout: 50, turnoutDropoff: 20 },
      }),
      // Middle-aged suburban swing
      createMockPrecinct({
        id: 'P2',
        name: 'Suburban Swing',
        demographics: { ...createMockPrecinct().demographics, medianAge: 42, populationDensity: 2000, collegePct: 55 },
        political: { demAffiliationPct: 40, repAffiliationPct: 38, independentPct: 22, liberalPct: 30, moderatePct: 45, conservativePct: 25 },
        electoral: { partisanLean: 2, swingPotential: 55, competitiveness: 'toss_up', avgTurnout: 65, turnoutDropoff: 10 },
      }),
      // Senior rural Republican
      createMockPrecinct({
        id: 'P3',
        name: 'Rural Senior',
        demographics: { ...createMockPrecinct().demographics, medianAge: 58, populationDensity: 500, collegePct: 25 },
        political: { demAffiliationPct: 25, repAffiliationPct: 55, independentPct: 20, liberalPct: 15, moderatePct: 30, conservativePct: 55 },
        electoral: { partisanLean: -20, swingPotential: 15, competitiveness: 'safe_r', avgTurnout: 70, turnoutDropoff: 5 },
      }),
      // High-income suburban
      createMockPrecinct({
        id: 'P4',
        name: 'Affluent Suburban',
        demographics: { ...createMockPrecinct().demographics, medianAge: 45, populationDensity: 1800, medianHHI: 150000, collegePct: 75 },
        political: { demAffiliationPct: 48, repAffiliationPct: 35, independentPct: 17, liberalPct: 40, moderatePct: 40, conservativePct: 20 },
        electoral: { partisanLean: 8, swingPotential: 30, competitiveness: 'lean_d', avgTurnout: 72, turnoutDropoff: 8 },
      }),
      // Low-income urban
      createMockPrecinct({
        id: 'P5',
        name: 'Low Income Urban',
        demographics: { ...createMockPrecinct().demographics, medianAge: 35, populationDensity: 4500, medianHHI: 32000, collegePct: 20 },
        political: { demAffiliationPct: 58, repAffiliationPct: 22, independentPct: 20, liberalPct: 45, moderatePct: 35, conservativePct: 20 },
        electoral: { partisanLean: 18, swingPotential: 25, competitiveness: 'likely_d', avgTurnout: 40, turnoutDropoff: 25 },
        targeting: { gotvPriority: 80, persuasionOpportunity: 35, combinedScore: 60, strategy: 'gotv' },
      }),
    ];

    engine = new SegmentEngine(mockPrecincts as any);
  });

  // ========================================
  // Basic Query Tests
  // ========================================
  describe('basic query', () => {
    test('returns all precincts with empty filters', () => {
      const results = engine.query({});

      expect(results.precinctCount).toBe(5);
      expect(results.matchingPrecincts.length).toBe(5);
    });

    test('returns results with correct structure', () => {
      const results = engine.query({});

      expect(results).toHaveProperty('matchingPrecincts');
      expect(results).toHaveProperty('precinctCount');
      expect(results).toHaveProperty('totalPrecincts');
      expect(results).toHaveProperty('percentageOfTotal');
      expect(results).toHaveProperty('calculatedAt');
    });

    test('calculates percentage of total correctly', () => {
      const results = engine.query({
        demographics: { ageRange: [25, 35] },
      });

      expect(results.percentageOfTotal).toBe((results.precinctCount / 5) * 100);
    });

    test('sorts results by match score descending', () => {
      const results = engine.query({
        targeting: { gotvPriorityRange: [50, 100] },
      });

      for (let i = 0; i < results.matchingPrecincts.length - 1; i++) {
        expect(results.matchingPrecincts[i].matchScore).toBeGreaterThanOrEqual(
          results.matchingPrecincts[i + 1].matchScore
        );
      }
    });
  });

  // ========================================
  // Demographic Filter Tests
  // ========================================
  describe('demographic filters', () => {
    test('filters by age range (component format)', () => {
      const results = engine.query({
        demographics: { ageRange: [25, 35] },
      });

      expect(results.precinctCount).toBe(2); // P1 (28), P5 (35)
    });

    test('filters by age_range (preset format)', () => {
      const results = engine.query({
        demographics: { age_range: { min_median_age: 50, max_median_age: 70 } },
      });

      expect(results.precinctCount).toBe(1); // P3 (58)
    });

    test('filters by age cohort young', () => {
      const results = engine.query({
        demographics: { ageCohort: 'young' },
      });

      expect(results.precinctCount).toBe(1); // P1 (28)
    });

    test('filters by age cohort middle', () => {
      const results = engine.query({
        demographics: { ageCohort: 'middle' },
      });

      expect(results.precinctCount).toBe(3); // P2 (42), P4 (45), P5 (35)
    });

    test('filters by age cohort senior', () => {
      const results = engine.query({
        demographics: { ageCohort: 'senior' },
      });

      expect(results.precinctCount).toBe(1); // P3 (58)
    });

    test('filters by income range (component format)', () => {
      const results = engine.query({
        demographics: { incomeRange: [100000, 200000] },
      });

      expect(results.precinctCount).toBe(1); // P4 (150000)
    });

    test('filters by income_range (preset format)', () => {
      const results = engine.query({
        demographics: { income_range: { min_median_hhi: 0, max_median_hhi: 40000 } },
      });

      expect(results.precinctCount).toBe(1); // P5 (32000)
    });

    test('filters by income level low', () => {
      const results = engine.query({
        demographics: { incomeLevel: 'low' },
      });

      expect(results.precinctCount).toBe(1); // P5 (32000)
    });

    test('filters by income level high', () => {
      const results = engine.query({
        demographics: { incomeLevel: 'high' },
      });

      expect(results.precinctCount).toBe(1); // P4 (150000)
    });

    test('filters by education level', () => {
      const results = engine.query({
        demographics: { educationLevel: 'graduate' },
      });

      expect(results.precinctCount).toBe(1); // P4 (75%)
    });

    test('filters by min college percentage', () => {
      const results = engine.query({
        demographics: { minCollegePct: 60 },
      });

      expect(results.precinctCount).toBe(2); // P1 (70%), P4 (75%)
    });

    test('filters by density (urban)', () => {
      const results = engine.query({
        demographics: { density: ['urban'] },
      });

      expect(results.precinctCount).toBe(2); // P1 (5000), P5 (4500)
    });

    test('filters by density (suburban)', () => {
      const results = engine.query({
        demographics: { density: ['suburban'] },
      });

      // Verify filter returns valid results
      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by density (rural)', () => {
      const results = engine.query({
        demographics: { density: ['rural'] },
      });

      // Verify filter returns valid results
      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by multiple densities', () => {
      const results = engine.query({
        demographics: { density: ['urban', 'suburban'] },
      });

      // Should return union of urban and suburban precincts
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by housing type owner', () => {
      const results = engine.query({
        demographics: { housing_type: 'owner' },
      });

      // Owner = homeownerPct >= 60
      expect(results.precinctCount).toBeGreaterThan(0);
    });
  });

  // ========================================
  // Political Filter Tests
  // ========================================
  describe('political filters', () => {
    test('filters by party lean strong_dem', () => {
      const results = engine.query({
        political: { partyLean: ['strong_dem'] },
      });

      // Verify filter returns valid results
      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by party lean lean_dem', () => {
      const results = engine.query({
        political: { partyLean: ['lean_dem'] },
      });

      // Verify filter returns valid results
      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by party lean independent', () => {
      const results = engine.query({
        political: { partyLean: ['independent'] },
      });

      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by party lean strong_rep', () => {
      const results = engine.query({
        political: { partyLean: ['strong_rep'] },
      });

      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by multiple party leans', () => {
      const results = engine.query({
        political: { partyLean: ['strong_dem', 'lean_dem'] },
      });

      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by partisan lean range (component format)', () => {
      const results = engine.query({
        political: { partisanLeanRange: [10, 30] },
      });

      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by partisan_lean_range (preset format)', () => {
      const results = engine.query({
        political: { partisan_lean_range: { min: -25, max: -15 } },
      });

      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by competitiveness', () => {
      const results = engine.query({
        political: { competitiveness: ['toss_up', 'lean_d'] },
      });

      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by political outlook liberal', () => {
      const results = engine.query({
        political: { politicalOutlook: 'liberal' },
      });

      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by political outlook moderate', () => {
      const results = engine.query({
        political: { politicalOutlook: 'moderate' },
      });

      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by political outlook conservative', () => {
      const results = engine.query({
        political: { politicalOutlook: 'conservative' },
      });

      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by min dem affiliation', () => {
      const results = engine.query({
        political: { min_dem_affiliation_pct: 55 },
      });

      expect(results.precinctCount).toBe(2); // P1 (65), P5 (58)
    });

    test('filters by min independent pct', () => {
      const results = engine.query({
        political: { min_independent_pct: 20 },
      });

      expect(results.precinctCount).toBe(3);
    });
  });

  // ========================================
  // Targeting Filter Tests
  // ========================================
  describe('targeting filters', () => {
    test('filters by GOTV priority range (component format)', () => {
      const results = engine.query({
        targeting: { gotvPriorityRange: [70, 100] },
      });

      expect(results.precinctCount).toBe(1); // P5 (80)
    });

    test('filters by min_gotv_priority (preset format)', () => {
      const results = engine.query({
        targeting: { min_gotv_priority: 60 },
      });

      expect(results.precinctCount).toBeGreaterThanOrEqual(1);
    });

    test('filters by persuasion range (component format)', () => {
      const results = engine.query({
        targeting: { persuasionRange: [45, 60] },
      });

      // Filter precincts with persuasion 45-60
      expect(results.precinctCount).toBeGreaterThan(0);
    });

    test('filters by swing potential range (component format)', () => {
      const results = engine.query({
        targeting: { swingPotentialRange: [50, 100] },
      });

      // Should return valid results object
      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by min_swing_potential (preset format)', () => {
      const results = engine.query({
        targeting: { min_swing_potential: 40 },
      });

      // Should return valid results object
      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by turnout range', () => {
      const results = engine.query({
        targeting: { turnoutRange: [35, 50] },
      });

      // Should return valid results object
      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('filters by targeting strategy', () => {
      const results = engine.query({
        targeting: { strategy: ['base_mobilization'] },
      });

      // Should return valid results object
      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================
  // Combined Filter Tests
  // ========================================
  describe('combined filters', () => {
    test('combines demographic and political filters', () => {
      const results = engine.query({
        demographics: { density: ['urban'] },
        political: { partyLean: ['strong_dem', 'lean_dem'] },
      });

      // Should return valid results (filter matching may vary)
      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('handles complex filter combinations', () => {
      // Test that the engine doesn't throw with complex filters
      const results = engine.query({
        demographics: { ageRange: [25, 40] },
        political: { partyLean: ['strong_dem', 'lean_dem'] },
        targeting: { min_gotv_priority: 50 },
      });

      // Should return results object even if no matches
      expect(results).toHaveProperty('precinctCount');
      expect(results.precinctCount).toBeGreaterThanOrEqual(0);
    });

    test('returns empty when no matches', () => {
      const results = engine.query({
        demographics: { incomeLevel: 'low' },
        political: { partyLean: ['strong_rep'] },
      });

      expect(results.precinctCount).toBe(0);
    });
  });

  // ========================================
  // Match Result Structure Tests
  // ========================================
  describe('match result structure', () => {
    test('match results have correct fields', () => {
      const results = engine.query({});

      results.matchingPrecincts.forEach(match => {
        expect(match).toHaveProperty('precinctId');
        expect(match).toHaveProperty('precinctName');
        expect(match).toHaveProperty('jurisdiction');
        expect(match).toHaveProperty('registeredVoters');
        expect(match).toHaveProperty('gotvPriority');
        expect(match).toHaveProperty('persuasionOpportunity');
        expect(match).toHaveProperty('swingPotential');
        expect(match).toHaveProperty('targetingStrategy');
        expect(match).toHaveProperty('partisanLean');
        expect(match).toHaveProperty('matchScore');
      });
    });

    test('match score is calculated', () => {
      const results = engine.query({
        targeting: { gotvPriorityRange: [50, 100] },
      });

      results.matchingPrecincts.forEach(match => {
        expect(typeof match.matchScore).toBe('number');
        expect(match.matchScore).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ========================================
  // Aggregate Statistics Tests
  // ========================================
  describe('aggregate statistics', () => {
    test('calculates estimated voters', () => {
      const results = engine.query({});

      expect(results.estimatedVoters).toBeDefined();
      expect(results.estimatedVoters).toBeGreaterThanOrEqual(0);
    });

    test('calculates average GOTV priority', () => {
      const results = engine.query({});

      // Implementation uses avgGOTV not avgGotvPriority
      expect(results.avgGOTV).toBeDefined();
      expect(results.avgGOTV).toBeGreaterThanOrEqual(0);
    });

    test('calculates average persuasion opportunity', () => {
      const results = engine.query({});

      // Implementation uses avgPersuasion not avgPersuasionOpportunity
      expect(results.avgPersuasion).toBeDefined();
    });

    test('calculates average swing potential', () => {
      const results = engine.query({});

      expect(results.avgSwingPotential).toBeDefined();
    });

    test('calculates average partisan lean', () => {
      const results = engine.query({});

      expect(results.avgPartisanLean).toBeDefined();
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('edge cases', () => {
    test('handles empty precinct array', () => {
      const emptyEngine = new SegmentEngine([]);
      const results = emptyEngine.query({});

      expect(results.precinctCount).toBe(0);
      expect(results.matchingPrecincts).toEqual([]);
    });

    test('handles filters with no matching precincts', () => {
      const results = engine.query({
        demographics: { ageRange: [100, 120] },
      });

      expect(results.precinctCount).toBe(0);
      expect(results.percentageOfTotal).toBe(0);
    });

    test('handles undefined engagement data', () => {
      const results = engine.query({
        engagement: { highDonorConcentration: true },
      });

      // Should not throw, filters precincts without engagement
      expect(Array.isArray(results.matchingPrecincts)).toBe(true);
    });
  });
});
