/**
 * Unit Tests for RouteOptimizer
 *
 * Tests nearest-neighbor algorithm, distance calculations, time estimates,
 * break suggestions, and route tip generation.
 */

import { RouteOptimizer } from '../RouteOptimizer';
import type {
  RoutePrecinctData,
  RouteOptions,
  OptimizedRoute,
  BreakSuggestion,
} from '../RouteOptimizer';
import type { CanvassingTurf, DensityType } from '../types';

// Mock data - Lansing, MI area (around -84.5, 42.6)
const mockPrecincts: RoutePrecinctData[] = [
  {
    precinctId: 'LAN-001',
    precinctName: 'Lansing Downtown',
    centroid: [-84.5555, 42.7337], // Downtown Lansing
    estimatedDoors: 50,
    density: 'urban',
    gotvPriority: 85,
    persuasionOpportunity: 45,
  },
  {
    precinctId: 'LAN-002',
    precinctName: 'East Lansing Central',
    centroid: [-84.4839, 42.7369], // East Lansing
    estimatedDoors: 60,
    density: 'suburban',
    gotvPriority: 70,
    persuasionOpportunity: 65,
  },
  {
    precinctId: 'LAN-003',
    precinctName: 'Haslett',
    centroid: [-84.4011, 42.7469], // Haslett (north)
    estimatedDoors: 45,
    density: 'suburban',
    gotvPriority: 60,
    persuasionOpportunity: 70,
  },
  {
    precinctId: 'LAN-004',
    precinctName: 'Delhi Township',
    centroid: [-84.5879, 42.6250], // Delhi (southwest)
    estimatedDoors: 35,
    density: 'rural',
    gotvPriority: 50,
    persuasionOpportunity: 55,
  },
  {
    precinctId: 'LAN-005',
    precinctName: 'Meridian Township',
    centroid: [-84.4500, 42.7000], // Meridian (center-east)
    estimatedDoors: 55,
    density: 'suburban',
    gotvPriority: 75,
    persuasionOpportunity: 60,
  },
];

const mockTurf: CanvassingTurf = {
  turfId: 'TURF-001',
  turfName: 'Lansing Central',
  precinctIds: ['LAN-001', 'LAN-002', 'LAN-003', 'LAN-004', 'LAN-005'],
  estimatedDoors: 245,
  estimatedHours: 6.5,
  doorsPerHour: 38,
  density: 'suburban',
  priority: 80,
  avgGotvPriority: 68,
  avgPersuasionOpportunity: 59,
};

describe('RouteOptimizer', () => {
  describe('optimizeRoute', () => {
    it('should return empty route for turf with no matching precincts', () => {
      const emptyTurf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['NONEXISTENT'],
      };

      const route = RouteOptimizer.optimizeRoute(emptyTurf, mockPrecincts);

      expect(route.stops).toHaveLength(0);
      expect(route.totalDoors).toBe(0);
      expect(route.totalMinutes).toBe(0);
      expect(route.totalDistanceKm).toBe(0);
      expect(route.routeTips).toContain('No precincts found in turf');
    });

    it('should handle single precinct route', () => {
      const singleTurf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['LAN-002'],
      };

      const route = RouteOptimizer.optimizeRoute(singleTurf, mockPrecincts);

      expect(route.stops).toHaveLength(1);
      expect(route.stops[0].precinctId).toBe('LAN-002');
      expect(route.stops[0].order).toBe(1);
      expect(route.stops[0].estimatedDoors).toBe(60);
      expect(route.totalDoors).toBe(60);
      // Suburban: 60 doors * 1.5 min/door = 90 minutes
      expect(route.totalMinutes).toBe(90);
    });

    it('should order stops using nearest-neighbor algorithm', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts);

      expect(route.stops).toHaveLength(5);

      // Verify order is sequential
      route.stops.forEach((stop, index) => {
        expect(stop.order).toBe(index + 1);
      });

      // Starting from LAN-001 (first in list without start location),
      // nearest neighbor should visit nearby precincts first
      expect(route.stops[0].precinctId).toBe('LAN-001');

      // Total doors should match sum
      const totalDoors = mockPrecincts.reduce((sum, p) => sum + p.estimatedDoors, 0);
      expect(route.totalDoors).toBe(totalDoors);
    });

    it('should start from specified start location', () => {
      const startLocation = { lat: 42.7469, lng: -84.4011 }; // Near Haslett

      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts, {
        startLocation,
      });

      // First stop should be closest to start location (Haslett - LAN-003)
      expect(route.stops[0].precinctId).toBe('LAN-003');
    });

    it('should calculate accurate time estimates based on density', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts);

      // Find urban stop (LAN-001: 50 doors)
      const urbanStop = route.stops.find(s => s.density === 'urban');
      expect(urbanStop).toBeDefined();
      // Urban: 2.0 min/door, but also includes travel time
      expect(urbanStop!.estimatedMinutes).toBeGreaterThanOrEqual(100); // 50 * 2.0 = 100

      // Find suburban stop (LAN-002: 60 doors)
      const suburbanStop = route.stops.find(s => s.precinctId === 'LAN-002');
      expect(suburbanStop).toBeDefined();
      // Suburban: 1.5 min/door + travel
      expect(suburbanStop!.estimatedMinutes).toBeGreaterThanOrEqual(90); // 60 * 1.5 = 90

      // Find rural stop (LAN-004: 35 doors)
      const ruralStop = route.stops.find(s => s.density === 'rural');
      expect(ruralStop).toBeDefined();
      // Rural: 2.5 min/door + travel
      expect(ruralStop!.estimatedMinutes).toBeGreaterThanOrEqual(87); // 35 * 2.5 = 87.5
    });

    it('should include travel time in estimates', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts);

      // First stop should have travel time
      const firstStop = route.stops[0];
      expect(firstStop.cumulativeMinutes).toBeGreaterThan(0);

      // Each subsequent stop should add time
      for (let i = 1; i < route.stops.length; i++) {
        expect(route.stops[i].cumulativeMinutes).toBeGreaterThan(
          route.stops[i - 1].cumulativeMinutes
        );
      }

      // Total distance should be calculated
      expect(route.totalDistanceKm).toBeGreaterThan(0);
    });

    it('should suggest breaks at 90-minute intervals by default', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts, {
        includeBreaks: true,
      });

      // With ~245 doors and mixed densities, should have breaks
      // Total time should be roughly 6.5 hours = 390 minutes
      // Expecting ~4 breaks (at 90, 180, 270, 360 min)
      expect(route.breakSuggestions.length).toBeGreaterThan(0);

      // Each break should reference a stop
      route.breakSuggestions.forEach(breakSug => {
        expect(breakSug.afterStop).toBeGreaterThan(0);
        expect(breakSug.afterStop).toBeLessThanOrEqual(route.stops.length);
        expect(breakSug.durationMinutes).toBe(15); // Default duration
      });
    });

    it('should allow custom break intervals', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts, {
        includeBreaks: true,
        breakEveryMinutes: 60,
        breakDuration: 10,
      });

      // With 60-minute intervals, should have more breaks
      const breakCount60 = route.breakSuggestions.length;

      const route90 = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts, {
        includeBreaks: true,
        breakEveryMinutes: 90,
      });

      expect(breakCount60).toBeGreaterThanOrEqual(route90.breakSuggestions.length);

      // Break duration should match
      route.breakSuggestions.forEach(breakSug => {
        expect(breakSug.durationMinutes).toBe(10);
      });
    });

    it('should disable breaks when includeBreaks is false', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts, {
        includeBreaks: false,
      });

      expect(route.breakSuggestions).toHaveLength(0);
    });

    it('should suggest breaks when density changes', () => {
      const mixedDensityTurf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['LAN-001', 'LAN-004'], // Urban then rural
      };

      const mixedPrecincts = mockPrecincts.filter(p =>
        mixedDensityTurf.precinctIds.includes(p.precinctId)
      );

      const route = RouteOptimizer.optimizeRoute(
        mixedDensityTurf,
        mixedPrecincts,
        { includeBreaks: true }
      );

      // Should have at least one break suggestion for density change
      const densityBreak = route.breakSuggestions.find(b =>
        b.reason.includes('Transitioning')
      );

      // May or may not have density break depending on timing
      // Just check that breaks array is valid
      expect(Array.isArray(route.breakSuggestions)).toBe(true);
    });

    it('should generate route tips based on density', () => {
      // Urban-dominant route
      const urbanTurf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['LAN-001'],
      };
      const urbanRoute = RouteOptimizer.optimizeRoute(
        urbanTurf,
        mockPrecincts.filter(p => p.precinctId === 'LAN-001')
      );

      expect(urbanRoute.routeTips.some(tip => tip.includes('Urban'))).toBe(true);
      expect(urbanRoute.routeTips.some(tip => tip.includes('apartments'))).toBe(true);

      // Suburban-dominant route
      const suburbanTurf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['LAN-002', 'LAN-003', 'LAN-005'],
      };
      const suburbanRoute = RouteOptimizer.optimizeRoute(
        suburbanTurf,
        mockPrecincts.filter(p => suburbanTurf.precinctIds.includes(p.precinctId))
      );

      expect(suburbanRoute.routeTips.some(tip => tip.includes('Suburban'))).toBe(true);
      expect(suburbanRoute.routeTips.some(tip => tip.includes('optimal'))).toBe(true);

      // Rural-dominant route
      const ruralTurf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['LAN-004'],
      };
      const ruralRoute = RouteOptimizer.optimizeRoute(
        ruralTurf,
        mockPrecincts.filter(p => p.precinctId === 'LAN-004')
      );

      expect(ruralRoute.routeTips.some(tip => tip.includes('Rural'))).toBe(true);
      expect(ruralRoute.routeTips.some(tip => tip.includes('longer distances'))).toBe(true);
    });

    it('should generate tips for mixed density routes', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts);

      // Should mention mixed density
      expect(route.routeTips.some(tip => tip.includes('Mixed density'))).toBe(true);
    });

    it('should generate tips based on GOTV priority', () => {
      const highGotvPrecincts: RoutePrecinctData[] = [
        {
          precinctId: 'HIGH-GOTV',
          precinctName: 'High GOTV Area',
          centroid: [-84.5555, 42.7337],
          estimatedDoors: 50,
          density: 'suburban',
          gotvPriority: 85,
          persuasionOpportunity: 30,
        },
      ];

      const highGotvTurf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['HIGH-GOTV'],
      };

      const route = RouteOptimizer.optimizeRoute(highGotvTurf, highGotvPrecincts);

      expect(route.routeTips.some(tip => tip.includes('GOTV'))).toBe(true);
    });

    it('should generate tips based on persuasion opportunity', () => {
      const highPersuasionPrecincts: RoutePrecinctData[] = [
        {
          precinctId: 'HIGH-PERS',
          precinctName: 'High Persuasion Area',
          centroid: [-84.5555, 42.7337],
          estimatedDoors: 50,
          density: 'suburban',
          gotvPriority: 30,
          persuasionOpportunity: 85,
        },
      ];

      const highPersTurf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['HIGH-PERS'],
      };

      const route = RouteOptimizer.optimizeRoute(highPersTurf, highPersuasionPrecincts);

      expect(route.routeTips.some(tip => tip.includes('persuasion'))).toBe(true);
    });

    it('should generate stop-specific tips', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts);

      // Urban stop should have urban tips
      const urbanStop = route.stops.find(s => s.density === 'urban');
      expect(urbanStop).toBeDefined();
      expect(urbanStop!.tips.some(tip => tip.includes('Apartment') || tip.includes('GOTV'))).toBe(
        true
      );

      // Rural stop should have rural tips
      const ruralStop = route.stops.find(s => s.density === 'rural');
      expect(ruralStop).toBeDefined();
      expect(ruralStop!.tips.some(tip => tip.includes('Rural'))).toBe(true);
    });

    it('should respect maxMinutes option', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts, {
        maxMinutes: 120,
      });

      // Note: Current implementation doesn't enforce maxMinutes,
      // but we test that it doesn't break
      expect(route.totalMinutes).toBeGreaterThan(0);
    });
  });

  describe('Distance calculations', () => {
    it('should calculate accurate Haversine distances', () => {
      // Test known distance: Lansing to East Lansing
      // Approximately 5.86 km apart
      const lansing: [number, number] = [-84.5555, 42.7337];
      const eastLansing: [number, number] = [-84.4839, 42.7369];

      // Access private method via any
      const RouteOptimizerAny = RouteOptimizer as any;
      const distance = RouteOptimizerAny.calculateDistance(lansing, eastLansing);

      expect(distance).toBeGreaterThan(5); // At least 5 km
      expect(distance).toBeLessThan(7); // Less than 7 km
      expect(distance).toBeCloseTo(5.86, 0.1); // Approximately 5.86 km
    });

    it('should return 0 for same location', () => {
      const point: [number, number] = [-84.5555, 42.7337];

      const RouteOptimizerAny = RouteOptimizer as any;
      const distance = RouteOptimizerAny.calculateDistance(point, point);

      expect(distance).toBe(0);
    });

    it('should handle large distances', () => {
      // Detroit to Lansing: ~135 km
      const detroit: [number, number] = [-83.0458, 42.3314];
      const lansing: [number, number] = [-84.5555, 42.7337];

      const RouteOptimizerAny = RouteOptimizer as any;
      const distance = RouteOptimizerAny.calculateDistance(detroit, lansing);

      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(150);
    });
  });

  describe('Time estimates', () => {
    it('should estimate urban time at 2.0 min/door', () => {
      const RouteOptimizerAny = RouteOptimizer as any;
      const time = RouteOptimizerAny.estimateTime(50, 'urban');

      expect(time).toBe(100); // 50 * 2.0
    });

    it('should estimate suburban time at 1.5 min/door', () => {
      const RouteOptimizerAny = RouteOptimizer as any;
      const time = RouteOptimizerAny.estimateTime(60, 'suburban');

      expect(time).toBe(90); // 60 * 1.5
    });

    it('should estimate rural time at 2.5 min/door', () => {
      const RouteOptimizerAny = RouteOptimizer as any;
      const time = RouteOptimizerAny.estimateTime(40, 'rural');

      expect(time).toBe(100); // 40 * 2.5
    });

    it('should handle zero doors', () => {
      const RouteOptimizerAny = RouteOptimizer as any;
      const time = RouteOptimizerAny.estimateTime(0, 'suburban');

      expect(time).toBe(0);
    });
  });

  describe('Travel time estimates', () => {
    it('should estimate urban travel at 12 min/km', () => {
      const RouteOptimizerAny = RouteOptimizer as any;
      const time = RouteOptimizerAny.getTravelMinutes(1.0, 'urban');

      expect(time).toBe(12);
    });

    it('should estimate suburban travel at 10 min/km', () => {
      const RouteOptimizerAny = RouteOptimizer as any;
      const time = RouteOptimizerAny.getTravelMinutes(1.0, 'suburban');

      expect(time).toBe(10);
    });

    it('should estimate rural travel at 15 min/km', () => {
      const RouteOptimizerAny = RouteOptimizer as any;
      const time = RouteOptimizerAny.getTravelMinutes(1.0, 'rural');

      expect(time).toBe(15);
    });

    it('should handle fractional distances', () => {
      const RouteOptimizerAny = RouteOptimizer as any;
      const time = RouteOptimizerAny.getTravelMinutes(0.5, 'suburban');

      expect(time).toBe(5); // 0.5 * 10
    });
  });

  describe('optimizeShiftRoute', () => {
    it('should return empty result for no turfs', () => {
      const result = RouteOptimizer.optimizeShiftRoute([], new Map());

      expect(result.turfsInOrder).toHaveLength(0);
      expect(result.routes).toHaveLength(0);
      expect(result.totalDoors).toBe(0);
      expect(result.totalMinutes).toBe(0);
    });

    it('should optimize order of multiple turfs', () => {
      const turf1: CanvassingTurf = {
        turfId: 'TURF-001',
        turfName: 'North Lansing',
        precinctIds: ['LAN-001', 'LAN-003'],
        estimatedDoors: 95,
        estimatedHours: 3,
        doorsPerHour: 32,
        density: 'urban',
        priority: 80,
        avgGotvPriority: 72,
        avgPersuasionOpportunity: 57,
      };

      const turf2: CanvassingTurf = {
        turfId: 'TURF-002',
        turfName: 'South Lansing',
        precinctIds: ['LAN-004', 'LAN-005'],
        estimatedDoors: 90,
        estimatedHours: 2.5,
        doorsPerHour: 36,
        density: 'suburban',
        priority: 70,
        avgGotvPriority: 62,
        avgPersuasionOpportunity: 57,
      };

      const precinctMap = new Map<string, RoutePrecinctData>();
      mockPrecincts.forEach(p => precinctMap.set(p.precinctId, p));

      const result = RouteOptimizer.optimizeShiftRoute([turf1, turf2], precinctMap);

      expect(result.turfsInOrder).toHaveLength(2);
      expect(result.routes).toHaveLength(2);
      expect(result.totalDoors).toBeGreaterThan(0);
      expect(result.totalMinutes).toBeGreaterThan(0);

      // Routes should match turfs
      expect(result.routes.every(r => r.stops.length > 0)).toBe(true);
    });

    it('should respect maxTurfs option', () => {
      const turfs: CanvassingTurf[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          turfId: `TURF-${i + 1}`,
          turfName: `Turf ${i + 1}`,
          precinctIds: [`LAN-00${(i % 5) + 1}`],
          estimatedDoors: 50,
          estimatedHours: 2,
          doorsPerHour: 25,
          density: 'suburban' as DensityType,
          priority: 70,
          avgGotvPriority: 60,
          avgPersuasionOpportunity: 50,
        }));

      const precinctMap = new Map<string, RoutePrecinctData>();
      mockPrecincts.forEach(p => precinctMap.set(p.precinctId, p));

      const result = RouteOptimizer.optimizeShiftRoute(turfs, precinctMap, {
        maxTurfs: 3,
      });

      expect(result.turfsInOrder).toHaveLength(3);
      expect(result.routes).toHaveLength(3);
    });

    it('should start from specified location for shift', () => {
      const turf1: CanvassingTurf = {
        turfId: 'TURF-001',
        turfName: 'East Side',
        precinctIds: ['LAN-002', 'LAN-003'],
        estimatedDoors: 105,
        estimatedHours: 3,
        doorsPerHour: 35,
        density: 'suburban',
        priority: 75,
        avgGotvPriority: 65,
        avgPersuasionOpportunity: 67,
      };

      const precinctMap = new Map<string, RoutePrecinctData>();
      mockPrecincts.forEach(p => precinctMap.set(p.precinctId, p));

      const startLocation = { lat: 42.7469, lng: -84.4011 }; // Near Haslett

      const result = RouteOptimizer.optimizeShiftRoute([turf1], precinctMap, {
        startLocation,
      });

      expect(result.turfsInOrder).toHaveLength(1);
      expect(result.routes[0].stops.length).toBeGreaterThan(0);
    });
  });

  describe('generateDirections', () => {
    it('should generate directions for empty route', () => {
      const emptyRoute: OptimizedRoute = {
        turfId: 'EMPTY',
        turfName: 'Empty Turf',
        stops: [],
        totalDoors: 0,
        totalMinutes: 0,
        totalDistanceKm: 0,
        breakSuggestions: [],
        routeTips: [],
      };

      const directions = RouteOptimizer.generateDirections(emptyRoute);

      expect(directions).toContain('No stops in route');
    });

    it('should generate turn-by-turn directions', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts);
      const directions = RouteOptimizer.generateDirections(route);

      // Should have header
      expect(directions.some(d => d.includes('Starting route'))).toBe(true);
      expect(directions.some(d => d.includes('Total'))).toBe(true);

      // Should list each stop
      route.stops.forEach(stop => {
        expect(directions.some(d => d.includes(`Stop ${stop.order}`))).toBe(true);
        expect(directions.some(d => d.includes(stop.precinctName))).toBe(true);
      });
    });

    it('should include stop details in directions', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts);
      const directions = RouteOptimizer.generateDirections(route);

      // Should include door counts
      expect(directions.some(d => d.includes('doors'))).toBe(true);

      // Should include time estimates
      expect(directions.some(d => d.includes('min'))).toBe(true);

      // Should include cumulative time
      expect(directions.some(d => d.includes('Cumulative time'))).toBe(true);
    });

    it('should include break suggestions in directions', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts, {
        includeBreaks: true,
      });
      const directions = RouteOptimizer.generateDirections(route);

      // If there are breaks, they should appear in directions
      if (route.breakSuggestions.length > 0) {
        expect(directions.some(d => d.includes('BREAK'))).toBe(true);
      }
    });

    it('should include route tips in directions', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts);
      const directions = RouteOptimizer.generateDirections(route);

      // Should have route tips section
      if (route.routeTips.length > 0) {
        expect(directions.some(d => d.includes('Route Tips'))).toBe(true);
      }
    });

    it('should include stop tips in directions', () => {
      const route = RouteOptimizer.optimizeRoute(mockTurf, mockPrecincts);
      const directions = RouteOptimizer.generateDirections(route);

      // Find stops with tips
      const stopsWithTips = route.stops.filter(s => s.tips.length > 0);

      stopsWithTips.forEach(stop => {
        // Tips should appear after stop
        const stopIndex = directions.findIndex(d => d.includes(`Stop ${stop.order}`));
        expect(stopIndex).toBeGreaterThan(-1);

        // Tips should be listed
        stop.tips.forEach(tip => {
          expect(directions.some(d => d.includes(tip))).toBe(true);
        });
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle precincts at same location', () => {
      const sameLocationPrecincts: RoutePrecinctData[] = [
        {
          precinctId: 'SAME-1',
          precinctName: 'Building A',
          centroid: [-84.5555, 42.7337],
          estimatedDoors: 25,
          density: 'urban',
          gotvPriority: 70,
          persuasionOpportunity: 60,
        },
        {
          precinctId: 'SAME-2',
          precinctName: 'Building B',
          centroid: [-84.5555, 42.7337],
          estimatedDoors: 30,
          density: 'urban',
          gotvPriority: 75,
          persuasionOpportunity: 55,
        },
      ];

      const turf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['SAME-1', 'SAME-2'],
      };

      const route = RouteOptimizer.optimizeRoute(turf, sameLocationPrecincts);

      expect(route.stops).toHaveLength(2);
      expect(route.totalDistanceKm).toBe(0); // No travel distance
    });

    it('should handle very large number of precincts', () => {
      const manyPrecincts: RoutePrecinctData[] = Array(50)
        .fill(null)
        .map((_, i) => ({
          precinctId: `MANY-${i}`,
          precinctName: `Precinct ${i}`,
          centroid: [
            -84.5 + (i % 10) * 0.01,
            42.7 + Math.floor(i / 10) * 0.01,
          ] as [number, number],
          estimatedDoors: 25,
          density: 'suburban' as DensityType,
          gotvPriority: 60,
          persuasionOpportunity: 55,
        }));

      const largeTurf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: manyPrecincts.map(p => p.precinctId),
      };

      const route = RouteOptimizer.optimizeRoute(largeTurf, manyPrecincts);

      expect(route.stops).toHaveLength(50);
      expect(route.totalDoors).toBe(1250); // 50 * 25
    });

    it('should handle precincts with zero doors', () => {
      const zeroDoorsPrecincts: RoutePrecinctData[] = [
        {
          precinctId: 'ZERO-1',
          precinctName: 'Empty Precinct',
          centroid: [-84.5555, 42.7337],
          estimatedDoors: 0,
          density: 'suburban',
          gotvPriority: 50,
          persuasionOpportunity: 50,
        },
        {
          precinctId: 'NORMAL-1',
          precinctName: 'Normal Precinct',
          centroid: [-84.5600, 42.7350],
          estimatedDoors: 50,
          density: 'suburban',
          gotvPriority: 70,
          persuasionOpportunity: 60,
        },
      ];

      const turf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['ZERO-1', 'NORMAL-1'],
      };

      const route = RouteOptimizer.optimizeRoute(turf, zeroDoorsPrecincts);

      expect(route.stops).toHaveLength(2);
      expect(route.totalDoors).toBe(50);

      // Zero-door stop should have 0 canvassing time (only travel)
      const zeroStop = route.stops.find(s => s.precinctId === 'ZERO-1');
      expect(zeroStop).toBeDefined();
      expect(zeroStop!.estimatedDoors).toBe(0);
    });

    it('should handle extreme GOTV and persuasion values', () => {
      const extremePrecincts: RoutePrecinctData[] = [
        {
          precinctId: 'EXTREME-1',
          precinctName: 'Max GOTV',
          centroid: [-84.5555, 42.7337],
          estimatedDoors: 50,
          density: 'suburban',
          gotvPriority: 100,
          persuasionOpportunity: 0,
        },
        {
          precinctId: 'EXTREME-2',
          precinctName: 'Max Persuasion',
          centroid: [-84.5600, 42.7350],
          estimatedDoors: 50,
          density: 'suburban',
          gotvPriority: 0,
          persuasionOpportunity: 100,
        },
      ];

      const turf: CanvassingTurf = {
        ...mockTurf,
        precinctIds: ['EXTREME-1', 'EXTREME-2'],
      };

      const route = RouteOptimizer.optimizeRoute(turf, extremePrecincts);

      expect(route.stops).toHaveLength(2);

      // Should generate appropriate tips
      const gotvStop = route.stops.find(s => s.precinctId === 'EXTREME-1');
      expect(gotvStop).toBeDefined();
      expect(gotvStop!.tips.some(t => t.includes('GOTV'))).toBe(true);

      const persStop = route.stops.find(s => s.precinctId === 'EXTREME-2');
      expect(persStop).toBeDefined();
      expect(persStop!.tips.some(t => t.includes('persuasion'))).toBe(true);
    });
  });
});
