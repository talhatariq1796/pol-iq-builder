/**
 * Tests for CanvassingEngine
 *
 * Verifies turf optimization, metrics calculation, and route suggestions.
 */

import { CanvassingEngine } from '@/lib/canvassing/CanvassingEngine';
import type { SegmentResults, CanvassingUniverse } from '@/lib/canvassing/types';

// Mock precinct data for testing
const mockPrecincts = [
  {
    id: 'P001',
    name: 'Precinct 1',
    jurisdiction: 'Lansing',
    jurisdictionType: 'city' as const,
    demographics: {
      totalPopulation: 3500,
      population18up: 2800,
      medianAge: 35,
      medianHHI: 55000,
      collegePct: 45,
      homeownerPct: 60,
      diversityIndex: 0.65,
      populationDensity: 3500, // Urban
    },
    political: {
      demAffiliationPct: 55,
      repAffiliationPct: 30,
      independentPct: 15,
      liberalPct: 50,
      moderatePct: 30,
      conservativePct: 20,
    },
    electoral: {
      partisanLean: -15,
      swingPotential: 45,
      competitiveness: 'lean_d' as const,
      avgTurnout: 65,
      turnoutDropoff: 8,
    },
    targeting: {
      gotvPriority: 75,
      persuasionOpportunity: 60,
      combinedScore: 67.5,
      strategy: 'GOTV + Persuasion',
    },
  },
  {
    id: 'P002',
    name: 'Precinct 2',
    jurisdiction: 'Lansing',
    jurisdictionType: 'city' as const,
    demographics: {
      totalPopulation: 4200,
      population18up: 3200,
      medianAge: 42,
      medianHHI: 68000,
      collegePct: 55,
      homeownerPct: 70,
      diversityIndex: 0.55,
      populationDensity: 800, // Suburban
    },
    political: {
      demAffiliationPct: 45,
      repAffiliationPct: 40,
      independentPct: 15,
      liberalPct: 40,
      moderatePct: 35,
      conservativePct: 25,
    },
    electoral: {
      partisanLean: -5,
      swingPotential: 70,
      competitiveness: 'toss_up' as const,
      avgTurnout: 72,
      turnoutDropoff: 5,
    },
    targeting: {
      gotvPriority: 65,
      persuasionOpportunity: 85,
      combinedScore: 75,
      strategy: 'Persuasion Priority',
    },
  },
  {
    id: 'P003',
    name: 'Precinct 3',
    jurisdiction: 'Meridian Township',
    jurisdictionType: 'township' as const,
    demographics: {
      totalPopulation: 2800,
      population18up: 2200,
      medianAge: 38,
      medianHHI: 62000,
      collegePct: 50,
      homeownerPct: 65,
      diversityIndex: 0.60,
      populationDensity: 300, // Rural
    },
    political: {
      demAffiliationPct: 48,
      repAffiliationPct: 38,
      independentPct: 14,
      liberalPct: 45,
      moderatePct: 32,
      conservativePct: 23,
    },
    electoral: {
      partisanLean: -8,
      swingPotential: 62,
      competitiveness: 'lean_d' as const,
      avgTurnout: 68,
      turnoutDropoff: 6,
    },
    targeting: {
      gotvPriority: 70,
      persuasionOpportunity: 72,
      combinedScore: 71,
      strategy: 'Balanced',
    },
  },
];

describe('CanvassingEngine - New Methods', () => {
  let engine: CanvassingEngine;

  beforeEach(() => {
    engine = new CanvassingEngine(mockPrecincts);
  });

  describe('createUniverseFromSegment', () => {
    it('should create a universe from segment results', () => {
      const segmentResults: SegmentResults = {
        matchingPrecincts: mockPrecincts.map(p => ({
          precinctId: p.id,
          precinctName: p.name,
          jurisdiction: p.jurisdiction,
          registeredVoters: p.demographics.population18up,
          gotvPriority: p.targeting.gotvPriority,
          persuasionOpportunity: p.targeting.persuasionOpportunity,
          swingPotential: p.electoral.swingPotential,
          targetingStrategy: p.targeting.strategy,
          partisanLean: p.electoral.partisanLean,
        })),
        estimatedVoters: 8200,
        totalPrecincts: 3,
      };

      const universe = engine.createUniverseFromSegment(
        segmentResults,
        'Test Universe',
        'Test description'
      );

      expect(universe.name).toBe('Test Universe');
      expect(universe.description).toBe('Test description');
      expect(universe.totalPrecincts).toBe(3);
      expect(universe.precincts).toHaveLength(3);
      expect(universe.segmentId).toBeDefined();
    });

    it('should throw error if segment has no precincts', () => {
      const emptySegment: SegmentResults = {
        matchingPrecincts: [],
        estimatedVoters: 0,
        totalPrecincts: 0,
      };

      expect(() => {
        engine.createUniverseFromSegment(emptySegment, 'Empty Universe');
      }).toThrow('No precincts in segment results');
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate metrics for urban precincts', () => {
      const metrics = engine.calculateMetrics(['P001']);

      expect(metrics.density).toBe('urban');
      expect(metrics.doorsPerHour).toBe(35); // Urban rate
      expect(metrics.totalDoors).toBeGreaterThan(0);
      expect(metrics.estimatedTime).toBeGreaterThan(0);
    });

    it('should calculate metrics for suburban precincts', () => {
      const metrics = engine.calculateMetrics(['P002']);

      expect(metrics.density).toBe('suburban');
      expect(metrics.doorsPerHour).toBe(45); // Suburban rate
      expect(metrics.totalDoors).toBeGreaterThan(0);
      expect(metrics.estimatedTime).toBeGreaterThan(0);
    });

    it('should calculate metrics for rural precincts', () => {
      const metrics = engine.calculateMetrics(['P003']);

      expect(metrics.density).toBe('rural');
      expect(metrics.doorsPerHour).toBe(25); // Rural rate
      expect(metrics.totalDoors).toBeGreaterThan(0);
      expect(metrics.estimatedTime).toBeGreaterThan(0);
    });

    it('should calculate metrics for multiple precincts', () => {
      const metrics = engine.calculateMetrics(['P001', 'P002', 'P003']);

      expect(metrics.totalDoors).toBeGreaterThan(0);
      expect(metrics.estimatedTime).toBeGreaterThan(0);
      expect(['urban', 'suburban', 'rural']).toContain(metrics.density);
    });

    it('should return empty metrics for no precincts', () => {
      const metrics = engine.calculateMetrics([]);

      expect(metrics.totalDoors).toBe(0);
      expect(metrics.estimatedTime).toBe(0);
      expect(metrics.doorsPerHour).toBe(0);
      expect(metrics.density).toBe('suburban');
    });
  });

  describe('optimizeTurfs', () => {
    let universe: CanvassingUniverse;

    beforeEach(() => {
      universe = engine.createUniverse('Test Universe', ['P001', 'P002', 'P003']);
    });

    it('should create turfs with default settings', () => {
      const turfs = engine.optimizeTurfs(universe);

      expect(turfs.length).toBeGreaterThan(0);
      turfs.forEach(turf => {
        expect(turf.turfId).toBeDefined();
        expect(turf.turfName).toBeDefined();
        expect(turf.precinctIds.length).toBeGreaterThan(0);
        expect(turf.estimatedDoors).toBeGreaterThan(0);
        expect(turf.estimatedHours).toBeGreaterThan(0);
        expect(['urban', 'suburban', 'rural']).toContain(turf.density);
      });
    });

    it('should respect targetDoorsPerTurf option', () => {
      const turfs = engine.optimizeTurfs(universe, { targetDoorsPerTurf: 1000 });

      // With larger target, should create fewer turfs
      const defaultTurfs = engine.optimizeTurfs(universe, { targetDoorsPerTurf: 50 });
      expect(turfs.length).toBeLessThanOrEqual(defaultTurfs.length);

      // Each turf should aim for the target (within tolerance)
      turfs.forEach(turf => {
        expect(turf.estimatedDoors).toBeGreaterThan(0);
      });
    });

    it('should respect maxTurfs option', () => {
      const turfs = engine.optimizeTurfs(universe, { maxTurfs: 2 });

      expect(turfs.length).toBeLessThanOrEqual(2);
    });

    it('should sort by GOTV priority when specified', () => {
      const turfs = engine.optimizeTurfs(universe, { priorityMetric: 'gotv_priority' });

      expect(turfs.length).toBeGreaterThan(0);
      // First turf should have highest GOTV priority precincts
      expect(turfs[0].avgGotvPriority).toBeGreaterThan(0);
    });

    it('should sort by persuasion opportunity when specified', () => {
      const turfs = engine.optimizeTurfs(universe, { priorityMetric: 'persuasion_opportunity' });

      expect(turfs.length).toBeGreaterThan(0);
      // First turf should have highest persuasion precincts
      expect(turfs[0].avgPersuasionOpportunity).toBeGreaterThan(0);
    });
  });

  describe('getRouteSuggestions', () => {
    it('should provide route suggestions for precinct IDs', () => {
      const suggestions = engine.getRouteSuggestions('P001,P002,P003');

      expect(suggestions.optimalOrder).toHaveLength(3);
      expect(suggestions.estimatedDistance).toBeGreaterThan(0);
      expect(suggestions.tips.length).toBeGreaterThan(0);
    });

    it('should group precincts by jurisdiction', () => {
      const suggestions = engine.getRouteSuggestions('P001,P002,P003');

      // P001 and P002 are in Lansing, P003 is in Meridian
      // They should be grouped appropriately
      expect(suggestions.optimalOrder).toHaveLength(3);
    });

    it('should provide density-specific tips', () => {
      const urbanSuggestions = engine.getRouteSuggestions('P001');
      expect(urbanSuggestions.tips.some(tip => tip.includes('Urban'))).toBe(true);

      const suburbanSuggestions = engine.getRouteSuggestions('P002');
      expect(suburbanSuggestions.tips.some(tip => tip.includes('Suburban'))).toBe(true);

      const ruralSuggestions = engine.getRouteSuggestions('P003');
      expect(ruralSuggestions.tips.some(tip => tip.includes('Rural'))).toBe(true);
    });

    it('should handle empty precinct list', () => {
      const suggestions = engine.getRouteSuggestions('');

      expect(suggestions.optimalOrder).toHaveLength(0);
      expect(suggestions.estimatedDistance).toBe(0);
    });

    it('should handle non-existent precincts', () => {
      const suggestions = engine.getRouteSuggestions('INVALID');

      expect(suggestions.optimalOrder).toHaveLength(0);
      expect(suggestions.tips).toContain('No precincts found');
    });
  });
});
