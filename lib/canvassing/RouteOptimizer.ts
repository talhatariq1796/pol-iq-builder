/**
 * Route Optimizer
 *
 * Optimizes walking routes for canvassing turfs.
 * Uses nearest-neighbor heuristic and density-aware timing.
 *
 * Key features:
 * - Nearest-neighbor algorithm for route optimization
 * - Haversine distance calculations
 * - Density-aware time estimates (urban/suburban/rural)
 * - Break suggestions for long shifts
 * - Multi-turf shift optimization
 */

import type { CanvassingTurf, DensityType } from './types';

/**
 * Individual stop on a canvassing route
 */
export interface RouteStop {
  precinctId: string;
  precinctName: string;
  order: number;
  estimatedDoors: number;
  estimatedMinutes: number;
  cumulativeMinutes: number;
  density: DensityType;
  tips: string[];
}

/**
 * Complete optimized route for a turf
 */
export interface OptimizedRoute {
  turfId: string;
  turfName: string;
  stops: RouteStop[];
  totalDoors: number;
  totalMinutes: number;
  totalDistanceKm: number;
  startTime?: string;
  endTime?: string;
  breakSuggestions: BreakSuggestion[];
  routeTips: string[];
}

/**
 * Suggested break point in route
 */
export interface BreakSuggestion {
  afterStop: number;
  reason: string;
  durationMinutes: number;
}

/**
 * Options for route optimization
 */
export interface RouteOptions {
  startLocation?: { lat: number; lng: number };
  maxMinutes?: number; // Max route duration
  includeBreaks?: boolean;
  breakEveryMinutes?: number; // Default: 90
  breakDuration?: number; // Default: 15
  priorityMetric?: 'gotv' | 'persuasion' | 'doors' | 'balanced';
}

/**
 * Precinct data for route optimization
 */
export interface RoutePrecinctData {
  precinctId: string;
  precinctName: string;
  centroid: [number, number]; // [lng, lat]
  estimatedDoors: number;
  density: DensityType;
  gotvPriority: number;
  persuasionOpportunity: number;
}

// Time estimates (minutes per door based on density)
const MINUTES_PER_DOOR_URBAN = 2.0; // Slower due to apartments, elevators, security
const MINUTES_PER_DOOR_SUBURBAN = 1.5; // Optimal density
const MINUTES_PER_DOOR_RURAL = 2.5; // Longer travel between homes

// Default break settings
const DEFAULT_BREAK_INTERVAL_MINUTES = 90;
const DEFAULT_BREAK_DURATION_MINUTES = 15;

// Travel time estimates (minutes per km based on density)
const TRAVEL_MINUTES_PER_KM_URBAN = 12; // Slower urban walking, traffic lights
const TRAVEL_MINUTES_PER_KM_SUBURBAN = 10; // Medium pace
const TRAVEL_MINUTES_PER_KM_RURAL = 15; // Driving between homes

/**
 * Route Optimizer
 *
 * Optimizes canvassing routes using nearest-neighbor algorithm with
 * density-aware timing and practical break suggestions.
 */
export class RouteOptimizer {
  /**
   * Optimize route for a single turf
   *
   * @param turf - Canvassing turf to optimize
   * @param precinctData - Array of precinct data with centroids
   * @param options - Route optimization options
   * @returns Optimized route with stops, timing, and tips
   */
  static optimizeRoute(
    turf: CanvassingTurf,
    precinctData: RoutePrecinctData[],
    options?: RouteOptions
  ): OptimizedRoute {
    const opts = {
      includeBreaks: options?.includeBreaks ?? true,
      breakEveryMinutes: options?.breakEveryMinutes ?? DEFAULT_BREAK_INTERVAL_MINUTES,
      breakDuration: options?.breakDuration ?? DEFAULT_BREAK_DURATION_MINUTES,
      priorityMetric: options?.priorityMetric ?? 'balanced',
      ...options,
    };

    // Filter precincts to only those in this turf
    const turfPrecincts = precinctData.filter(p => turf.precinctIds.includes(p.precinctId));

    if (turfPrecincts.length === 0) {
      return {
        turfId: turf.turfId,
        turfName: turf.turfName,
        stops: [],
        totalDoors: 0,
        totalMinutes: 0,
        totalDistanceKm: 0,
        breakSuggestions: [],
        routeTips: ['No precincts found in turf'],
      };
    }

    // Calculate optimal visit order using nearest-neighbor
    const orderedIds = this.calculateOptimalOrder(turfPrecincts, opts.startLocation);

    // Build route stops with timing calculations
    const stops: RouteStop[] = [];
    let cumulativeMinutes = 0;
    let totalDistanceKm = 0;
    let prevCentroid: [number, number] | undefined = opts.startLocation
      ? [opts.startLocation.lng, opts.startLocation.lat]
      : undefined;

    for (let i = 0; i < orderedIds.length; i++) {
      const precinctId = orderedIds[i];
      const precinct = turfPrecincts.find(p => p.precinctId === precinctId);
      if (!precinct) continue;

      // Calculate travel time from previous location
      let travelMinutes = 0;
      if (prevCentroid) {
        const distanceKm = this.calculateDistance(prevCentroid, precinct.centroid);
        totalDistanceKm += distanceKm;
        travelMinutes = this.getTravelMinutes(distanceKm, precinct.density);
      }

      // Calculate canvassing time for this precinct
      const canvassingMinutes = this.estimateTime(precinct.estimatedDoors, precinct.density);

      // Total time for this stop (travel + canvassing)
      const estimatedMinutes = travelMinutes + canvassingMinutes;
      cumulativeMinutes += estimatedMinutes;

      // Generate tips for this stop
      const tips = this.generateStopTips(precinct);

      stops.push({
        precinctId: precinct.precinctId,
        precinctName: precinct.precinctName,
        order: i + 1,
        estimatedDoors: precinct.estimatedDoors,
        estimatedMinutes: Math.round(estimatedMinutes),
        cumulativeMinutes: Math.round(cumulativeMinutes),
        density: precinct.density,
        tips,
      });

      prevCentroid = precinct.centroid;
    }

    // Calculate break suggestions
    const breakSuggestions = opts.includeBreaks
      ? this.suggestBreaks(stops, opts.breakEveryMinutes, opts.breakDuration)
      : [];

    // Generate overall route tips
    const routeTips = this.generateRouteTips(turfPrecincts);

    // Calculate start/end times if provided
    let startTime = options?.startLocation ? undefined : undefined;
    let endTime = options?.startLocation ? undefined : undefined;

    return {
      turfId: turf.turfId,
      turfName: turf.turfName,
      stops,
      totalDoors: stops.reduce((sum, s) => sum + s.estimatedDoors, 0),
      totalMinutes: Math.round(cumulativeMinutes),
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      startTime,
      endTime,
      breakSuggestions,
      routeTips,
    };
  }

  /**
   * Calculate optimal order using nearest-neighbor algorithm
   *
   * Starting from startLocation (or first precinct), repeatedly visit the
   * nearest unvisited precinct until all are visited.
   *
   * @param precincts - Array of precincts to order
   * @param startLocation - Optional starting location
   * @returns Array of precinct IDs in optimal visit order
   */
  private static calculateOptimalOrder(
    precincts: RoutePrecinctData[],
    startLocation?: { lat: number; lng: number }
  ): string[] {
    if (precincts.length === 0) return [];
    if (precincts.length === 1) return [precincts[0].precinctId];

    const unvisited = new Set(precincts.map(p => p.precinctId));
    const order: string[] = [];

    // Start from provided location or first precinct
    let currentLocation: [number, number] = startLocation
      ? [startLocation.lng, startLocation.lat]
      : precincts[0].centroid;

    // If we have a start location, find nearest precinct to it
    if (startLocation) {
      let nearestId = precincts[0].precinctId;
      let nearestDist = Infinity;

      for (const precinct of precincts) {
        const dist = this.calculateDistance(currentLocation, precinct.centroid);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = precinct.precinctId;
        }
      }

      order.push(nearestId);
      unvisited.delete(nearestId);
      const firstPrecinct = precincts.find(p => p.precinctId === nearestId);
      if (firstPrecinct) {
        currentLocation = firstPrecinct.centroid;
      }
    } else {
      // Start with first precinct
      order.push(precincts[0].precinctId);
      unvisited.delete(precincts[0].precinctId);
      currentLocation = precincts[0].centroid;
    }

    // Greedily visit nearest unvisited precinct
    while (unvisited.size > 0) {
      let nearestId: string | null = null;
      let nearestDist = Infinity;

      for (const precinctId of Array.from(unvisited)) {
        const precinct = precincts.find(p => p.precinctId === precinctId);
        if (!precinct) continue;

        const dist = this.calculateDistance(currentLocation, precinct.centroid);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = precinctId;
        }
      }

      if (nearestId === null) break; // Safety check

      order.push(nearestId);
      unvisited.delete(nearestId);

      const nextPrecinct = precincts.find(p => p.precinctId === nearestId);
      if (nextPrecinct) {
        currentLocation = nextPrecinct.centroid;
      }
    }

    return order;
  }

  /**
   * Calculate distance between two points using Haversine formula
   *
   * @param point1 - First point [lng, lat]
   * @param point2 - Second point [lng, lat]
   * @returns Distance in kilometers
   */
  private static calculateDistance(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const R = 6371; // Earth radius in km
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Estimate time for a precinct based on doors and density
   *
   * @param doors - Number of doors to knock
   * @param density - Density type (urban/suburban/rural)
   * @returns Estimated minutes
   */
  private static estimateTime(doors: number, density: DensityType): number {
    let minutesPerDoor: number;

    switch (density) {
      case 'urban':
        minutesPerDoor = MINUTES_PER_DOOR_URBAN;
        break;
      case 'suburban':
        minutesPerDoor = MINUTES_PER_DOOR_SUBURBAN;
        break;
      case 'rural':
        minutesPerDoor = MINUTES_PER_DOOR_RURAL;
        break;
      default:
        minutesPerDoor = MINUTES_PER_DOOR_SUBURBAN;
    }

    return doors * minutesPerDoor;
  }

  /**
   * Calculate travel time between locations
   *
   * @param distanceKm - Distance in kilometers
   * @param density - Density type for travel speed
   * @returns Travel time in minutes
   */
  private static getTravelMinutes(distanceKm: number, density: DensityType): number {
    let minutesPerKm: number;

    switch (density) {
      case 'urban':
        minutesPerKm = TRAVEL_MINUTES_PER_KM_URBAN;
        break;
      case 'suburban':
        minutesPerKm = TRAVEL_MINUTES_PER_KM_SUBURBAN;
        break;
      case 'rural':
        minutesPerKm = TRAVEL_MINUTES_PER_KM_RURAL;
        break;
      default:
        minutesPerKm = TRAVEL_MINUTES_PER_KM_SUBURBAN;
    }

    return distanceKm * minutesPerKm;
  }

  /**
   * Generate route tips based on precinct characteristics
   *
   * @param precincts - Array of precincts in route
   * @returns Array of practical tips
   */
  private static generateRouteTips(precincts: RoutePrecinctData[]): string[] {
    const tips: string[] = [];

    if (precincts.length === 0) return tips;

    // Determine dominant density
    const densityCounts = precincts.reduce(
      (acc, p) => {
        acc[p.density] = (acc[p.density] || 0) + 1;
        return acc;
      },
      {} as Record<DensityType, number>
    );

    const dominantDensity = Object.entries(densityCounts).reduce((a, b) =>
      b[1] > a[1] ? b : a
    )[0] as DensityType;

    // Density-specific tips
    switch (dominantDensity) {
      case 'urban':
        tips.push('Urban area - expect apartments and multi-unit buildings');
        tips.push('Plan for building access time and security procedures');
        break;
      case 'suburban':
        tips.push('Suburban area - optimal canvassing efficiency');
        tips.push('Most efficient use of volunteer time');
        break;
      case 'rural':
        tips.push('Rural area - longer distances between homes');
        tips.push('Budget extra travel time, consider driving between precincts');
        break;
    }

    // Mixed density tip
    const uniqueDensities = new Set(precincts.map(p => p.density));
    if (uniqueDensities.size > 1) {
      tips.push('Mixed density route - adjust pace as terrain changes');
    }

    // High GOTV tip
    const avgGotv = precincts.reduce((sum, p) => sum + p.gotvPriority, 0) / precincts.length;
    if (avgGotv >= 75) {
      tips.push('High GOTV priority - focus on turnout messaging');
    }

    // High persuasion tip
    const avgPersuasion =
      precincts.reduce((sum, p) => sum + p.persuasionOpportunity, 0) / precincts.length;
    if (avgPersuasion >= 75) {
      tips.push('High persuasion opportunity - prepare for longer conversations');
    }

    // Balanced tip
    if (avgGotv >= 60 && avgPersuasion >= 60) {
      tips.push('Balanced GOTV and persuasion - flexible messaging approach');
    }

    return tips;
  }

  /**
   * Generate tips for a specific stop
   *
   * @param precinct - Precinct data
   * @returns Array of tips for this stop
   */
  private static generateStopTips(precinct: RoutePrecinctData): string[] {
    const tips: string[] = [];

    // Density-specific tip
    if (precinct.density === 'urban') {
      tips.push('Apartment buildings - bring clipboard for door lists');
    } else if (precinct.density === 'rural') {
      tips.push('Rural area - longer driveways, allow extra time');
    }

    // Priority-based tips
    if (precinct.gotvPriority >= 80) {
      tips.push('Top GOTV priority - emphasize voting plan');
    } else if (precinct.persuasionOpportunity >= 80) {
      tips.push('High persuasion - engage in longer conversations');
    }

    return tips;
  }

  /**
   * Suggest break points in the route
   *
   * @param stops - Route stops
   * @param breakEveryMinutes - Interval for breaks
   * @param breakDuration - Duration of each break
   * @returns Array of break suggestions
   */
  private static suggestBreaks(
    stops: RouteStop[],
    breakEveryMinutes: number,
    breakDuration: number
  ): BreakSuggestion[] {
    const breaks: BreakSuggestion[] = [];

    if (stops.length === 0) return breaks;

    let lastBreakAt = 0;

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const timeSinceLastBreak = stop.cumulativeMinutes - lastBreakAt;

      // Suggest break if we've exceeded interval
      if (timeSinceLastBreak >= breakEveryMinutes) {
        breaks.push({
          afterStop: stop.order,
          reason: `${Math.round(timeSinceLastBreak)} minutes of canvassing - time for a break`,
          durationMinutes: breakDuration,
        });
        lastBreakAt = stop.cumulativeMinutes;
      }

      // Also suggest break when density changes (if significant time has passed)
      if (i > 0 && timeSinceLastBreak >= breakEveryMinutes * 0.5) {
        const prevStop = stops[i - 1];
        if (prevStop.density !== stop.density) {
          breaks.push({
            afterStop: prevStop.order,
            reason: `Transitioning from ${prevStop.density} to ${stop.density} area`,
            durationMinutes: breakDuration,
          });
          lastBreakAt = prevStop.cumulativeMinutes;
        }
      }
    }

    return breaks;
  }

  /**
   * Get multi-turf route for a shift
   * Optimizes order of multiple turfs for a volunteer shift
   *
   * @param turfs - Array of turfs to optimize
   * @param precinctDataMap - Map of precinct ID to data
   * @param options - Route options
   * @returns Optimized shift route with turfs in order
   */
  static optimizeShiftRoute(
    turfs: CanvassingTurf[],
    precinctDataMap: Map<string, RoutePrecinctData>,
    options?: RouteOptions & { maxTurfs?: number }
  ): {
    turfsInOrder: string[];
    routes: OptimizedRoute[];
    totalDoors: number;
    totalMinutes: number;
  } {
    if (turfs.length === 0) {
      return {
        turfsInOrder: [],
        routes: [],
        totalDoors: 0,
        totalMinutes: 0,
      };
    }

    // Limit turfs if maxTurfs specified
    const selectedTurfs = options?.maxTurfs ? turfs.slice(0, options.maxTurfs) : turfs;

    // For each turf, calculate its centroid
    const turfCentroids = selectedTurfs.map(turf => {
      const precincts = turf.precinctIds
        .map(id => precinctDataMap.get(id))
        .filter((p): p is RoutePrecinctData => p !== undefined);

      if (precincts.length === 0) {
        return { turfId: turf.turfId, centroid: [0, 0] as [number, number] };
      }

      const avgLng = precincts.reduce((sum, p) => sum + p.centroid[0], 0) / precincts.length;
      const avgLat = precincts.reduce((sum, p) => sum + p.centroid[1], 0) / precincts.length;

      return { turfId: turf.turfId, centroid: [avgLng, avgLat] as [number, number] };
    });

    // Use nearest-neighbor to order turfs
    const orderedTurfIds = this.calculateOptimalOrder(
      turfCentroids.map(tc => ({
        precinctId: tc.turfId,
        precinctName: tc.turfId,
        centroid: tc.centroid,
        estimatedDoors: 0,
        density: 'suburban' as DensityType,
        gotvPriority: 0,
        persuasionOpportunity: 0,
      })),
      options?.startLocation
    );

    // Optimize route for each turf in order
    const routes: OptimizedRoute[] = [];
    let totalDoors = 0;
    let totalMinutes = 0;

    for (const turfId of orderedTurfIds) {
      const turf = selectedTurfs.find(t => t.turfId === turfId);
      if (!turf) continue;

      const precinctData = turf.precinctIds
        .map(id => precinctDataMap.get(id))
        .filter((p): p is RoutePrecinctData => p !== undefined);

      const route = this.optimizeRoute(turf, precinctData, options);
      routes.push(route);

      totalDoors += route.totalDoors;
      totalMinutes += route.totalMinutes;
    }

    return {
      turfsInOrder: orderedTurfIds,
      routes,
      totalDoors,
      totalMinutes,
    };
  }

  /**
   * Generate turn-by-turn directions (simplified)
   *
   * @param route - Optimized route
   * @returns Array of direction strings
   */
  static generateDirections(route: OptimizedRoute): string[] {
    const directions: string[] = [];

    if (route.stops.length === 0) {
      return ['No stops in route'];
    }

    directions.push(`Starting route: ${route.turfName}`);
    directions.push(`Total: ${route.totalDoors} doors, ~${route.totalMinutes} minutes`);
    directions.push('');

    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i];

      directions.push(`Stop ${stop.order}: ${stop.precinctName}`);
      directions.push(`  - ${stop.estimatedDoors} doors (~${stop.estimatedMinutes} min)`);
      directions.push(`  - Cumulative time: ${stop.cumulativeMinutes} min`);

      if (stop.tips.length > 0) {
        directions.push(`  - Tips: ${stop.tips.join('; ')}`);
      }

      // Check for breaks after this stop
      const breakAfter = route.breakSuggestions.find(b => b.afterStop === stop.order);
      if (breakAfter) {
        directions.push(`  - 🛑 BREAK: ${breakAfter.reason} (${breakAfter.durationMinutes} min)`);
      }

      directions.push('');
    }

    if (route.routeTips.length > 0) {
      directions.push('Route Tips:');
      route.routeTips.forEach(tip => {
        directions.push(`  - ${tip}`);
      });
    }

    return directions;
  }
}
