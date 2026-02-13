/**
 * Comparison Engine Tests
 *
 * Tests for ComparisonEngine and SimilarityEngine core functionality.
 * P2 Fix: Add comparison engine tests per codebase review.
 */

import { ComparisonEngine } from '../ComparisonEngine';
import { SimilarityEngine } from '../SimilarityEngine';
import type {
  PrecinctDataFile,
  PrecinctRawData,
  ComparisonEntity,
  CompetitivenessLevel,
} from '../types';

// ============================================================================
// Mock Data
// ============================================================================

const createMockPrecinct = (
  id: string,
  name: string,
  partisanLean: number,
  options: Partial<{
    population: number;
    medianAge: number;
    medianIncome: number;
    turnout: number;
    swingPotential: number;
    gotvPriority: number;
    persuasionOpportunity: number;
    competitiveness: CompetitivenessLevel;
    strategy: string;
  }> = {}
): PrecinctRawData => ({
  id,
  name,
  jurisdiction: 'Test City',
  jurisdictionType: 'city',
  demographics: {
    totalPopulation: options.population || 5000,
    population18up: Math.round((options.population || 5000) * 0.75),
    medianAge: options.medianAge || 35,
    medianHHI: options.medianIncome || 55000,
    collegePct: 45,
    homeownerPct: 65,
    diversityIndex: 0.4,
    populationDensity: 3000,
  },
  political: {
    demAffiliationPct: 35,
    repAffiliationPct: 30,
    independentPct: 35,
    liberalPct: 30,
    moderatePct: 40,
    conservativePct: 30,
  },
  electoral: {
    partisanLean,
    swingPotential: options.swingPotential || 50,
    competitiveness: options.competitiveness || 'tossup',
    avgTurnout: options.turnout || 65,
    turnoutDropoff: 5,
  },
  targeting: {
    gotvPriority: options.gotvPriority || 60,
    persuasionOpportunity: options.persuasionOpportunity || 50,
    combinedScore: 55,
    strategy: options.strategy || 'Battleground',
  },
  elections: {
    '2024': {
      demPct: 50 + partisanLean / 2,
      repPct: 50 - partisanLean / 2,
      margin: partisanLean,
      turnout: options.turnout || 65,
      ballotsCast: Math.round(((options.population || 5000) * 0.75) * ((options.turnout || 65) / 100)),
    },
    '2022': {
      demPct: 50 + partisanLean / 2 - 2,
      repPct: 50 - partisanLean / 2 + 2,
      margin: partisanLean - 4,
      turnout: (options.turnout || 65) - 10,
      ballotsCast: Math.round(((options.population || 5000) * 0.75) * (((options.turnout || 65) - 10) / 100)),
    },
  },
});

const createMockDataFile = (precincts: PrecinctRawData[]): PrecinctDataFile => ({
  metadata: {
    county: 'Test County',
    state: 'MI',
    created: new Date().toISOString(),
    precinctCount: precincts.length,
    dataYear: 2024,
  },
  precincts: Object.fromEntries(precincts.map(p => [p.id, p])),
  jurisdictions: [
    {
      id: 'test-city',
      name: 'Test City',
      type: 'city',
      precinctIds: precincts.map(p => p.id),
    },
  ],
});

// ============================================================================
// ComparisonEngine Tests
// ============================================================================

describe('ComparisonEngine', () => {
  const mockPrecincts = [
    createMockPrecinct('P001', 'East Side P1', -8, {
      population: 4500,
      medianIncome: 52000,
      swingPotential: 65,
      competitiveness: 'lean_d',
    }),
    createMockPrecinct('P002', 'West Side P2', 5, {
      population: 6000,
      medianIncome: 68000,
      swingPotential: 75,
      competitiveness: 'tossup',
    }),
    createMockPrecinct('P003', 'Downtown P3', -15, {
      population: 8000,
      medianIncome: 45000,
      swingPotential: 30,
      competitiveness: 'likely_d',
    }),
  ];

  const mockDataFile = createMockDataFile(mockPrecincts);
  let engine: ComparisonEngine;

  beforeEach(() => {
    engine = new ComparisonEngine(mockDataFile);
  });

  describe('buildPrecinctEntity', () => {
    it('should build entity from precinct ID', () => {
      const entity = engine.buildPrecinctEntity('P001');

      expect(entity.id).toBe('P001');
      expect(entity.name).toBe('East Side P1');
      expect(entity.type).toBe('precinct');
      expect(entity.demographics.totalPopulation).toBe(4500);
      expect(entity.politicalProfile.partisanLean).toBe(-8);
    });

    it('should build entity from precinct name (case-insensitive)', () => {
      const entity = engine.buildPrecinctEntity('east side p1');

      expect(entity.id).toBe('P001');
      expect(entity.name).toBe('East Side P1');
    });

    it('should throw error for non-existent precinct', () => {
      expect(() => engine.buildPrecinctEntity('P999')).toThrow(/not found/);
    });

    it('should include election history', () => {
      const entity = engine.buildPrecinctEntity('P001');

      expect(entity.electionHistory).toBeDefined();
      expect(entity.electionHistory.length).toBeGreaterThan(0);
      expect(entity.electionHistory[0].year).toBe(2024);
    });

    it('should calculate targeting scores', () => {
      const entity = engine.buildPrecinctEntity('P001');

      expect(entity.targetingScores).toBeDefined();
      expect(entity.targetingScores.gotvPriority).toBeDefined();
      expect(entity.targetingScores.persuasionOpportunity).toBeDefined();
      expect(entity.targetingScores.combinedScore).toBeDefined();
    });
  });

  describe('compare', () => {
    it('should compare two entities and return differences', () => {
      const left = engine.buildPrecinctEntity('P001');
      const right = engine.buildPrecinctEntity('P002');

      const result = engine.compare(left, right);

      expect(result.leftEntity).toBe(left);
      expect(result.rightEntity).toBe(right);
      expect(result.differences).toBeDefined();
      expect(result.differences.demographics).toBeDefined();
      expect(result.differences.politicalProfile).toBeDefined();
      expect(result.differences.electoral).toBeDefined();
      expect(result.differences.targeting).toBeDefined();
    });

    it('should calculate correct demographic differences', () => {
      const left = engine.buildPrecinctEntity('P001');
      const right = engine.buildPrecinctEntity('P002');

      const result = engine.compare(left, right);
      const demoDiff = result.differences.demographics;

      // P001 has 4500, P002 has 6000 - difference is -1500 (left - right)
      const popDiff = demoDiff.find(d => d.metricName === 'Population');
      expect(popDiff).toBeDefined();
      expect(popDiff?.difference).toBe(-1500);
    });

    it('should calculate partisan lean difference', () => {
      const left = engine.buildPrecinctEntity('P001'); // -8 (D+8)
      const right = engine.buildPrecinctEntity('P002'); // +5 (R+5)

      const result = engine.compare(left, right);
      const politicalDiff = result.differences.politicalProfile;

      const leanDiff = politicalDiff.find(d => d.metricName === 'Partisan Lean');
      expect(leanDiff).toBeDefined();
      // Difference should be -13 (from D+8 to R+5, left - right = -8 - 5 = -13)
      expect(Math.abs(leanDiff?.difference || 0)).toBe(13);
    });
  });

  describe('buildJurisdictionEntity', () => {
    it('should aggregate multiple precincts', () => {
      const entity = engine.buildJurisdictionEntity('Test City');

      expect(entity.name).toBe('Test City');
      expect(entity.type).toBe('jurisdiction');
      // Population should be sum of all precincts (4500 + 6000 + 8000 = 18500)
      expect(entity.demographics.totalPopulation).toBe(18500);
    });

    it('should calculate weighted average for partisan lean', () => {
      const entity = engine.buildJurisdictionEntity('test-city');

      // Weighted average of partisan lean based on population
      // (-8 * 4500 + 5 * 6000 + -15 * 8000) / 18500 = (-36000 + 30000 - 120000) / 18500 ≈ -6.8
      expect(entity.politicalProfile.partisanLean).toBeDefined();
      expect(entity.politicalProfile.partisanLean).toBeLessThan(0); // Should lean Democrat
    });

    it('should throw error for non-existent jurisdiction', () => {
      expect(() => engine.buildJurisdictionEntity('Nonexistent City')).toThrow(/not found/);
    });
  });
});

// ============================================================================
// SimilarityEngine Tests
// ============================================================================

describe('SimilarityEngine', () => {
  let engine: SimilarityEngine;

  // Create test entities
  const createMockEntity = (
    id: string,
    partisanLean: number,
    options: Partial<{
      medianAge: number;
      medianIncome: number;
      turnout: number;
      swingPotential: number;
      gotvPriority: number;
      persuasionOpportunity: number;
      competitiveness: CompetitivenessLevel;
      strategy: string;
    }> = {}
  ): ComparisonEntity => ({
    id,
    name: `Entity ${id}`,
    type: 'precinct',
    parentJurisdiction: 'Test',
    demographics: {
      totalPopulation: 5000,
      registeredVoters: 3750,
      medianAge: options.medianAge || 35,
      medianIncome: options.medianIncome || 55000,
      collegePct: 45,
      homeownerPct: 65,
      diversityIndex: 0.4,
      populationDensity: 3000,
    },
    politicalProfile: {
      demAffiliationPct: 35,
      repAffiliationPct: 30,
      independentPct: 35,
      partisanLean,
      swingPotential: options.swingPotential || 50,
      competitiveness: options.competitiveness || 'tossup',
      dominantParty: partisanLean < 0 ? 'D' : 'R',
      avgTurnoutRate: options.turnout || 65,
    },
    electoral: {
      lastElectionYear: 2024,
      demVoteShare: 50 + partisanLean / 2,
      repVoteShare: 50 - partisanLean / 2,
      marginOfVictory: Math.abs(partisanLean),
      totalVotesCast: 2437,
    },
    targetingScores: {
      gotvPriority: options.gotvPriority || 60,
      persuasionOpportunity: options.persuasionOpportunity || 50,
      combinedScore: 55,
      recommendedStrategy: (options.strategy || 'Battleground') as any,
      canvassingEfficiency: 45,
    },
    electionHistory: [],
  });

  beforeEach(() => {
    engine = new SimilarityEngine();
  });

  describe('calculateSimilarity', () => {
    it('should return high score for identical entities', () => {
      const entity1 = createMockEntity('E1', -5);
      const entity2 = createMockEntity('E2', -5);

      const result = engine.calculateSimilarity(entity1, entity2);

      expect(result.score).toBeGreaterThan(90);
    });

    it('should return lower score for different partisan leans', () => {
      // Create entities with significantly different values across multiple dimensions
      const entity1 = createMockEntity('E1', -20, {
        medianAge: 25,
        medianIncome: 35000,
        turnout: 45,
        swingPotential: 20,
        gotvPriority: 30,
        persuasionOpportunity: 25,
        competitiveness: 'safe_d',
        strategy: 'Base Mobilization',
      });
      const entity2 = createMockEntity('E2', 20, {
        medianAge: 55,
        medianIncome: 85000,
        turnout: 80,
        swingPotential: 70,
        gotvPriority: 80,
        persuasionOpportunity: 75,
        competitiveness: 'safe_r',
        strategy: 'Low Priority',
      });

      const result = engine.calculateSimilarity(entity1, entity2);

      // With very different values across all dimensions, score should be low
      expect(result.score).toBeLessThan(70);
    });

    it('should include breakdown of component scores', () => {
      const entity1 = createMockEntity('E1', -5);
      const entity2 = createMockEntity('E2', -8);

      const result = engine.calculateSimilarity(entity1, entity2);

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.partisanLean).toBeDefined();
      expect(result.breakdown.swingPotential).toBeDefined();
      expect(result.breakdown.turnout).toBeDefined();
      expect(result.breakdown.income).toBeDefined();
      expect(result.breakdown.age).toBeDefined();
      expect(result.breakdown.education).toBeDefined();
      expect(result.breakdown.gotvPriority).toBeDefined();
      expect(result.breakdown.persuasionOpportunity).toBeDefined();
    });

    it('should add bonus for same strategy', () => {
      const entity1 = createMockEntity('E1', -5, { strategy: 'Base Mobilization' });
      const entity2 = createMockEntity('E2', -5, { strategy: 'Base Mobilization' });

      const result = engine.calculateSimilarity(entity1, entity2);

      expect(result.bonuses.sameStrategy).toBe(true);
      expect(result.factors).toEqual(
        expect.arrayContaining([expect.stringContaining('Same strategy')])
      );
    });

    it('should add bonus for same competitiveness', () => {
      const entity1 = createMockEntity('E1', -3, { competitiveness: 'tossup' });
      const entity2 = createMockEntity('E2', 2, { competitiveness: 'tossup' });

      const result = engine.calculateSimilarity(entity1, entity2);

      expect(result.bonuses.sameCompetitiveness).toBe(true);
      expect(result.factors).toEqual(
        expect.arrayContaining([expect.stringContaining('Same competitiveness')])
      );
    });

    it('should identify matching factors', () => {
      const entity1 = createMockEntity('E1', -5, { medianAge: 35, medianIncome: 55000 });
      const entity2 = createMockEntity('E2', -5, { medianAge: 35, medianIncome: 55000 });

      const result = engine.calculateSimilarity(entity1, entity2);

      // Should have multiple matching factors
      expect(result.factors.length).toBeGreaterThan(0);
    });
  });

  describe('findSimilar', () => {
    const referenceEntity = createMockEntity('REF', -8, {
      medianAge: 35,
      medianIncome: 55000,
      swingPotential: 65,
      gotvPriority: 70,
    });

    const targetEntities = [
      createMockEntity('T1', -10, { medianAge: 36, medianIncome: 58000, swingPotential: 60 }),
      createMockEntity('T2', -5, { medianAge: 34, medianIncome: 52000, swingPotential: 70 }),
      createMockEntity('T3', 15, { medianAge: 45, medianIncome: 75000, swingPotential: 30 }),
      createMockEntity('T4', -7, { medianAge: 35, medianIncome: 56000, swingPotential: 68 }),
      createMockEntity('REF', -8), // Same as reference - should be excluded
    ];

    it('should find similar entities sorted by score', () => {
      const results = engine.findSimilar(referenceEntity, targetEntities);

      expect(results.length).toBeGreaterThan(0);
      // Results should be sorted by score descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity.score).toBeGreaterThanOrEqual(results[i].similarity.score);
      }
    });

    it('should exclude reference entity from results', () => {
      const results = engine.findSimilar(referenceEntity, targetEntities);

      const hasReference = results.some(r => r.entity.id === 'REF');
      expect(hasReference).toBe(false);
    });

    it('should respect minSimilarity threshold', () => {
      const results = engine.findSimilar(referenceEntity, targetEntities, {
        minSimilarity: 70,
      });

      for (const result of results) {
        expect(result.similarity.score).toBeGreaterThanOrEqual(70);
      }
    });

    it('should respect maxResults limit', () => {
      const results = engine.findSimilar(referenceEntity, targetEntities, {
        maxResults: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by sameCompetitiveness option', () => {
      const entitiesWithCompetitiveness = [
        createMockEntity('T1', -8, { competitiveness: 'tossup' }),
        createMockEntity('T2', -5, { competitiveness: 'lean_d' }),
        createMockEntity('T3', -7, { competitiveness: 'tossup' }),
      ];

      const refWithTossup = createMockEntity('REF', -6, { competitiveness: 'tossup' });

      const results = engine.findSimilar(refWithTossup, entitiesWithCompetitiveness, {
        sameCompetitiveness: true,
      });

      for (const result of results) {
        expect(result.entity.politicalProfile.competitiveness).toBe('tossup');
      }
    });

    it('should filter by sameStrategy option', () => {
      const entitiesWithStrategy = [
        createMockEntity('T1', -8, { strategy: 'Battleground' }),
        createMockEntity('T2', -5, { strategy: 'Base Mobilization' }),
        createMockEntity('T3', -7, { strategy: 'Battleground' }),
      ];

      const refWithBattleground = createMockEntity('REF', -6, { strategy: 'Battleground' });

      const results = engine.findSimilar(refWithBattleground, entitiesWithStrategy, {
        sameStrategy: true,
      });

      for (const result of results) {
        expect(result.entity.targetingScores.recommendedStrategy).toBe('Battleground');
      }
    });
  });

  describe('custom weights', () => {
    it('should allow custom weight configuration', () => {
      const customEngine = new SimilarityEngine({
        partisanLean: 0.50, // Emphasize partisan lean
        swingPotential: 0.10,
        turnout: 0.05,
        income: 0.05,
        age: 0.05,
        education: 0.05,
        gotvPriority: 0.10,
        persuasionOpportunity: 0.10,
      });

      // Create entities with different partisan leans but otherwise identical
      const entity1 = createMockEntity('E1', -15, {
        medianAge: 40,
        medianIncome: 60000,
        turnout: 70,
        swingPotential: 60,
        gotvPriority: 65,
        persuasionOpportunity: 55,
      });
      const entity2 = createMockEntity('E2', 5, {
        medianAge: 40,
        medianIncome: 60000,
        turnout: 70,
        swingPotential: 60,
        gotvPriority: 65,
        persuasionOpportunity: 55,
      });

      const customResult = customEngine.calculateSimilarity(entity1, entity2);
      const defaultResult = engine.calculateSimilarity(entity1, entity2);

      // Custom weights emphasize partisan lean (50% vs 20%), so different leans should
      // produce a larger difference in score with custom weights
      // Lean diff = 20, lean score = 100 - 20*2 = 60
      // Custom: 60 * 0.50 + 100 * 0.50 = 30 + 50 = 80 (weighted)
      // Default: 60 * 0.20 + 100 * 0.80 = 12 + 80 = 92 (weighted)
      expect(customResult.score).toBeLessThan(defaultResult.score);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('ComparisonEngine + SimilarityEngine Integration', () => {
  const mockPrecincts = [
    createMockPrecinct('P001', 'Precinct 1', -8, { population: 4500, swingPotential: 65 }),
    createMockPrecinct('P002', 'Precinct 2', -7, { population: 4800, swingPotential: 68 }),
    createMockPrecinct('P003', 'Precinct 3', -12, { population: 5200, swingPotential: 55 }),
    createMockPrecinct('P004', 'Precinct 4', 5, { population: 3800, swingPotential: 72 }),
    createMockPrecinct('P005', 'Precinct 5', 8, { population: 6000, swingPotential: 45 }),
  ];

  const mockDataFile = createMockDataFile(mockPrecincts);

  it('should find similar precincts from comparison engine entities', () => {
    const comparisonEngine = new ComparisonEngine(mockDataFile);
    const similarityEngine = new SimilarityEngine();

    // Build entities from data
    const referenceEntity = comparisonEngine.buildPrecinctEntity('P001');
    const targetEntities = ['P002', 'P003', 'P004', 'P005'].map(id =>
      comparisonEngine.buildPrecinctEntity(id)
    );

    // Find similar
    const similar = similarityEngine.findSimilar(referenceEntity, targetEntities, {
      minSimilarity: 50,
      maxResults: 3,
    });

    expect(similar.length).toBeGreaterThan(0);
    // P002 should be most similar (close partisan lean, close swing potential)
    expect(similar[0].entity.id).toBe('P002');
  });

  it('should compare and find similar in workflow', () => {
    const comparisonEngine = new ComparisonEngine(mockDataFile);
    const similarityEngine = new SimilarityEngine();

    // Compare two entities
    const left = comparisonEngine.buildPrecinctEntity('P001');
    const right = comparisonEngine.buildPrecinctEntity('P004');
    const comparison = comparisonEngine.compare(left, right);

    expect(comparison.differences.politicalProfile.length).toBeGreaterThan(0);

    // Find entities similar to left
    const allEntities = Object.keys(mockDataFile.precincts).map(id =>
      comparisonEngine.buildPrecinctEntity(id)
    );

    const similar = similarityEngine.findSimilar(left, allEntities);
    expect(similar.length).toBeGreaterThan(0);
  });
});
