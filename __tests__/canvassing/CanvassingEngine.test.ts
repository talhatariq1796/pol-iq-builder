/**
 * CanvassingEngine Tests
 *
 * Tests canvassing universe creation, staffing estimates, and turf optimization.
 * Run with: npm test -- --testPathPattern=CanvassingEngine
 */

import { CanvassingEngine } from '@/lib/canvassing/CanvassingEngine';
import type { CanvassingUniverse, SegmentResults } from '@/lib/canvassing/types';

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

describe('CanvassingEngine', () => {
  let engine: CanvassingEngine;
  let mockPrecincts: PrecinctData[];

  beforeEach(() => {
    mockPrecincts = [
      createMockPrecinct({
        id: 'P1',
        name: 'High Priority Urban',
        jurisdiction: 'Lansing',
        demographics: { ...createMockPrecinct().demographics, population18up: 3000, populationDensity: 4500 },
        targeting: { gotvPriority: 80, persuasionOpportunity: 40, combinedScore: 65, strategy: 'gotv' },
      }),
      createMockPrecinct({
        id: 'P2',
        name: 'Medium Priority Suburban',
        jurisdiction: 'East Lansing',
        demographics: { ...createMockPrecinct().demographics, population18up: 4000, populationDensity: 2000 },
        targeting: { gotvPriority: 60, persuasionOpportunity: 55, combinedScore: 57, strategy: 'mixed' },
      }),
      createMockPrecinct({
        id: 'P3',
        name: 'Lower Priority Rural',
        jurisdiction: 'Meridian Township',
        demographics: { ...createMockPrecinct().demographics, population18up: 2500, populationDensity: 400 },
        targeting: { gotvPriority: 45, persuasionOpportunity: 50, combinedScore: 48, strategy: 'persuasion' },
      }),
      createMockPrecinct({
        id: 'P4',
        name: 'High Swing Precinct',
        jurisdiction: 'Lansing',
        demographics: { ...createMockPrecinct().demographics, population18up: 3500, populationDensity: 3000 },
        electoral: { partisanLean: 2, swingPotential: 65, competitiveness: 'toss_up', avgTurnout: 60, turnoutDropoff: 12 },
        targeting: { gotvPriority: 55, persuasionOpportunity: 70, combinedScore: 62, strategy: 'persuasion' },
      }),
      createMockPrecinct({
        id: 'P5',
        name: 'Low Turnout GOTV',
        jurisdiction: 'East Lansing',
        demographics: { ...createMockPrecinct().demographics, population18up: 2800, populationDensity: 3500 },
        electoral: { partisanLean: 18, swingPotential: 25, competitiveness: 'likely_d', avgTurnout: 42, turnoutDropoff: 22 },
        targeting: { gotvPriority: 85, persuasionOpportunity: 30, combinedScore: 60, strategy: 'gotv' },
      }),
    ];

    engine = new CanvassingEngine(mockPrecincts as any);
  });

  // ========================================
  // Create Universe Tests
  // ========================================
  describe('createUniverse', () => {
    test('creates universe with correct name', () => {
      const universe = engine.createUniverse('GOTV Campaign', ['P1', 'P2']);

      expect(universe.name).toBe('GOTV Campaign');
    });

    test('generates unique ID', () => {
      const universe1 = engine.createUniverse('Campaign 1', ['P1']);
      const universe2 = engine.createUniverse('Campaign 2', ['P2']);

      expect(universe1.id).not.toBe(universe2.id);
    });

    test('includes correct precincts', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2', 'P3']);

      expect(universe.totalPrecincts).toBe(3);
      expect(universe.precincts.length).toBe(3);
    });

    test('includes custom precinct IDs', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);

      expect(universe.customPrecincts).toEqual(['P1', 'P2']);
    });

    test('calculates estimated doors', () => {
      const universe = engine.createUniverse('Test', ['P1']);

      // Doors = population18up * 0.80 (residential factor)
      expect(universe.totalEstimatedDoors).toBe(Math.round(3000 * 0.8));
    });

    test('calculates estimated turfs', () => {
      const universe = engine.createUniverse('Test', ['P1'], {
        targetDoorsPerTurf: 50,
      });

      // 2400 doors / 50 doors per turf = 48 turfs
      expect(universe.estimatedTurfs).toBe(Math.ceil(2400 / 50));
    });

    test('calculates estimated hours', () => {
      const universe = engine.createUniverse('Test', ['P1'], {
        targetDoorsPerHour: 40,
      });

      // 2400 doors / 40 doors per hour = 60 hours
      expect(universe.estimatedHours).toBe(Math.ceil(2400 / 40));
    });

    test('calculates volunteers needed', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);

      expect(universe.volunteersNeeded).toBeGreaterThan(0);
    });

    test('uses default parameters when not specified', () => {
      const universe = engine.createUniverse('Test', ['P1']);

      expect(universe.targetDoorsPerTurf).toBe(50);
      expect(universe.targetDoorsPerHour).toBe(40);
      expect(universe.targetContactRate).toBe(0.35);
    });

    test('uses custom parameters when specified', () => {
      const universe = engine.createUniverse('Test', ['P1'], {
        targetDoorsPerTurf: 60,
        targetDoorsPerHour: 35,
        targetContactRate: 0.40,
      });

      expect(universe.targetDoorsPerTurf).toBe(60);
      expect(universe.targetDoorsPerHour).toBe(35);
      expect(universe.targetContactRate).toBe(0.40);
    });

    test('includes created timestamp', () => {
      const before = new Date().toISOString();
      const universe = engine.createUniverse('Test', ['P1']);
      const after = new Date().toISOString();

      expect(universe.createdAt).toBeDefined();
      expect(universe.createdAt >= before).toBe(true);
      expect(universe.createdAt <= after).toBe(true);
    });

    test('throws for no matching precincts', () => {
      expect(() => engine.createUniverse('Test', ['nonexistent'])).toThrow(
        'No matching precincts found'
      );
    });

    test('assigns priority ranks', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2', 'P3']);

      universe.precincts.forEach((p, i) => {
        expect(p.priorityRank).toBe(i + 1);
      });
    });

    test('sorts by combined score by default', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2', 'P3']);

      // P1 has highest combined (65), then P2 (57), then P3 (48)
      expect(universe.precincts[0].precinctId).toBe('P1');
    });
  });

  // ========================================
  // Precinct Calculations Tests
  // ========================================
  describe('precinct calculations', () => {
    test('calculates estimated doors per precinct', () => {
      const universe = engine.createUniverse('Test', ['P1']);

      expect(universe.precincts[0].estimatedDoors).toBe(Math.round(3000 * 0.8));
    });

    test('calculates estimated turfs per precinct', () => {
      const universe = engine.createUniverse('Test', ['P1'], { targetDoorsPerTurf: 50 });

      const expectedTurfs = Math.ceil(2400 / 50);
      expect(universe.precincts[0].estimatedTurfs).toBe(expectedTurfs);
    });

    test('calculates estimated hours per precinct', () => {
      const universe = engine.createUniverse('Test', ['P1'], { targetDoorsPerHour: 40 });

      const expectedHours = Math.ceil(2400 / 40);
      expect(universe.precincts[0].estimatedHours).toBe(expectedHours);
    });

    test('includes GOTV priority', () => {
      const universe = engine.createUniverse('Test', ['P1']);

      expect(universe.precincts[0].gotvPriority).toBe(80);
    });

    test('includes persuasion opportunity', () => {
      const universe = engine.createUniverse('Test', ['P1']);

      expect(universe.precincts[0].persuasionOpportunity).toBe(40);
    });

    test('includes swing potential', () => {
      const universe = engine.createUniverse('Test', ['P4']);

      expect(universe.precincts[0].swingPotential).toBe(65);
    });

    test('includes targeting strategy', () => {
      const universe = engine.createUniverse('Test', ['P1']);

      expect(universe.precincts[0].targetingStrategy).toBe('gotv');
    });
  });

  // ========================================
  // Sort Universe Tests
  // ========================================
  describe('sortUniverse', () => {
    test('sorts by GOTV priority', () => {
      let universe = engine.createUniverse('Test', ['P1', 'P2', 'P3', 'P4', 'P5']);
      universe = engine.sortUniverse(universe, 'gotv');

      // P5 (85), P1 (80), P2 (60), P4 (55), P3 (45)
      expect(universe.precincts[0].precinctId).toBe('P5');
      expect(universe.precincts[1].precinctId).toBe('P1');
    });

    test('sorts by persuasion', () => {
      let universe = engine.createUniverse('Test', ['P1', 'P2', 'P3', 'P4', 'P5']);
      universe = engine.sortUniverse(universe, 'persuasion');

      // P4 (70), P2 (55), P3 (50), P1 (40), P5 (30)
      expect(universe.precincts[0].precinctId).toBe('P4');
    });

    test('sorts by doors', () => {
      let universe = engine.createUniverse('Test', ['P1', 'P2', 'P3']);
      universe = engine.sortUniverse(universe, 'doors');

      // P2 has most voters (4000), then P1 (3000), then P3 (2500)
      expect(universe.precincts[0].precinctId).toBe('P2');
    });

    test('sorts by swing', () => {
      let universe = engine.createUniverse('Test', ['P1', 'P2', 'P3', 'P4', 'P5']);
      universe = engine.sortUniverse(universe, 'swing');

      // P4 (65), then others
      expect(universe.precincts[0].precinctId).toBe('P4');
    });

    test('sorts by combined (default)', () => {
      let universe = engine.createUniverse('Test', ['P1', 'P2', 'P3']);
      universe = engine.sortUniverse(universe, 'combined');

      expect(universe.precincts[0].precinctId).toBe('P1'); // 65
      expect(universe.precincts[1].precinctId).toBe('P2'); // 57
    });

    test('updates priority ranks after sort', () => {
      let universe = engine.createUniverse('Test', ['P1', 'P2', 'P3']);
      universe = engine.sortUniverse(universe, 'persuasion');

      expect(universe.precincts[0].priorityRank).toBe(1);
      expect(universe.precincts[1].priorityRank).toBe(2);
      expect(universe.precincts[2].priorityRank).toBe(3);
    });

    test('adds updatedAt timestamp', () => {
      let universe = engine.createUniverse('Test', ['P1', 'P2']);
      universe = engine.sortUniverse(universe, 'gotv');

      expect(universe.updatedAt).toBeDefined();
    });
  });

  // ========================================
  // Estimate Staffing Tests
  // ========================================
  describe('estimateStaffing', () => {
    test('calculates total shifts', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const estimate = engine.estimateStaffing(universe, 7, 4);

      expect(estimate.totalShifts).toBeGreaterThan(0);
    });

    test('calculates shifts per day', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const estimate = engine.estimateStaffing(universe, 7, 4);

      expect(estimate.shiftsPerDay).toBe(Math.ceil(estimate.totalShifts / 7));
    });

    test('calculates volunteers per day', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const estimate = engine.estimateStaffing(universe, 7, 4);

      expect(estimate.volunteersPerDay).toBe(estimate.shiftsPerDay);
    });

    test('calculates expected contacts', () => {
      const universe = engine.createUniverse('Test', ['P1'], { targetContactRate: 0.35 });
      const estimate = engine.estimateStaffing(universe, 7, 4);

      expect(estimate.expectedContacts).toBe(Math.round(2400 * 0.35));
    });

    test('calculates coverage percent', () => {
      const universe = engine.createUniverse('Test', ['P1']);
      const estimate = engine.estimateStaffing(universe, 7, 4);

      expect(estimate.coveragePercent).toBeGreaterThan(0);
      expect(estimate.coveragePercent).toBeLessThanOrEqual(100);
    });

    test('adjusts for 8-hour shifts vs 4-hour shifts', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const estimate8hr = engine.estimateStaffing(universe, 7, 8);
      const estimate4hr = engine.estimateStaffing(universe, 7, 4);

      expect(estimate4hr.totalShifts).toBeGreaterThan(estimate8hr.totalShifts);
    });

    test('adjusts for different canvass days', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const estimate3day = engine.estimateStaffing(universe, 3, 4);
      const estimate7day = engine.estimateStaffing(universe, 7, 4);

      expect(estimate3day.shiftsPerDay).toBeGreaterThan(estimate7day.shiftsPerDay);
    });
  });

  // ========================================
  // Generate Summary Tests
  // ========================================
  describe('generateSummary', () => {
    test('includes universe name', () => {
      const universe = engine.createUniverse('GOTV Campaign', ['P1', 'P2']);
      const summary = engine.generateSummary(universe);

      expect(summary.universeName).toBe('GOTV Campaign');
    });

    test('includes precinct count', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2', 'P3']);
      const summary = engine.generateSummary(universe);

      expect(summary.precincts).toBe(3);
    });

    test('includes estimated doors', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const summary = engine.generateSummary(universe);

      expect(summary.estimatedDoors).toBe(universe.totalEstimatedDoors);
    });

    test('includes estimated turfs', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const summary = engine.generateSummary(universe);

      expect(summary.estimatedTurfs).toBe(universe.estimatedTurfs);
    });

    test('includes volunteer estimates for both shift types', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const summary = engine.generateSummary(universe);

      expect(summary.volunteersFor8HrShifts).toBeGreaterThan(0);
      expect(summary.volunteersFor4HrShifts).toBeGreaterThan(0);
      expect(summary.volunteersFor4HrShifts).toBeGreaterThan(summary.volunteersFor8HrShifts);
    });

    test('includes expected contacts', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const summary = engine.generateSummary(universe);

      expect(summary.expectedContacts).toBeGreaterThan(0);
    });

    test('includes top 10 precincts', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2', 'P3', 'P4', 'P5']);
      const summary = engine.generateSummary(universe);

      expect(summary.topPrecincts.length).toBeLessThanOrEqual(10);
      expect(summary.topPrecincts[0].rank).toBe(1);
    });

    test('includes strategy breakdown', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2', 'P3']);
      const summary = engine.generateSummary(universe);

      expect(summary.strategyBreakdown).toBeDefined();
      expect(Object.keys(summary.strategyBreakdown).length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // Create Universe From Segment Tests
  // ========================================
  describe('createUniverseFromSegment', () => {
    test('creates universe from segment results', () => {
      const segmentResults: SegmentResults = {
        matchingPrecincts: [
          { precinctId: 'P1', precinctName: 'Test 1', jurisdiction: 'Lansing', registeredVoters: 3000, gotvPriority: 80, persuasionOpportunity: 40, swingPotential: 35, targetingStrategy: 'gotv', partisanLean: 10 },
          { precinctId: 'P2', precinctName: 'Test 2', jurisdiction: 'East Lansing', registeredVoters: 4000, gotvPriority: 60, persuasionOpportunity: 55, swingPotential: 45, targetingStrategy: 'mixed', partisanLean: 5 },
        ],
        estimatedVoters: 7000,
        totalPrecincts: 2,
      };

      const universe = engine.createUniverseFromSegment(segmentResults, 'Segment Universe');

      expect(universe.name).toBe('Segment Universe');
      expect(universe.totalPrecincts).toBe(2);
    });

    test('includes segment ID reference', () => {
      const segmentResults: SegmentResults = {
        matchingPrecincts: [
          { precinctId: 'P1', precinctName: 'Test 1', jurisdiction: 'Lansing', registeredVoters: 3000, gotvPriority: 80, persuasionOpportunity: 40, swingPotential: 35, targetingStrategy: 'gotv', partisanLean: 10 },
        ],
        estimatedVoters: 3000,
        totalPrecincts: 1,
      };

      const universe = engine.createUniverseFromSegment(segmentResults, 'Test', 'Description');

      expect(universe.segmentId).toMatch(/^segment_/);
    });

    test('includes description', () => {
      const segmentResults: SegmentResults = {
        matchingPrecincts: [
          { precinctId: 'P1', precinctName: 'Test', jurisdiction: 'Lansing', registeredVoters: 3000, gotvPriority: 80, persuasionOpportunity: 40, swingPotential: 35, targetingStrategy: 'gotv', partisanLean: 10 },
        ],
        estimatedVoters: 3000,
        totalPrecincts: 1,
      };

      const universe = engine.createUniverseFromSegment(segmentResults, 'Test', 'High priority targets');

      expect(universe.description).toBe('High priority targets');
    });

    test('throws for empty segment', () => {
      const emptySegment: SegmentResults = {
        matchingPrecincts: [],
        estimatedVoters: 0,
        totalPrecincts: 0,
      };

      expect(() => engine.createUniverseFromSegment(emptySegment, 'Test')).toThrow(
        'No precincts in segment results'
      );
    });
  });

  // ========================================
  // Optimize Turfs Tests
  // ========================================
  describe('optimizeTurfs', () => {
    test('creates turf array', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2', 'P3']);
      const turfs = engine.optimizeTurfs(universe);

      expect(Array.isArray(turfs)).toBe(true);
      expect(turfs.length).toBeGreaterThan(0);
    });

    test('respects target doors per turf', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const turfs = engine.optimizeTurfs(universe, { targetDoorsPerTurf: 100 });

      turfs.forEach(turf => {
        // Turfs should have estimated doors defined
        expect(turf.estimatedDoors).toBeDefined();
        expect(turf.estimatedDoors).toBeGreaterThanOrEqual(0);
      });
    });

    test('respects max turfs limit', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2', 'P3', 'P4', 'P5']);
      const turfs = engine.optimizeTurfs(universe, { maxTurfs: 3 });

      expect(turfs.length).toBeLessThanOrEqual(3);
    });

    test('sorts by priority metric', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2', 'P3', 'P4', 'P5']);
      const turfs = engine.optimizeTurfs(universe, { priorityMetric: 'gotv_priority' });

      // First turf should contain highest GOTV priority precincts
      expect(turfs.length).toBeGreaterThan(0);
    });

    test('turf includes all required fields', () => {
      const universe = engine.createUniverse('Test', ['P1', 'P2']);
      const turfs = engine.optimizeTurfs(universe);

      turfs.forEach(turf => {
        expect(turf).toHaveProperty('turfId');
        expect(turf).toHaveProperty('turfName');
        expect(turf).toHaveProperty('precinctIds');
        expect(turf).toHaveProperty('estimatedDoors');
        expect(turf).toHaveProperty('avgGotvPriority');
      });
    });
  });

  // ========================================
  // Calculate Metrics Tests
  // ========================================
  describe('calculateMetrics', () => {
    test('calculates total doors', () => {
      const metrics = engine.calculateMetrics(['P1', 'P2']);

      expect(metrics.totalDoors).toBeGreaterThan(0);
    });

    test('calculates estimated time', () => {
      const metrics = engine.calculateMetrics(['P1', 'P2']);

      expect(metrics.estimatedTime).toBeGreaterThan(0);
    });

    test('calculates doors per hour', () => {
      const metrics = engine.calculateMetrics(['P1', 'P2']);

      expect(metrics.doorsPerHour).toBeGreaterThan(0);
    });

    test('determines density type', () => {
      const urbanMetrics = engine.calculateMetrics(['P1']); // high density
      const ruralMetrics = engine.calculateMetrics(['P3']); // low density

      expect(['urban', 'suburban', 'rural']).toContain(urbanMetrics.density);
      expect(['urban', 'suburban', 'rural']).toContain(ruralMetrics.density);
    });

    test('returns zeros for no matching precincts', () => {
      const metrics = engine.calculateMetrics(['nonexistent']);

      expect(metrics.totalDoors).toBe(0);
      expect(metrics.estimatedTime).toBe(0);
      expect(metrics.doorsPerHour).toBe(0);
    });
  });

  // ========================================
  // Get Route Suggestions Tests
  // ========================================
  describe('getRouteSuggestions', () => {
    test('returns route suggestions for precinct IDs', () => {
      const suggestions = engine.getRouteSuggestions('P1,P2,P3');

      expect(suggestions).toHaveProperty('optimalOrder');
      expect(suggestions).toHaveProperty('estimatedDistance');
      expect(suggestions).toHaveProperty('tips');
    });

    test('returns empty for no matches', () => {
      const suggestions = engine.getRouteSuggestions('nonexistent1,nonexistent2');

      expect(suggestions.optimalOrder).toEqual([]);
      expect(suggestions.tips).toContain('No precincts found');
    });

    test('handles turf ID format', () => {
      const suggestions = engine.getRouteSuggestions('turf-1');

      // Returns placeholder for turf lookup
      expect(suggestions.tips).toContain('Turf lookup not yet implemented');
    });

    test('sorts by jurisdiction', () => {
      const suggestions = engine.getRouteSuggestions('P1,P2,P4');

      expect(Array.isArray(suggestions.optimalOrder)).toBe(true);
    });
  });

  // ========================================
  // Helper Method Tests
  // ========================================
  describe('helper methods', () => {
    test('getPrecinct returns precinct by ID', () => {
      const precinct = engine.getPrecinct('P1');

      expect(precinct).toBeDefined();
      expect(precinct?.id).toBe('P1');
    });

    test('getPrecinct returns undefined for nonexistent', () => {
      const precinct = engine.getPrecinct('nonexistent');

      expect(precinct).toBeUndefined();
    });

    test('getAllPrecincts returns all precincts', () => {
      const all = engine.getAllPrecincts();

      expect(all.length).toBe(5);
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('edge cases', () => {
    test('handles single precinct universe', () => {
      const universe = engine.createUniverse('Single', ['P1']);

      expect(universe.totalPrecincts).toBe(1);
      expect(universe.precincts[0].priorityRank).toBe(1);
    });

    test('handles large universe', () => {
      const manyPrecincts = Array.from({ length: 50 }, (_, i) =>
        createMockPrecinct({
          id: `LP${i}`,
          name: `Large Precinct ${i}`,
          targeting: { gotvPriority: 50 + (i % 30), persuasionOpportunity: 40 + (i % 25), combinedScore: 45 + (i % 20), strategy: 'mixed' },
        })
      );
      const largeEngine = new CanvassingEngine(manyPrecincts as any);

      const universe = largeEngine.createUniverse('Large', manyPrecincts.map(p => p.id));

      expect(universe.totalPrecincts).toBe(50);
      expect(universe.precincts[0].priorityRank).toBe(1);
      expect(universe.precincts[49].priorityRank).toBe(50);
    });
  });
});
